"use client";

import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
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

  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const exportFormatRef = useRef<HTMLSelectElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const { register, handleSubmit, formState, getValues } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { username: "" },
  });

  async function fetchPage(username: string, pg: number, pp: number) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/starred?username=${encodeURIComponent(username)}&page=${pg}&per_page=${pp}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to fetch");
        setItems([]);
        setPageInfo({});
        setRate(data.rate ?? null);
        return;
      }
      setItems(data.items as RepoItem[]);
      const info = parseLinkHeader(data.link ?? null);
      setPageInfo(info);
      setPage(pg);
      setPerPage(pp);
      setRate(data.rate ?? null);
      // Move focus and ensure results are in view for keyboard users
      setTimeout(() => {
        resultsHeadingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    } catch (e: any) {
      setError(e.message || "Unknown error");
      setItems([]);
      setPageInfo({});
    } finally {
      setLoading(false);
    }
  }

  const onSubmit = async (values: FormValues) => {
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
      const exportFormat = exportFormatRef.current?.value === "csv" ? "csv" : "json";
       // Use local export API to also persist to stars.json or stars.csv
       const res = await fetch("/api/export", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ username: user, format: exportFormat }),
       });
       const data = await res.json();
       if (!res.ok) {
         setError(data.error || "Export failed");
         return;
       }

       // Now fetch and display all pages from /api/starred
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
     } catch (e: any) {
       setError(e.message || "Unknown error");
     } finally {
       setLoadingAll(false);
     }
   };

  const handleExport = async () => {
    const user = currentUser ?? getValues("username");
    if (!user) return;
    setExporting(true);
    setError(null);
    try {
      const format = exportFormatRef.current?.value === "csv" ? "csv" : "json";
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
      // Optionally, we could show a success message. For now, we keep UI minimal.
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setExporting(false);
    }
  };

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

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2 mb-4" aria-label="Search starred repositories">
        <div className="flex-1 min-w-64">
          <Input placeholder="Enter GitHub username" aria-label="GitHub username" {...register("username")} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600" htmlFor="perPage">Per page</label>
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
        <Button type="submit" variant="secondary" disabled={loading || loadingAll} aria-disabled={loading || loadingAll} aria-busy={loading}>
          {loading ? "Loading..." : "Search"}
        </Button>
        <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="export-format" className="sr-only">Export format</label>
        <select
        id="export-format"
        ref={exportFormatRef}
        defaultValue="json"
        className="min-w-[8rem] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
        aria-label="Export format"
        >
        <option value="json">JSON</option>
        <option value="csv">CSV</option>
        </select>
        
        <Button
        type="button"
        variant="secondary"
        onClick={handleExport}
        disabled={loading || loadingAll || exporting}
        aria-disabled={loading || loadingAll || exporting}
        aria-busy={exporting}
        title="Export starred repositories to the selected format"
        >
        {exporting ? "Exporting..." : "Export"}
        </Button>
        
        <Button
        type="button"
        variant="secondary"
        onClick={handleFetchAll}
        disabled={loading || loadingAll}
        aria-disabled={loading || loadingAll}
        aria-busy={loadingAll}
        title="Export using the selected format and load all pages"
        >
        {loadingAll ? "Loading all..." : "Fetch All"}
        </Button>
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
          <p className="text-sm text-gray-600 mb-2" aria-live="polite">
            Showing {(page - 1) * perPage + 1}
            –
            {(page - 1) * perPage + items.length}
          </p>
          <ul ref={listRef} className="space-y-3" aria-busy={loading} aria-labelledby="results-heading">
            {items.map((r) => (
              <li key={r.id} className="rounded border p-4 hover:bg-gray-50 transition">
                <div className="flex items-center gap-3">
                  <img src={r.owner.avatarUrl} alt={`${r.owner.login} avatar`} className="w-8 h-8 rounded-full" />
                  <div className="flex-1 min-w-0">
                    <a className="font-medium hover:underline break-words" href={r.url} target="_blank" rel="noreferrer">
                      {r.fullName}
                    </a>
                    {r.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">{r.description}</p>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 whitespace-nowrap">
                    ⭐ {r.stars} {r.language && <span className="ml-2">• {r.language}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
