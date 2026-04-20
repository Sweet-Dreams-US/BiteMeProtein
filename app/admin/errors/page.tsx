"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { adminFetch } from "@/lib/admin-fetch";
import { useRouter } from "next/navigation";

interface ErrorRow {
  id: string;
  created_at: string;
  level: "error" | "warn" | "info";
  source: "api-route" | "lib" | "client" | "webhook";
  path: string;
  message: string;
  stack: string | null;
  context: Record<string, unknown> | null;
  user_id: string | null;
  request_id: string | null;
}

const SINCE_OPTIONS = ["7d", "30d", "90d", "all"] as const;
const LEVEL_OPTIONS = ["", "error", "warn", "info"] as const;
const SOURCE_OPTIONS = ["", "api-route", "lib", "client", "webhook"] as const;

const levelBadge: Record<string, string> = {
  error: "bg-red-50 text-red-700 border-red-200",
  warn: "bg-amber-50 text-amber-700 border-amber-200",
  info: "bg-blue-50 text-blue-700 border-blue-200",
};

export default function AdminErrorsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [rows, setRows] = useState<ErrorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [level, setLevel] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [since, setSince] = useState<(typeof SINCE_OPTIONS)[number]>("7d");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");

  // Debounce search input (300ms)
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Auth gate
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        router.replace("/admin/login");
        return;
      }
      setAuthChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (level) params.set("level", level);
    if (source) params.set("source", source);
    if (since) params.set("since", since);
    if (qDebounced) params.set("q", qDebounced);
    return params.toString();
  }, [level, source, since, qDebounced]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/admin/errors?${queryString}`);
      const json = await res.json();
      if (res.ok) {
        setRows(json.rows ?? []);
      } else {
        setRows([]);
      }
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    if (!authChecked) return;
    load();
  }, [authChecked, load]);

  if (!authChecked) {
    return (
      <div className="max-w-5xl p-6">
        <p className="text-[#b0a098] text-sm">Checking session…</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#5a3e36]">Error logs</h1>
          <p className="text-[#b0a098] text-sm mt-1">
            Every failure from fire-and-forget flows, API routes, and lib helpers. Sorted newest first.
          </p>
        </div>
        <button
          onClick={load}
          className="shrink-0 px-4 py-2 text-sm font-medium text-[#843430] border-2 border-[#843430] rounded-full hover:bg-[#843430] hover:text-white transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="search"
          placeholder="Search message or path…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2 text-sm bg-white border border-[#f0e6de] rounded-xl focus:outline-none focus:border-[#843430]"
        />
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="px-3 py-2 text-sm bg-white border border-[#f0e6de] rounded-xl"
          aria-label="Filter by level"
        >
          {LEVEL_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt || "All levels"}</option>
          ))}
        </select>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="px-3 py-2 text-sm bg-white border border-[#f0e6de] rounded-xl"
          aria-label="Filter by source"
        >
          {SOURCE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt || "All sources"}</option>
          ))}
        </select>
        <select
          value={since}
          onChange={(e) => setSince(e.target.value as typeof since)}
          className="px-3 py-2 text-sm bg-white border border-[#f0e6de] rounded-xl"
          aria-label="Filter by time window"
        >
          {SINCE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt === "all" ? "All time" : `Last ${opt}`}
            </option>
          ))}
        </select>
      </div>

      {/* Rows */}
      {loading ? (
        <div className="bg-white border border-[#f0e6de] rounded-2xl p-8 text-center text-[#b0a098] text-sm">
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-[#f0e6de] rounded-2xl p-8 text-center">
          <p className="text-[#5a3e36] font-medium">No errors in this range. 🎉</p>
          <p className="text-[#b0a098] text-sm mt-1">
            {qDebounced || level || source
              ? "Try widening the filters, or check a longer time window."
              : "Fire-and-forget flows, API routes, and lib helpers are running clean."}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[#f0e6de] rounded-2xl overflow-hidden">
          <ul className="divide-y divide-[#f0e6de]">
            {rows.map((row) => {
              const isOpen = expanded === row.id;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : row.id)}
                    className="w-full text-left px-5 py-4 hover:bg-[#FFF9F0] transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`shrink-0 inline-flex items-center px-2 py-0.5 text-[11px] font-bold uppercase rounded border ${
                          levelBadge[row.level] ?? "bg-neutral-100 text-neutral-700 border-neutral-200"
                        }`}
                      >
                        {row.level}
                      </span>
                      <span className="shrink-0 text-xs text-[#b0a098] font-mono">{row.source}</span>
                      <span className="shrink-0 text-xs text-[#b0a098] font-mono truncate">{row.path}</span>
                      <span className="flex-1 min-w-0 text-sm text-[#5a3e36] truncate">{row.message}</span>
                      <span className="shrink-0 text-xs text-[#b0a098]">
                        {new Date(row.created_at).toLocaleString()}
                      </span>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 bg-[#FFF9F0]">
                      {row.stack && (
                        <>
                          <p className="text-xs font-semibold text-[#843430] mt-3 mb-1">Stack</p>
                          <pre className="text-xs font-mono text-[#5a3e36] whitespace-pre-wrap overflow-x-auto bg-white p-3 rounded-lg border border-[#f0e6de]">
                            {row.stack}
                          </pre>
                        </>
                      )}
                      {row.context && (
                        <>
                          <p className="text-xs font-semibold text-[#843430] mt-3 mb-1">Context</p>
                          <pre className="text-xs font-mono text-[#5a3e36] whitespace-pre-wrap overflow-x-auto bg-white p-3 rounded-lg border border-[#f0e6de]">
                            {JSON.stringify(row.context, null, 2)}
                          </pre>
                        </>
                      )}
                      <div className="mt-3 flex flex-wrap gap-4 text-xs text-[#b0a098]">
                        <span>id: <code className="font-mono">{row.id}</code></span>
                        {row.user_id && <span>user: <code className="font-mono">{row.user_id}</code></span>}
                        {row.request_id && <span>req: <code className="font-mono">{row.request_id}</code></span>}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
