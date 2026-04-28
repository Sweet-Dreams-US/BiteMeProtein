/**
 * Names of Square catalog items that exist purely as POS-side bundle SKUs.
 * Cashiers ring these up at the counter when a customer wants
 * "2 brownies for $10" — they're not real products with real images, just
 * pricing shortcuts.
 *
 * Two consumers today:
 *   1. /api/bestsellers — filters these out so the homepage "Your new
 *      addiction" carousel never shows a gradient placeholder where a
 *      real product card should be.
 *   2. /admin/products — groups these into a "Combos & Bundles" section
 *      separate from individual products, so Haley can manage them
 *      without scrolling past them when looking for, say, the brownies.
 *
 * Adding a new bundle name to Square? Add it here too, then redeploy.
 * Long-term: a `square_products.is_bundle` column would be cleaner, but
 * Square doesn't expose that natively, so a hardcoded list is honest.
 */
export const POS_ONLY_BUNDLE_NAMES: ReadonlySet<string> = new Set([
  "Trainer Deal",
  "2 For 10",
  "3 For 20",
  "2 For 15",
  "5 For 25",
  "Custom Amount",
  "Tip",
]);

/** Convenience predicate. Case-sensitive — matches Square exactly. */
export function isPosBundle(name: string | null | undefined): boolean {
  return !!name && POS_ONLY_BUNDLE_NAMES.has(name);
}
