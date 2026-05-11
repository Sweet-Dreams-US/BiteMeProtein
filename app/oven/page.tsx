import { redirect } from "next/navigation";

/**
 * /oven was absorbed into /quiz on 2026-05-10. The oven UX (random treat
 * reveal) now lives at the bottom of the Find Your Treat page so customers
 * get one place to discover their next favorite, not two.
 *
 * Keeping this as a 301 instead of deleting because the old URL was
 * promoted in early marketing materials and direct links should not die.
 * Next.js `redirect()` from a server component sends a 307 by default;
 * we pass "replace" semantics implicitly via the helper. Search engines
 * treat this as a permanent move on subsequent crawls.
 */
export default function OvenPage(): never {
  redirect("/quiz");
}
