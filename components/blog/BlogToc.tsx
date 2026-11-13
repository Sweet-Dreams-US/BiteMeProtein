"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Heading {
  id: string;
  text: string;
}

interface BlogTocProps {
  headings: Heading[];
  /** id of the element that wraps the whole post, used to measure reading progress. */
  articleId: string;
}

/**
 * Table of contents for a post, built from its `##` headings.
 *  - Wide screens: a small panel pinned to the bottom right corner.
 *  - Phones and tablets: a bar fixed to the bottom with the current section and an
 *    arrow that opens the full list. Tapping a section jumps to it and closes the list.
 * Both show reading progress and mark the section being read.
 */
export default function BlogToc({ headings, articleId }: BlogTocProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const frame = useRef<number | null>(null);

  const measure = useCallback(() => {
    frame.current = null;
    const article = document.getElementById(articleId);
    if (!article) return;
    const vh = window.innerHeight;
    const rect = article.getBoundingClientRect();

    const p = Math.min(1, Math.max(0, (vh * 0.4 - rect.top) / Math.max(rect.height, 1)));
    setProgress(Math.round(p * 100));
    setVisible(rect.top < vh * 0.75 && rect.bottom > vh * 0.55);

    let current: string | null = null;
    for (const h of headings) {
      const el = document.getElementById(h.id);
      if (!el) continue;
      if (el.getBoundingClientRect().top <= vh * 0.3) current = h.id;
      else break;
    }
    if (p >= 0.98 && headings.length) current = headings[headings.length - 1].id;
    setActiveId(current);
  }, [articleId, headings]);

  useEffect(() => {
    const schedule = () => {
      if (frame.current === null) frame.current = window.requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    };
  }, [measure]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!visible) setOpen(false);
  }, [visible]);

  const jump = (event: React.MouseEvent, id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    event.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setOpen(false);
  };

  if (headings.length === 0) return null;

  const activeIndex = headings.findIndex((h) => h.id === activeId);
  const activeHeading = activeIndex >= 0 ? headings[activeIndex] : null;

  return (
    <>
      {/* ===== Wide screens: corner panel ===== */}
      <nav
        aria-label="Table of contents"
        className={`hidden xl:block fixed bottom-6 right-6 z-40 w-64 rounded-3xl border border-burgundy/10 bg-white/95 backdrop-blur-md p-5 shadow-[0_8px_30px_rgba(132,52,48,0.12)] transition-all duration-300 print:hidden ${
          visible ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-4"
        }`}
      >
        <p className="text-burgundy text-[0.7rem] font-extrabold uppercase tracking-widest">In this post</p>
        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-cream-dark"
          role="progressbar"
          aria-label="Reading progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-salmon to-burgundy transition-[width] duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-1.5 text-[0.7rem] font-semibold text-dark/40">{progress}% read</p>
        <ol className="mt-3 flex max-h-[calc(100vh-17rem)] flex-col gap-0.5 overflow-y-auto pr-1">
          {headings.map((h) => {
            const active = h.id === activeId;
            return (
              <li key={h.id}>
                <a
                  href={`#${h.id}`}
                  onClick={(e) => jump(e, h.id)}
                  aria-current={active ? "location" : undefined}
                  className={`flex items-start gap-2 rounded-xl px-2 py-1.5 text-[0.8125rem] leading-snug transition-colors ${
                    active
                      ? "bg-salmon/20 font-bold text-burgundy"
                      : "font-medium text-dark/60 hover:bg-cream hover:text-burgundy"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-[0.35rem] h-2 w-2 shrink-0 rounded-full ${active ? "bg-burgundy" : "bg-dark/15"}`}
                  />
                  <span>{h.text}</span>
                </a>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* ===== Phones and tablets: bar fixed to the bottom ===== */}
      {open ? (
        <button
          type="button"
          aria-label="Close contents"
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className="xl:hidden fixed inset-0 z-[39] bg-dark/25 print:hidden"
        />
      ) : null}
      <div
        className={`xl:hidden fixed inset-x-0 bottom-0 z-40 transition-all duration-300 print:hidden ${
          visible ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-full"
        }`}
      >
        {open ? (
          <nav
            id="blog-toc-list"
            aria-label="Table of contents"
            className="mx-3 mb-2 max-h-[55vh] overflow-y-auto rounded-3xl border border-burgundy/10 bg-white p-3 shadow-[0_-8px_30px_rgba(132,52,48,0.15)]"
          >
            <ol className="flex flex-col gap-0.5">
              {headings.map((h) => {
                const active = h.id === activeId;
                return (
                  <li key={h.id}>
                    <a
                      href={`#${h.id}`}
                      onClick={(e) => jump(e, h.id)}
                      aria-current={active ? "location" : undefined}
                      className={`flex items-start gap-3 rounded-2xl px-3 py-3 text-[0.9375rem] leading-snug ${
                        active ? "bg-salmon/20 font-bold text-burgundy" : "font-medium text-dark/70"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-[0.4rem] h-2 w-2 shrink-0 rounded-full ${active ? "bg-burgundy" : "bg-dark/15"}`}
                      />
                      <span>{h.text}</span>
                    </a>
                  </li>
                );
              })}
            </ol>
          </nav>
        ) : null}

        <div className="border-t border-burgundy/10 bg-white/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(132,52,48,0.08)] pb-[env(safe-area-inset-bottom)]">
          <div
            className="h-[3px] w-full bg-cream-dark"
            role="progressbar"
            aria-label="Reading progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div
              className="h-full bg-gradient-to-r from-salmon to-burgundy transition-[width] duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="blog-toc-list"
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[0.65rem] font-bold uppercase tracking-widest text-dark/40">
                {activeHeading ? `Section ${activeIndex + 1} of ${headings.length}` : "In this post"}
                {" · "}
                {progress}% read
              </span>
              <span className="block truncate text-sm font-bold text-burgundy">
                {activeHeading ? activeHeading.text : "Contents"}
              </span>
            </span>
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-burgundy text-white"
            >
              <svg
                viewBox="0 0 20 20"
                className={`h-4 w-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 12l6-6 6 6" />
              </svg>
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
