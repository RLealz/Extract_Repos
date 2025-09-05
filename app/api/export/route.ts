import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { exportRequestSchema } from "@/app/lib/validations";
import { GITHUB_API_BASE } from "@/app/lib/constants";
import fs from "node:fs/promises";
import path from "node:path";

function parseNextFromLink(link: string | null): number | undefined {
  if (!link) return undefined;
  const parts = link.split(",");
  for (const p of parts) {
    const section = p.split(";");
    if (section.length < 2) continue;
    const urlPart = section[0].trim().replace(/[<>]/g, "");
    const relMatch = section[1].trim().match(/rel="(.*)"/);
    if (!relMatch) continue;
    const rel = relMatch[1];
    if (rel !== "next") continue;
    try {
      const url = new URL(urlPart);
      const pageStr = url.searchParams.get("page");
      const pageNum = pageStr ? Number(pageStr) : undefined;
      if (pageNum && Number.isFinite(pageNum)) return pageNum;
    } catch (_) {
      // ignore
    }
  }
  return undefined;
}

function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return "";
  let s = String(val);
  s = s.replace(/\r?\n|\r/g, " ");
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCSV(all: any[]): string {
  const headers = [
    "id",
    "full_name",
    "html_url",
    "description",
    "stargazers_count",
    "language",
    "owner_login",
    "owner_html_url",
  ];
  const lines = [headers.join(",")];
  for (const r of all) {
    const row = [
      csvEscape(r?.id),
      csvEscape(r?.full_name ?? r?.name ?? ""),
      csvEscape(r?.html_url ?? ""),
      csvEscape(r?.description ?? ""),
      csvEscape(r?.stargazers_count ?? ""),
      csvEscape(r?.language ?? ""),
      csvEscape(r?.owner?.login ?? ""),
      csvEscape(r?.owner?.html_url ?? ""),
    ];
    lines.push(row.join(","));
  }
  return lines.join("\n") + "\n";
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { username, format } = exportRequestSchema.parse(json);

    const token = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    let page = 1;
    const per_page = 100;
    const all: any[] = [];

    for (let i = 0; i < 100; i++) {
      const url = `${GITHUB_API_BASE}/users/${encodeURIComponent(
        username
      )}/starred?page=${page}&per_page=${per_page}`;

      const res = await fetch(url, {
        headers,
        next: { revalidate: 0 },
      });

      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json(
          { error: `GitHub API error (${res.status}): ${text}` },
          { status: res.status }
        );
      }

      const chunk = await res.json();
      if (Array.isArray(chunk) && chunk.length > 0) {
        all.push(...chunk);
      }

      const link = res.headers.get("link");
      const nextPage = parseNextFromLink(link);
      if (nextPage) {
        page = nextPage;
      } else {
        break;
      }
    }

    let destPath: string;
    if (format === "csv") {
      const csv = toCSV(all);
      destPath = path.resolve(process.cwd(), "..", "stars.csv");
      await fs.writeFile(destPath, csv, "utf-8");
    } else {
      destPath = path.resolve(process.cwd(), "..", "stars.json");
      await fs.writeFile(destPath, JSON.stringify(all), "utf-8");
    }

    return NextResponse.json({ ok: true, count: all.length, path: destPath, format: format ?? "json" });
  } catch (error: any) {
    const message = error?.issues?.[0]?.message || error?.message || "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}