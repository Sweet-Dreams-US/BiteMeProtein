"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";
import { CONTENT_SCHEMA, type ContentKeySpec } from "@/lib/cms-schema";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Row {
  key: string;
  value: unknown;
  updated_at: string;
}

function toEditorString(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function parseEditorValue(type: ContentKeySpec["type"], raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  if (type === "text" || type === "textarea") {
    return { ok: true, value: raw };
  }
  if (type === "json") {
    if (raw.trim() === "") return { ok: true, value: null };
    try {
      return { ok: true, value: JSON.parse(raw) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Invalid JSON" };
    }
  }
  return { ok: true, value: raw };
}

export default function AdminContent() {
  const [rowByKey, setRowByKey] = useState<Record<string, Row>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await adminFetch("/api/admin/content");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      const map: Record<string, Row> = {};
      const newDrafts: Record<string, string> = {};
      for (const row of json.rows ?? []) {
        map[row.key] = row;
        newDrafts[row.key] = toEditorString(row.value);
      }
      setRowByKey(map);
      setDrafts(newDrafts);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (spec: ContentKeySpec) => {
    setErrors((prev) => ({ ...prev, [spec.key]: "" }));
    const raw = drafts[spec.key] ?? "";
    const parsed = parseEditorValue(spec.type, raw);
    if (!parsed.ok) {
      setErrors((prev) => ({ ...prev, [spec.key]: parsed.error }));
      return;
    }
    setSaving(spec.key);
    try {
      const res = await adminFetch("/api/admin/content", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: spec.key, value: parsed.value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      await load();
    } catch (err) {
      setErrors((prev) => ({ ...prev, [spec.key]: err instanceof Error ? err.message : "Save failed" }));
    }
    setSaving(null);
  };

  const clear = async (spec: ContentKeySpec) => {
    if (!confirm(`Delete override for ${spec.key}? The page will fall back to the built-in default.`)) return;
    setSaving(spec.key);
    try {
      const res = await adminFetch(`/api/admin/content?key=${encodeURIComponent(spec.key)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Delete failed");
      }
      setDrafts((prev) => ({ ...prev, [spec.key]: "" }));
      await load();
    } catch (err) {
      setErrors((prev) => ({ ...prev, [spec.key]: err instanceof Error ? err.message : "Delete failed" }));
    }
    setSaving(null);
  };

  const isOverridden = (key: string) => Boolean(rowByKey[key]);
  const hasChanges = (key: string): boolean => {
    const draft = drafts[key] ?? "";
    const saved = rowByKey[key] ? toEditorString(rowByKey[key].value) : "";
    return draft !== saved;
  };

  const flatKeyCount = useMemo(() => CONTENT_SCHEMA.reduce((acc, g) => acc + g.keys.length, 0), []);
  const overrideCount = Object.keys(rowByKey).length;

  const inputClass =
    "w-full bg-[#FFF9F4] border border-[#e8ddd4] rounded-xl px-3 py-2 text-[#5a3e36] text-sm placeholder:text-[#c4b5aa] focus:border-[#E8A0BF] focus:ring-1 focus:ring-[#E8A0BF] focus:outline-none";

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#5a3e36]">Site content</h1>
        <p className="text-[#b0a098] text-sm mt-1">
          Edit copy that appears on the public site. Empty fields fall back to the built-in defaults.
          {" "}<span className="text-[#5a3e36] font-medium">{overrideCount}</span> of {flatKeyCount} keys overridden.
        </p>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-500 text-sm rounded-xl p-3 mb-4">{loadError}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#E8A0BF] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-8">
          {CONTENT_SCHEMA.map((group) => (
            <section key={group.title} className="bg-white rounded-2xl border border-[#f0e6de] shadow-sm p-6">
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-[#5a3e36]">{group.title}</h2>
                {group.description && <p className="text-[#b0a098] text-sm mt-1">{group.description}</p>}
              </div>

              <div className="space-y-5">
                {group.keys.map((spec) => (
                  <div key={spec.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[#7a6a62] text-xs font-semibold uppercase tracking-wider">
                        {spec.label}
                        <code className="ml-2 font-mono text-[10px] text-[#b0a098] normal-case">{spec.key}</code>
                      </label>
                      <span className="flex items-center gap-2">
                        {isOverridden(spec.key) && (
                          <span className="inline-flex items-center text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
                            OVERRIDE
                          </span>
                        )}
                      </span>
                    </div>

                    {spec.type === "text" && (
                      <input
                        type="text"
                        value={drafts[spec.key] ?? ""}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [spec.key]: e.target.value }))}
                        className={inputClass}
                        placeholder="(uses default — type to override)"
                      />
                    )}

                    {spec.type === "textarea" && (
                      <textarea
                        rows={4}
                        value={drafts[spec.key] ?? ""}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [spec.key]: e.target.value }))}
                        className={inputClass + " font-normal"}
                        placeholder="(uses default — type to override)"
                      />
                    )}

                    {spec.type === "json" && (
                      <>
                        <textarea
                          rows={8}
                          value={drafts[spec.key] ?? ""}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [spec.key]: e.target.value }))}
                          className={inputClass + " font-mono text-xs"}
                          placeholder={spec.hint ?? "(valid JSON — array or object)"}
                        />
                        {spec.hint && <p className="text-[#b0a098] text-[11px] mt-1 font-mono">{spec.hint}</p>}
                      </>
                    )}

                    {errors[spec.key] && (
                      <p className="text-red-500 text-xs mt-1">{errors[spec.key]}</p>
                    )}

                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => save(spec)}
                        disabled={saving === spec.key || !hasChanges(spec.key)}
                        className="px-4 py-1.5 text-xs font-semibold bg-[#E8A0BF] text-white rounded-lg hover:bg-[#d889ad] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {saving === spec.key ? "Saving…" : "Save"}
                      </button>
                      {isOverridden(spec.key) && (
                        <button
                          onClick={() => clear(spec)}
                          disabled={saving === spec.key}
                          className="px-4 py-1.5 text-xs font-semibold text-[#b0a098] hover:text-red-500 transition-colors"
                        >
                          Reset to default
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
