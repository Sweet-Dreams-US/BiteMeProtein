import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/log-error", () => ({
  logError: vi.fn().mockResolvedValue(undefined),
}));

import { createShipment, buyLabel, getShipment, priceCents, SHIP_FROM } from "./easypost";

/* eslint-disable @typescript-eslint/no-explicit-any */

describe("lib/easypost", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("EASYPOST_API_KEY", "test-ep-key");
  });

  describe("priceCents", () => {
    it("converts EasyPost decimal-string rate to integer cents", () => {
      // EasyPost rates come as JSON strings like "12.34" — we always
      // store cents internally to dodge floating-point math elsewhere.
      expect(priceCents({ rate: "12.34" } as any)).toBe(1234);
      expect(priceCents({ rate: "0.99" } as any)).toBe(99);
      expect(priceCents({ rate: "100" } as any)).toBe(10000);
    });
  });

  describe("createShipment", () => {
    it("posts to /shipments with from + to + parcel + reference", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ id: "shp_1", rates: [], status: "unknown" }),
      });

      await createShipment({
        to: { street1: "1 Main", city: "X", state: "CA", zip: "94000", country: "US" },
        parcel: { length: 8, width: 6, height: 4, weight: 16 },
        reference: "ORDER_123",
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.easypost.com/v2/shipments");
      expect(init.method).toBe("POST");
      // Basic auth header — base64("test-ep-key:")
      expect(init.headers.Authorization).toBe(
        `Basic ${Buffer.from("test-ep-key:").toString("base64")}`,
      );
      const body = JSON.parse(init.body);
      // SHIP_FROM is hard-coded to the bakery; verify the request carries it.
      expect(body.shipment.from_address).toEqual(SHIP_FROM);
      expect(body.shipment.reference).toBe("ORDER_123");
      expect(body.shipment.parcel.weight).toBe(16);
    });

    it("forwards carrier_accounts when provided", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ id: "shp_2", rates: [], status: "unknown" }),
      });
      await createShipment({
        to: { street1: "1 Main", city: "X", state: "CA", zip: "94000", country: "US" },
        parcel: { length: 1, width: 1, height: 1, weight: 1 },
        reference: "ORDER_456",
        carrierAccounts: ["ca_1", "ca_2"],
      });
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.shipment.carrier_accounts).toEqual(["ca_1", "ca_2"]);
    });

    it("throws with the EasyPost error message when the API returns non-OK", async () => {
      // EasyPost error envelope: { error: { message, code, errors } }
      fetchMock.mockResolvedValue({
        ok: false,
        status: 422,
        text: async () => JSON.stringify({ error: { message: "to_address invalid" } }),
      });
      await expect(
        createShipment({
          to: { street1: "", city: "", state: "", zip: "", country: "US" },
          parcel: { length: 1, width: 1, height: 1, weight: 1 },
          reference: "ORDER_X",
        }),
      ).rejects.toThrow(/EasyPost 422.*to_address invalid/);
    });

    it("throws clearly when EASYPOST_API_KEY is unset", async () => {
      vi.stubEnv("EASYPOST_API_KEY", "");
      await expect(
        createShipment({
          to: { street1: "1", city: "X", state: "CA", zip: "94000", country: "US" },
          parcel: { length: 1, width: 1, height: 1, weight: 1 },
          reference: "ORDER_X",
        }),
      ).rejects.toThrow(/EASYPOST_API_KEY missing/);
      // No fetch should fire when the key is missing — fail fast.
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("buyLabel", () => {
    it("posts to /shipments/{id}/buy with the rate id", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: "shp_1",
          tracking_code: "TRK123",
          status: "purchased",
          rates: [],
          selected_rate: { id: "rate_99", carrier: "FedEx", service: "Ground", rate: "12.34" },
          postage_label: { label_url: "https://example.com/label.pdf" },
          tracker: { public_url: "https://track.easypost.com/123" },
        }),
      });
      const result = await buyLabel("shp_1", "rate_99");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.easypost.com/v2/shipments/shp_1/buy");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body)).toEqual({ rate: { id: "rate_99" } });
      expect(result.tracking_code).toBe("TRK123");
      expect(result.postage_label?.label_url).toBe("https://example.com/label.pdf");
    });
  });

  describe("getShipment", () => {
    it("GETs /shipments/{id}", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ id: "shp_1", tracking_code: "TRK", rates: [], status: "purchased" }),
      });
      await getShipment("shp_1");
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.easypost.com/v2/shipments/shp_1");
      expect(init.method).toBe("GET");
      // GETs should never carry a body
      expect(init.body).toBeUndefined();
    });
  });
});
