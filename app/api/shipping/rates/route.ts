import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/shipping/rates?zip=33411&boxType=Medium%20Box
 *
 * Returns FedEx One Rate shipping options available for the given
 * destination ZIP and box type. Prices come from our fedex_rates table
 * (seeded from the official FedEx One Rate charts). We only return rows
 * where is_offered = true.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const zip = searchParams.get("zip")?.trim() || "";
    const boxType = searchParams.get("boxType")?.trim() || "Medium Box";

    if (!zip || zip.length < 5) {
      return NextResponse.json({ error: "Valid 5-digit ZIP required" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Look up zone by first 2 digits of ZIP
    const prefix = zip.slice(0, 2);
    const { data: zoneRow } = await supabase
      .from("fedex_zones")
      .select("zone")
      .eq("zip_prefix", prefix)
      .maybeSingle();

    const zone = zoneRow?.zone || "national"; // default fallback

    // Fetch offered rates for this zone + box type
    const { data: rates, error } = await supabase
      .from("fedex_rates")
      .select("service, price_cents, display_order")
      .eq("zone", zone)
      .eq("box_type", boxType)
      .eq("is_offered", true)
      .order("display_order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      zone,
      zip,
      boxType,
      options: (rates || []).map((r) => ({
        service: r.service,
        priceCents: r.price_cents,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch rates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
