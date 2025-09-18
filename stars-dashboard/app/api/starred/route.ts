import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { starredQuerySchema } from "@/app/lib/validations";
import { GITHUB_API_BASE } from "@/app/lib/constants";

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  owner: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = Object.fromEntries(searchParams.entries());
    const parsed = starredQuerySchema.parse(raw);

    const { username, page, per_page } = parsed;

    const token = process.env.GITHUB_TOKEN;

    const url = `${GITHUB_API_BASE}/users/${encodeURIComponent(
      username
    )}/starred?page=${page}&per_page=${per_page}`;

    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "X-GitHub-Api-Version": "2022-11-28",
      },
      // Revalidate GitHub data periodically
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `GitHub API error (${res.status}): ${text}` },
        { status: res.status }
      );
    }

    const data = (await res.json()) as GitHubRepo[];

    // Minimal normalization
    const normalized = data.map((r) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      url: r.html_url,
      description: r.description,
      stars: r.stargazers_count,
      language: r.language,
      owner: {
        login: r.owner.login,
        avatarUrl: r.owner.avatar_url,
        url: r.owner.html_url,
      },
    }));

    // Relay pagination hints if present
    const link = res.headers.get("link");

    // Rate limit info
    const limit = res.headers.get("x-ratelimit-limit");
    const remaining = res.headers.get("x-ratelimit-remaining");
    const reset = res.headers.get("x-ratelimit-reset");

    return NextResponse.json({
      items: normalized,
      link,
      rate: {
        limit: limit ? Number(limit) : null,
        remaining: remaining ? Number(remaining) : null,
        reset: reset ? Number(reset) : null,
      },
    });
  } catch (error: unknown) {
    const message =
      typeof error === "object" && error !== null && "issues" in error
        ? (error as any)?.issues?.[0]?.message
        : error instanceof Error
        ? error.message
        : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}