"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import Input from "@/app/components/ui/input";
import Button from "@/app/components/ui/button";
import { AlertTriangle } from "lucide-react";

const formSchema = z.object({
  username: z.string().min(1, "Username is required").trim(),
});

type FormValues = z.infer<typeof formSchema>;

interface RepoItem {
  id: number;
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  stars: number;
  language: string | null;
  owner: {
    login: string;
    avatarUrl: string;
    url: string;
  };
}

interface PageInfo {
  first?: number;
  prev?: number;
  next?: number;
  last?: number;
}

interface RateInfo {
  limit: number | null;
  remaining: number | null;
  reset: number | null;
}

// Utility: robust-ish Base64 -> UTF-8 decode for README content
// Removed unused b64ToUtf8 helper (was previously used to decode README previews)
// Utility: CSV generator for client-side export of normalized RepoItem[]
function toCSVFromRepos(repos: RepoItem[]): string {
  const headers = [
    "id",
    "full_name",
    "url",
    "description",
    "stars",
    "language",
    "owner_login",
    "owner_url",
  ];
  const lines = [headers.join(",")];
  const esc = (val: unknown) => {
    if (val === null || val === undefined) return "";
    let s = String(val).replace(/\r?\n|\r/g, " ");
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      s = '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  for (const r of repos) {
    const row = [
      esc(r.id),
      esc(r.fullName),
      esc(r.url),
      esc(r.description ?? ""),
      esc(r.stars),
      esc(r.language ?? ""),
      esc(r.owner.login),
      esc(r.owner.url),
    ];
    lines.push(row.join(","));
  }
  return lines.join("\n") + "\n";
}

function parseLinkHeader(link: string | null): PageInfo {
  if (!link) return {};
  const parts = link.split(",");
  const info: PageInfo = {};
  for (const p of parts) {
    const section = p.split(";");
    if (section.length < 2) continue;
    const urlPart = section[0].trim().replace(/[<>]/g, "");
    const relMatch = section[1].trim().match(/rel="(.*)"/);
    try {
      const url = new URL(urlPart);
      const pageStr = url.searchParams.get("page");
      const pageNum = pageStr ? Number(pageStr) : undefined;
      if (!relMatch || !pageNum) continue;
      const rel = relMatch[1] as keyof PageInfo;
      info[rel] = pageNum;
    } catch (_) {
      // ignore
    }
  }
  return info;
}

export default function Home() {
  const [items, setItems] = useState<RepoItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [perPage, setPerPage] = useState<number>(30);
  const [pageInfo, setPageInfo] = useState<PageInfo>({});
  const [rate, setRate] = useState<RateInfo | null>(null);
  // NEW UI state
  const [searchMode, setSearchMode] = useState<"username" | "within">("username");
  const [filterQuery, setFilterQuery] = useState("");
  const [sortBy, setSortBy] = useState<"stars_desc" | "name_asc">("stars_desc");
  const [view, setView] = useState<"list" | "grid">("list");
  // Side panel removed; using per-card flip instead
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [topicsById, setTopicsById] = useState<Record<number, string[] | undefined>>({});
  const [loadingTopicById, setLoadingTopicById] = useState<Record<number, boolean>>({});
  const [success, setSuccess] = useState<string | null>(null);

  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [exportChoice, setExportChoice] = useState<"current-json" | "current-csv" | "all-json" | "all-csv">("current-json");
  const listRef = useRef<HTMLUListElement>(null);

  const { register, handleSubmit, formState, getValues, resetField } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { username: "" },
  });

  // Derived: items after optional within-results filtering and sorting
  const displayedItems = useMemo(() => {
    let arr = (items ?? []).slice();
    if (searchMode === "within" && filterQuery.trim()) {
      const q = filterQuery.trim().toLowerCase();
      arr = arr.filter((r) =>
        r.fullName.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q) ||
        (r.language ?? "").toLowerCase().includes(q)
      );
    }
    if (sortBy === "name_asc") {
      arr.sort((a, b) => a.fullName.localeCompare(b.fullName));
    } else {
      arr.sort((a, b) => b.stars - a.stars);
    }
    return arr;
  }, [items, searchMode, filterQuery, sortBy]);

  // Legacy no-op; details panel removed in favor of per-card back side
  function fetchRepoDetails(_: RepoItem) {}
  async function ensureTopics(item: RepoItem) {
    if (topicsById[item.id]) return;
    setLoadingTopicById((m) => ({ ...m, [item.id]: true }));
    try {
      const [owner, repo] = item.fullName.split("/");
      const tRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/topics`, {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        cache: "no-store",
      });
      if (tRes.ok) {
        const tJson = await tRes.json();
        if (tJson && Array.isArray(tJson.names)) {
          setTopicsById((m) => ({ ...m, [item.id]: tJson.names as string[] }));
        } else {
          setTopicsById((m) => ({ ...m, [item.id]: [] }));
        }
      } else {
        setTopicsById((m) => ({ ...m, [item.id]: [] }));
      }
    } catch {
      setTopicsById((m) => ({ ...m, [item.id]: [] }));
    } finally {
      setLoadingTopicById((m) => ({ ...m, [item.id]: false }));
    }
  }

  function toggleFlip(item: RepoItem) {
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
    if (!topicsById[item.id]) {
      ensureTopics(item);
    }
  }

  function triggerDownload(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportCurrent(format: "json" | "csv") {
    const data = displayedItems;
    if (!data || data.length === 0) {
      setError("Nothing to export in current view");
      return;
    }
    if (format === "csv") {
      const csv = toCSVFromRepos(data);
      triggerDownload("stars_current.csv", csv, "text/csv;charset=utf-8");
      setSuccess(`Exported ${data.length} repos to CSV`);
    } else {
      triggerDownload("stars_current.json", JSON.stringify(data, null, 2), "application/json;charset=utf-8");
      setSuccess(`Exported ${data.length} repos to JSON`);
    }
  }

  async function fetchPage(user: string, pg: number, pp: number) {
    setLoading(true);
    setError(null);
    setSuccess(null);
    // Reset flip/topics caches when changing page
    setFlipped(new Set());
    setTopicsById({});
    setLoadingTopicById({});
     try {
      const r = await fetch(`/api/starred?username=${encodeURIComponent(user)}&page=${pg}&per_page=${pp}`);
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || "Failed to fetch");
        return;
      }
      const arr = (j.items as RepoItem[]) || [];
      setItems(arr);
      setCurrentUser(user);
      setPage(pg);
      setPerPage(pp);
      const info = parseLinkHeader(j.link ?? null);
      setPageInfo(info);
      setRate(j.rate ?? null);
      setTimeout(() => {
        resultsHeadingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const onSubmit = async (values: FormValues) => {
    if (searchMode === "within") return; // ignore submit in within-results mode
    setCurrentUser(values.username);
    await fetchPage(values.username, 1, perPage);
  };

  const handlePrev = async () => {
    if (!currentUser || !pageInfo.prev) return;
    await fetchPage(currentUser, pageInfo.prev, perPage);
  };

  const handleNext = async () => {
    if (!currentUser || !pageInfo.next) return;
    await fetchPage(currentUser, pageInfo.next, perPage);
  };

  const handlePerPageChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pp = Number(e.target.value);
    setPerPage(pp);
    const user = currentUser ?? getValues("username");
    if (user) {
      await fetchPage(user, 1, pp);
    }
  };

  const handleFetchAll = async () => {
    const user = currentUser ?? getValues("username");
     if (!user) return;
      setLoadingAll(true);
      setError(null);
      try {
        // Load and display all pages from /api/starred (no export here)
        let pg = 1;
        const pp = 100;
        const all: RepoItem[] = [];
        for (let i = 0; i < 100; i++) {
          const r = await fetch(`/api/starred?username=${encodeURIComponent(user)}&page=${pg}&per_page=${pp}`);
          const j = await r.json();
          if (!r.ok) {
            setError(j.error || "Failed to fetch");
            break;
          }
          setRate(j.rate ?? null);
          const chunk = (j.items as RepoItem[]) || [];
          all.push(...chunk);
          const info = parseLinkHeader(j.link ?? null);
          if (info.next) {
            pg = info.next;
          } else {
            break;
          }
        }
        setItems(all);
        setCurrentUser(user);
        setPage(1);
        setPerPage(100);
        setPageInfo({});
        setTimeout(() => {
          resultsHeadingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 0);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        setError(message || "Unknown error");
      } finally {
        setLoadingAll(false);
      }
    };

  async function handleExportAction(action: "current-json" | "current-csv" | "all-json" | "all-csv") {
    setError(null);
    setSuccess(null);
    const user = currentUser ?? getValues("username");
    const [scope, format] = action.split("-") as ["current" | "all", "json" | "csv"];
    try {
      if (scope === "current") {
        await exportCurrent(format);
      } else {
        if (!user) {
          setError("Enter a username first");
          return;
        }
        setExporting(true);
        const res = await fetch("/api/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: user, format }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Export failed");
          return;
        }
        setSuccess(`Exported ${data.count ?? ""} repos to ${data.format ?? format} at ${data.path ?? "server file"}`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message || "Unknown error");
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus();
    }
  }, [error]);


  useEffect(() => {
    if (!loading && items && items.length > 0) {
      resultsHeadingRef.current?.focus();
    }
  }, [loading, items]);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold mb-4">GitHub Starred Repositories</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" aria-label="Search starred repositories">
        {/* Row 1: Search */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[16rem]">
            {searchMode === "username" ? (
              <Input key="username" placeholder="Enter GitHub username" aria-label="GitHub username" {...register("username")} />
            ) : (
              <Input
                key="within"
                placeholder="Search within results"
                aria-label="Search within results"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
              />
            )}
          </div>

          <div>
            <label htmlFor="search-mode" className="sr-only">Search mode</label>
            <select
              id="search-mode"
              value={searchMode}
              onChange={(e) => {
                const val = e.target.value as "username" | "within";
                setSearchMode(val);
                setError(null);
                setSuccess(null);
                if (val === "within") {
                  resetField("username");
                } else {
                  setFilterQuery("");
                }
              }}
              className="h-10 rounded-md border border-gray-700 bg-black text-white px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Search mode"
            >
              <option value="username">Search Username</option>
              <option value="within">Search Within Results</option>
            </select>
          </div>

          {searchMode === "username" && (
            <Button type="submit" variant="secondary" disabled={loading || loadingAll} aria-disabled={loading || loadingAll} aria-busy={loading}>
              {loading ? "Loading..." : "Search"}
            </Button>
          )}
        </div>

        {/* Row 2: Export (split button) and Advanced */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <label htmlFor="export-choice" className="text-sm text-gray-400">Export</label>
            <select
              id="export-choice"
              value={exportChoice}
              onChange={(e) => setExportChoice(e.target.value as "current-json" | "current-csv" | "all-json" | "all-csv")}
              className="h-10 rounded-md border border-gray-700 bg-black text-white px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Export selection"
            >
              <option value="current-json">Current view → JSON</option>
              <option value="current-csv">Current view → CSV</option>
              <option value="all-json">All repos → JSON</option>
              <option value="all-csv">All repos → CSV</option>
            </select>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleExportAction(exportChoice)}
              disabled={exporting}
              aria-busy={exporting}
              aria-label="Run export"
            >
              {exporting ? "Exporting..." : "Export"}
            </Button>
          </div>
          <button
            type="button"
            onClick={handleFetchAll}
            className="text-sm text-blue-600 hover:underline"
            title="Load every repo into the list for browsing (does not export)"
          >
            Advanced: Load all to list
          </button>
        </div>

        {/* Row 3: Per page + Sort + View */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400" htmlFor="perPage">Per page</label>
            <select
              id="perPage"
              value={perPage}
              onChange={handlePerPageChange}
              className="h-10 rounded-md border border-gray-700 bg-black text-white px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Results per page"
            >
              <option value={10}>10</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="sort" className="text-sm text-gray-400">Sort</label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "stars_desc" | "name_asc")}
              className="h-10 rounded-md border border-gray-700 bg-black text-white px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Sort results"
            >
              <option value="stars_desc">Stars</option>
              <option value="name_asc">Name (A–Z)</option>
            </select>
          </div>

          <div className="flex items-center gap-1" role="group" aria-label="View toggle">
            <Button type="button" size="sm" variant={view === "list" ? "primary" : "outline"} onClick={() => setView("list")}>List</Button>
            <Button type="button" size="sm" variant={view === "grid" ? "primary" : "outline"} onClick={() => setView("grid")}>Grid</Button>
          </div>
        </div>
      </form>

      {formState.errors.username && (
        <p className="text-red-600 text-sm mb-2" role="alert">{formState.errors.username.message}</p>
      )}

      {rate && (
        <p className="text-xs text-gray-600 mb-2" aria-live="polite">
          Rate: {rate.remaining ?? "-"}/{rate.limit ?? "-"}
          {rate.reset ? ` • Resets at ${new Date(rate.reset * 1000).toLocaleTimeString()}` : ""}
        </p>
      )}

      {error && (
        <div ref={errorRef} tabIndex={-1} className="mb-3 rounded-md border border-red-300 bg-red-50 p-3 text-red-800 flex items-start gap-2" role="alert" aria-live="assertive">
          <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">Something went wrong</p>
            <p className="text-sm">{error}</p>
            <p className="text-xs mt-1 text-red-700">If you are unauthenticated you may be rate-limited by GitHub. Try again later or add a token.</p>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {currentUser && !loadingAll && (
        <div className="flex items-center gap-3 mb-4" aria-live="polite">
          <Button size="sm" variant="outline" onClick={handlePrev} disabled={loading || !pageInfo.prev} aria-label="Previous page">
            Prev
          </Button>
          <span className="text-sm text-gray-700">
            Page {page}{pageInfo.last ? ` of ${pageInfo.last}` : ""}
          </span>
          <Button size="sm" variant="outline" onClick={handleNext} disabled={loading || !pageInfo.next} aria-label="Next page">
            Next
          </Button>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <ul className="space-y-3" aria-hidden="true">
          {Array.from({ length: Math.min(10, perPage) }).map((_, i) => (
            <li key={i} className="rounded border p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                </div>
                <div className="h-4 bg-gray-200 rounded w-20" />
              </div>
            </li>
          ))}
        </ul>
      )}

      {items && items.length === 0 && !loading && (
        <div className="rounded border p-6 text-center text-gray-700">
          <p className="font-medium">No starred repositories found</p>
          <p className="text-sm mt-1">Try another username or click “Fetch All” to load all pages.</p>
        </div>
      )}

      {items && items.length > 0 && (
        <>
          <h2 ref={resultsHeadingRef} tabIndex={-1} className="text-lg font-medium mb-2 outline-none">Results</h2>
          <p className="text-sm text-gray-600 mb-4" aria-live="polite">
            Showing {(page - 1) * perPage + 1}
            –
            {(page - 1) * perPage + displayedItems.length}
          </p>

          <div className="grid grid-cols-1 gap-6">
            {/* Left: list */}
            <div className="w-full max-w-[960px]">
              <ul ref={listRef} className={view === "grid" ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : "space-y-3"} aria-busy={loading} aria-labelledby="results-heading">
                {displayedItems.map((r) => (
                  <li key={r.id} className="rounded border p-0 transition cursor-pointer" onClick={() => toggleFlip(r)} aria-label={`Toggle details for ${r.fullName}`}>
                    <div className={`flip-card ${flipped.has(r.id) ? "is-flipped" : ""}`}>
                      <div className="flip-card-inner">
                        {/* Front */}
                        <div className="flip-face rounded p-4 hover:bg-gray-50 dark:hover:bg-gray-800">
                          <div className="flex items-center gap-3">
                            <Image src={r.owner.avatarUrl} alt={`${r.owner.login} avatar`} width={32} height={32} className="rounded-full" />
                            <div className="flex-1 min-w-0">
                              <a className="font-medium hover:underline break-words" href={r.url} target="_blank" rel="noreferrer">
                                {r.fullName}
                              </a>
                              {r.description && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{r.description}</p>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 whitespace-nowrap dark:text-gray-400">
                              ⭐ {r.stars} {r.language && <span className="ml-2">• {r.language}</span>}
                            </div>
                          </div>
                        </div>
                        {/* Back */}
                        <div className="flip-face flip-back rounded p-4 bg-gray-50 dark:bg-gray-800">
                          <div className="space-y-2">
                            <h3 className="font-medium break-words">{r.fullName}</h3>
                            {r.description && <p className="text-sm text-gray-700 dark:text-gray-300">{r.description}</p>}
                            <div className="text-sm text-gray-600 dark:text-gray-400">⭐ {r.stars} {r.language && <span className="ml-2">• {r.language}</span>}</div>
                            <a className="text-sm text-blue-600 hover:underline" href={r.url} target="_blank" rel="noreferrer">View on GitHub →</a>
                            <div>
                              <p className="text-sm font-medium mb-1">Topics</p>
                              {loadingTopicById[r.id] && <p className="text-xs text-gray-500 dark:text-gray-400">Loading topics…</p>}
                              {!loadingTopicById[r.id] && (topicsById[r.id]?.length ? (
                                <div className="flex flex-wrap gap-2">
                                  {topicsById[r.id]!.map((t) => (
                                    <span key={t} className="text-xs rounded-full border px-2 py-1 bg-gray-100 text-gray-900 border-gray-300 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700">{t}</span>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-500 dark:text-gray-400">No topics</p>
                              ))}
                            </div>
                            <p className="text-[11px] text-gray-500">Click card to flip back</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
         </>
       )}
    </main>
  );
}
