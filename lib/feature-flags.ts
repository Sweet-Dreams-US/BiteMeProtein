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
 * Currently TRUE: shipping orders flow through normally; admin prints
 * the actual FedEx label from Square Dashboard (deep-link in
 * /admin/orders → Open in Square Dashboard) using all the recipient
 * info we pass through in fulfillments[].shipmentDetails. Once
 * EasyPost API access lands we'll switch to integrated label printing
 * inside our admin without flipping this flag again.
 */
export const SHIPPING_ENABLED = true;
