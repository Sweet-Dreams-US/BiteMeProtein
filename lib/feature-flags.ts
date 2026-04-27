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
 *
 * Re-enable when:
 *   - EasyPost (or another label provider) is wired up so admin can
 *     actually print FedEx labels from the order detail panel, AND
 *   - At least one full end-to-end shipping test order has succeeded
 *     (label printed, customer received tracking, package arrived).
 */
export const SHIPPING_ENABLED = false;
