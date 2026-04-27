/**
 * Minimal EasyPost REST client.
 *
 * We don't use the official @easypost/api SDK because:
 *   1. Three endpoints is cheaper to write than to depend on (no version
 *      drift on launch night).
 *   2. The SDK's response shape uses non-snake-case names that drift from
 *      the live API in ways that have bitten us before (see Square SDK).
 *   3. Direct REST gives us obvious error surfaces — Resend pattern.
 *
 * Auth: HTTP Basic, API key as username, empty password. Yes, it's weird;
 * yes, that's the Stripe-style standard for opinionated REST APIs.
 *
 * Reference docs: https://docs.easypost.com/docs/shipments
 */
import { logError } from "@/lib/log-error";

const EASYPOST_API_BASE = "https://api.easypost.com/v2";

/**
 * The bakery's ship-from address. Hard-coded because there's only one
 * physical bakery; if Bite Me ever opens a second location we'd lift
 * this into env vars. Phone is the public bakery line.
 */
export const SHIP_FROM: EasyPostAddress = {
  name: "Bite Me Protein Bakery",
  street1: "953 E Oakland Park Blvd",
  city: "Oakland Park",
  state: "FL",
  zip: "33334",
  country: "US",
  phone: "9546044127",
  email: "haley@bitemeprotein.com",
};

// ── Types ───────────────────────────────────────────────────────────────────

export interface EasyPostAddress {
  name?: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
  email?: string;
}

export interface EasyPostParcel {
  /** Inches */
  length: number;
  /** Inches */
  width: number;
  /** Inches */
  height: number;
  /** Ounces */
  weight: number;
}

export interface EasyPostRate {
  id: string;
  carrier: string;
  service: string;
  /** USD price as a string from EasyPost — e.g. "12.34". Convert with priceCents. */
  rate: string;
  delivery_days: number | null;
  delivery_date: string | null;
  delivery_date_guaranteed: boolean;
}

export interface EasyPostShipment {
  id: string;
  tracking_code: string | null;
  status: string;
  rates: EasyPostRate[];
  selected_rate: EasyPostRate | null;
  postage_label: { label_url: string } | null;
  tracker: { public_url: string | null } | null;
  reference: string | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** EasyPost rates come as decimal strings; we store cents internally. */
export function priceCents(rate: EasyPostRate): number {
  return Math.round(parseFloat(rate.rate) * 100);
}

function authHeader(): string {
  const key = process.env.EASYPOST_API_KEY?.trim();
  if (!key) {
    throw new Error("EASYPOST_API_KEY missing — add it in Vercel env vars.");
  }
  // Basic auth — username = key, password = empty.
  const token = Buffer.from(`${key}:`).toString("base64");
  return `Basic ${token}`;
}

async function easypost<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<T> {
  const res = await fetch(`${EASYPOST_API_BASE}${path}`, {
    method: init.method,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  // EasyPost returns errors in { error: { message, code, errors } } shape.
  // Surface them with status code so callers can distinguish auth (401)
  // from validation (422) without parsing the body twice.
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      // Non-JSON error body — keep the raw text in the message.
    }
    const err = new Error(`EasyPost ${res.status}: ${message}`);
    await logError(err, {
      path: `lib/easypost.ts:${path}`,
      source: "lib",
      context: { status: res.status, body: text.slice(0, 500) },
    });
    throw err;
  }

  return res.json() as Promise<T>;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a shipment + fetch rates in one call. EasyPost auto-verifies
 * addresses on create; if `to` is undeliverable the API returns 422 with
 * a clear message and we surface it.
 *
 * `reference` is the customer-facing identifier we want to see in the
 * EasyPost dashboard / webhooks — pass the Square order ID.
 */
export async function createShipment(input: {
  to: EasyPostAddress;
  parcel: EasyPostParcel;
  reference: string;
  /** Optional carrier filter — e.g. ["FedEx", "USPS"]. Default: all. */
  carrierAccounts?: string[];
}): Promise<EasyPostShipment> {
  const body: Record<string, unknown> = {
    shipment: {
      to_address: input.to,
      from_address: SHIP_FROM,
      parcel: input.parcel,
      reference: input.reference,
    },
  };
  if (input.carrierAccounts?.length) {
    (body.shipment as Record<string, unknown>).carrier_accounts =
      input.carrierAccounts;
  }
  return easypost<EasyPostShipment>("/shipments", {
    method: "POST",
    body,
  });
}

/**
 * Buy a specific rate, which generates the postage label. Returns the
 * shipment with `tracking_code` and `postage_label.label_url` populated.
 */
export async function buyLabel(
  shipmentId: string,
  rateId: string,
): Promise<EasyPostShipment> {
  return easypost<EasyPostShipment>(`/shipments/${shipmentId}/buy`, {
    method: "POST",
    body: { rate: { id: rateId } },
  });
}

/** Re-fetch a shipment by ID. Useful for displaying status post-buy. */
export async function getShipment(shipmentId: string): Promise<EasyPostShipment> {
  return easypost<EasyPostShipment>(`/shipments/${shipmentId}`, { method: "GET" });
}
