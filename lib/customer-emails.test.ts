import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/log-error", () => ({
  logError: vi.fn().mockResolvedValue(undefined),
}));

import {
  sendOrderConfirmation,
  sendOrderPreparing,
  sendOrderShipped,
  sendOrderDelivered,
  sendCustomerEmail,
  carrierTrackingUrl,
  type OrderEmailData,
} from "./customer-emails";

const baseData: OrderEmailData = {
  orderId: "SQUARE_ORD_1",
  shortId: "ORD001",
  buyerEmail: "customer@example.com",
  buyerName: "Test Customer",
  totalCents: 3899,
  orderType: "shipping",
  items: [
    { name: "Protein Brownie", quantity: 6, priceCents: 3899 },
  ],
  trackUrl: "https://bitemeprotein.com/track?id=SQUARE_ORD_1&email=customer@example.com",
};

// Stub fetch globally — resend endpoint is called via global fetch
const fetchMock = vi.fn();

describe("lib/customer-emails", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("RESEND_API_KEY", "test-resend-key");
    vi.stubEnv("RESEND_FROM_EMAIL", "orders@bitemeprotein.com");
    vi.stubEnv("ADMIN_NOTIFICATION_EMAIL", "haley@bitemeprotein.com");
  });

  describe("sendOrderConfirmation", () => {
    it("sends to the buyer email with the confirmation subject", async () => {
      await sendOrderConfirmation(baseData);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.resend.com/emails");
      const body = JSON.parse((init as { body: string }).body);
      expect(body.to).toEqual(["customer@example.com"]);
      expect(body.subject).toContain("confirmed");
      expect(body.subject).toContain("#ORD001");
      expect(body.from).toContain("Bite Me");
      expect(body.reply_to).toBe("haley@bitemeprotein.com");
    });

    it("skips silently when buyerEmail is missing", async () => {
      await sendOrderConfirmation({ ...baseData, buyerEmail: "" });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("shows a pickup-specific body for pickup orders", async () => {
      await sendOrderConfirmation({ ...baseData, orderType: "pickup" });
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.html).toContain("pickup");
    });
  });

  describe("sendOrderPreparing", () => {
    it("uses the preparing subject + template", async () => {
      await sendOrderPreparing(baseData);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.subject).toContain("baking");
      expect(body.html).toContain("kitchen");
    });
  });

  describe("sendOrderShipped", () => {
    it("embeds carrier + tracking link when provided", async () => {
      await sendOrderShipped({
        ...baseData,
        carrier: "FedEx",
        trackingNumber: "123456789012",
        trackingUrl: "https://www.fedex.com/fedextrack/?trknbr=123456789012",
      });
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.html).toContain("123456789012");
      expect(body.html).toContain("fedex.com");
    });

    it("still sends when no tracking info is available (falls back to /track)", async () => {
      await sendOrderShipped(baseData);
      expect(fetchMock).toHaveBeenCalled();
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.html).toContain(baseData.trackUrl);
    });
  });

  describe("sendOrderDelivered", () => {
    it("points the CTA at /shop (repeat-purchase nudge)", async () => {
      await sendOrderDelivered(baseData);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.html).toContain("/shop");
    });
  });

  describe("Resend failure handling (never throws)", () => {
    it("doesn't throw when Resend returns a non-ok status", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => "oops" });
      await expect(sendOrderConfirmation(baseData)).resolves.toBeUndefined();
    });

    it("doesn't throw when fetch itself throws", async () => {
      fetchMock.mockRejectedValue(new Error("network dead"));
      await expect(sendOrderConfirmation(baseData)).resolves.toBeUndefined();
    });

    it("skips + warn-logs when RESEND_API_KEY is missing", async () => {
      vi.stubEnv("RESEND_API_KEY", "");
      await sendOrderConfirmation(baseData);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("sendCustomerEmail dispatcher", () => {
    it("routes each type to the right sender", async () => {
      await sendCustomerEmail("confirmation", baseData);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).subject).toContain("confirmed");
      fetchMock.mockClear();

      await sendCustomerEmail("preparing", baseData);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).subject).toContain("baking");
      fetchMock.mockClear();

      await sendCustomerEmail("shipped", baseData);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).subject).toContain("on the way");
      fetchMock.mockClear();

      await sendCustomerEmail("delivered", baseData);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).subject).toContain("arrived");
    });
  });

  describe("carrierTrackingUrl", () => {
    it("returns deep-links for known carriers", () => {
      expect(carrierTrackingUrl("FedEx", "123")).toBe("https://www.fedex.com/fedextrack/?trknbr=123");
      expect(carrierTrackingUrl("UPS", "abc")).toBe("https://www.ups.com/track?tracknum=abc");
      expect(carrierTrackingUrl("USPS", "9400")).toBe("https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=9400");
      expect(carrierTrackingUrl("DHL", "JD001")).toBe("https://www.dhl.com/en/express/tracking.html?AWB=JD001");
    });

    it("is case-insensitive on carrier", () => {
      expect(carrierTrackingUrl("fedex", "1")).toBe("https://www.fedex.com/fedextrack/?trknbr=1");
      expect(carrierTrackingUrl("ups", "1")).toBe("https://www.ups.com/track?tracknum=1");
    });

    it("returns null for unknown carriers or missing tracking", () => {
      expect(carrierTrackingUrl("Unknown", "123")).toBeNull();
      expect(carrierTrackingUrl("FedEx", null)).toBeNull();
      expect(carrierTrackingUrl(null, "123")).toBeNull();
    });

    it("URL-encodes tracking numbers", () => {
      expect(carrierTrackingUrl("FedEx", "abc 123")).toContain("abc%20123");
    });
  });
});
