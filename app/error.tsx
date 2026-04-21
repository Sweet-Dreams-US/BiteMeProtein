"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Per-route error boundary.
 *
 * Next.js wraps every route in this boundary automatically. If a page or a
 * component below it throws during render (client-side), this fallback UI
 * shows instead of a blank screen.
 *
 * We also fire-and-forget the error to /admin/errors so Haley sees it
 * without the customer having to report anything.
 */

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundary({ error, reset }: Props) {
  useEffect(() => {
    // Client-side logging to admin/errors via a tiny server endpoint.
    // Swallow any logging failure — this boundary must not crash.
    fetch("/api/client-errors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        path: typeof window !== "undefined" ? window.location.pathname : "",
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <section className="min-h-[70vh] flex items-center justify-center px-6 py-20 bg-cream">
      <div className="text-center max-w-md">
        <p className="text-7xl md:text-8xl mb-6">🙈</p>
        <p className="stamp text-burgundy mb-4">Well, that&apos;s awkward</p>
        <h1 className="font-fun text-burgundy text-4xl md:text-5xl mb-4">
          Something burned in the oven.
        </h1>
        <p className="text-dark/60 mb-2">
          We hit an unexpected error. Haley&apos;s been notified.
        </p>
        <p className="text-dark/40 text-xs mb-8">
          Error: {error.message || "Unknown"}
          {error.digest && <span className="block">Ref: {error.digest}</span>}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={reset} className="btn-primary">
            Try again
          </button>
          <Link href="/" className="btn-secondary">
            Back to home
          </Link>
        </div>
      </div>
    </section>
  );
}
