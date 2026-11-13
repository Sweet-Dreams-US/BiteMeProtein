import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Blog release gate. A post that is not due yet, or does not exist, must
 * answer with a real HTTP 404.
 *
 * The app has a root loading.tsx, so a page that calls notFound() while it
 * renders streams with status 200 (Next.js cannot change the status once
 * streaming has started). Checking here, before anything renders, is the
 * approach the Next.js docs recommend for a true 404.
 *
 * BLOG_RELEASE_DATES is a { slug: release_on } list written into the build by
 * next.config.ts from content/blog. It is compared with today's date in Fort
 * Wayne time on every request, so a post opens on its date with no new deploy.
 */

const TIME_ZONE = "America/Indiana/Indianapolis";

let releases: Record<string, string> = {};
try {
  releases = JSON.parse(process.env.BLOG_RELEASE_DATES || "{}");
} catch {
  releases = {};
}

function todayInFortWayne(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function proxy(request: NextRequest) {
  const match = request.nextUrl.pathname.match(/^\/blog\/([^/]+)\/?$/);
  if (!match || match[1] === "rss.xml") return NextResponse.next();

  let slug = match[1];
  try {
    slug = decodeURIComponent(slug);
  } catch {
    // keep the raw segment, it will not match a post
  }

  const releaseOn = Object.prototype.hasOwnProperty.call(releases, slug) ? releases[slug] : undefined;
  if (releaseOn && releaseOn <= todayInFortWayne()) return NextResponse.next();

  // No route matches this path, so the router answers 404 and shows the site's own not-found page.
  return NextResponse.rewrite(new URL("/blog-post-not-available", request.url));
}

export const config = {
  matcher: ["/blog/:slug"],
};
