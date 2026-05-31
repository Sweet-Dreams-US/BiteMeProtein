/**
 * Customer-facing feature flags. Read at render time on the public pages
 * so flipping a value here + redeploying changes the customer experience
 * without any DB or env-var work.
 *
 * Admin-only flows are NOT gated on these flags — admins still see + edit
 * shipping orders, bundle metadata, FedEx settings, etc. So flipping a
 * flag back to true exposes the full feature instantly without any code
 * changes elsewhere.
 */

/**
 * Whether customers can choose Shipping (FedEx) at checkout. When false:
 *   - The Pickup / Shipping toggle on /checkout is hidden; pickup is forced.
 *   - "Ships ✓" badges on bundle cards in /shop are hidden.
 *   - Shipping address + FedEx rate fetch are skipped entirely.
 *   - The PICKUP_ONLY_NOTE below renders on shop + checkout so customers
 *     know local delivery and nationwide shipping are on the roadmap.
 *
 * Currently FALSE (2026-05-20 reversion): pulling shipping back to pickup
 * only while we line up the local-delivery + nationwide-shipping rollout.
 * The full pipeline (Square shipping fulfillments, EasyPost label
 * printing, admin order view) stays intact behind the flag — flipping
 * to TRUE re-exposes everything with no other code changes.
 */
export const SHIPPING_ENABLED = false;

/**
 * Customer-facing roadmap note shown on shop + checkout while shipping is
 * disabled. Split into headline + body so callers can style them
 * separately (small banner vs. inline note) without re-writing the copy.
 * Updating either field here updates every render site.
 */
export const PICKUP_ONLY_NOTE = {
  headline: "Pickup only for now",
  body: "Local Miami metro delivery is coming soon, and nationwide shipping is on the way later this summer.",
} as const;
