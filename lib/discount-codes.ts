/**
 * Discount-code validation + application.
 *
 * Two callers:
 *   - /api/discounts/validate — customer clicks "Apply" on /checkout. Returns
 *     { valid, amountCents, reason } for UI feedback.
 *   - /api/square/pay — server re-runs validateAndApply at payment time (the
 *     authoritative check) and returns adjusted line items.
 *
 * The same applyDiscount() logic runs both times; the server never trusts
 * the client's claimed discount.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type DiscountType = "per_item_fixed_price" | "percent_off" | "fixed_off";
export type FulfillmentRestriction = "all" | "pickup" | "shipping";
export type ProductScope = "all" | "allowlist";

export interface DiscountCode {
  id: string;
  code: string;
  name: string;
  discount_type: DiscountType;
  amount_cents: number | null;
  percent: number | null;
  fulfillment_restriction: FulfillmentRestriction;
  product_scope: ProductScope;
  allowed_square_product_ids: string[] | null;
  starts_at: string | null;
  ends_at: string | null;
  max_total_uses: number | null;
  max_per_customer: number | null;
  is_active: boolean;
  notes: string | null;
}

export interface CartBundle {
  tierName: string;
  priceCents: number;
  items: { variationId: string; name: string; quantity: number }[];
}

export interface CartItem {
  variationId: string;
  quantity: number;
}

export interface ValidateInput {
  code: string;
  bundles: CartBundle[];
  items: CartItem[];
  orderType: "pickup" | "shipping";
  customerEmail?: string;
}

export type ValidateResult =
  | {
      valid: true;
      discount: DiscountCode;
      amountCentsSaved: number;
      /** Line-item-level adjustments to apply at pay time */
      adjustedBundles: CartBundle[];
      adjustedItems: CartItem[];
      /** Human-readable summary for UI */
      summary: string;
    }
  | {
      valid: false;
      reason: string;
    };

function getServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Look up a code, run ALL validations (active, date window, usage caps,
 * fulfillment, product scope), and compute the adjusted cart + amount
 * saved if the code applies. Never throws — returns a reason on failure.
 */
export async function validateAndApply(input: ValidateInput): Promise<ValidateResult> {
  const trimmed = input.code.trim();
  if (!trimmed) return { valid: false, reason: "No code entered" };

  const supabase = getServiceClient();

  // Fetch by case-insensitive match (citext column).
  const { data, error } = await supabase
    .from("discount_codes")
    .select("*")
    .eq("code", trimmed)
    .maybeSingle();

  if (error) return { valid: false, reason: "Lookup failed. Try again." };
  const discount = data as DiscountCode | null;
  if (!discount) return { valid: false, reason: "Code not found" };

  if (!discount.is_active) return { valid: false, reason: "Code is not currently active" };

  const now = new Date();
  if (discount.starts_at && now < new Date(discount.starts_at)) {
    return { valid: false, reason: "Code is not yet active" };
  }
  if (discount.ends_at && now > new Date(discount.ends_at)) {
    return { valid: false, reason: "Code has expired" };
  }

  // Fulfillment restriction
  if (discount.fulfillment_restriction !== "all" && discount.fulfillment_restriction !== input.orderType) {
    const label = discount.fulfillment_restriction === "pickup" ? "pickup orders" : "shipping orders";
    return { valid: false, reason: `This code is only valid for ${label}` };
  }

  // Usage caps
  if (discount.max_total_uses != null) {
    const { count } = await supabase
      .from("discount_redemptions")
      .select("id", { head: true, count: "exact" })
      .eq("discount_code_id", discount.id);
    if ((count ?? 0) >= discount.max_total_uses) {
      return { valid: false, reason: "Code has reached its usage limit" };
    }
  }

  if (discount.max_per_customer != null && input.customerEmail) {
    const { count } = await supabase
      .from("discount_redemptions")
      .select("id", { head: true, count: "exact" })
      .eq("discount_code_id", discount.id)
      .ilike("customer_email", input.customerEmail);
    if ((count ?? 0) >= discount.max_per_customer) {
      return { valid: false, reason: "You've already used this code the maximum number of times" };
    }
  }

  // Product-scope filter: if allowlist, filter each bundle's items.
  const allowed = new Set(discount.allowed_square_product_ids ?? []);
  const allowsAll = discount.product_scope === "all";
  const bundleQualifies = (b: CartBundle) => allowsAll || b.items.some((i) => allowed.has(i.variationId));

  // Apply per discount type. v1 scope: per_item_fixed_price is fully wired
  // for bundles. percent_off + fixed_off are planned but not applied yet.
  if (discount.discount_type === "per_item_fixed_price") {
    if (discount.amount_cents == null) {
      return { valid: false, reason: "Code misconfigured (missing price)" };
    }
    const perItem = discount.amount_cents;

    let savings = 0;
    const adjustedBundles: CartBundle[] = [];
    for (const b of input.bundles) {
      if (!bundleQualifies(b)) {
        adjustedBundles.push(b);
        continue;
      }
      const totalQty = b.items.reduce((s, i) => s + i.quantity, 0);
      const newPrice = totalQty * perItem;
      savings += Math.max(0, b.priceCents - newPrice);
      adjustedBundles.push({ ...b, priceCents: newPrice });
    }

    if (savings === 0) {
      return {
        valid: false,
        reason: "This code doesn't apply to anything in your cart. Add a bundle to use it.",
      };
    }

    return {
      valid: true,
      discount,
      amountCentsSaved: savings,
      adjustedBundles,
      adjustedItems: input.items, // à la carte items untouched in v1
      summary: `Each bundled item is $${(perItem / 100).toFixed(2)}`,
    };
  }

  // Types supported in schema but not in checkout application yet.
  return {
    valid: false,
    reason:
      "This code type isn't supported at checkout yet. Ask the admin to use a per-item-fixed-price code for now.",
  };
}

/**
 * Record a successful redemption. Called from /api/square/pay AFTER the
 * Square payment succeeds. Fire-and-forget — never throw.
 */
export async function recordRedemption(params: {
  discountCodeId: string;
  squareOrderId: string;
  customerEmail?: string;
  amountCentsSaved: number;
}): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase.from("discount_redemptions").insert({
    discount_code_id: params.discountCodeId,
    square_order_id: params.squareOrderId,
    customer_email: params.customerEmail ?? null,
    amount_cents_saved: params.amountCentsSaved,
  });
  if (error) {
    console.error("[discount-codes] Failed to record redemption:", error.message);
  }
}
