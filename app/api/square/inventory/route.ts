import { NextRequest, NextResponse } from "next/server";
import { squareClient, SQUARE_LOCATION_ID } from "@/lib/square";
import crypto from "crypto";

/* eslint-disable @typescript-eslint/no-explicit-any */

// POST — Set inventory count for a variation
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { variationId, quantity } = body;

    if (!variationId) {
      return NextResponse.json({ error: "variationId is required" }, { status: 400 });
    }

    // Use physical count to set exact inventory
    const result = await (squareClient.inventory as any).batchCreateChanges({
      idempotencyKey: crypto.randomUUID(),
      changes: [
        {
          type: "PHYSICAL_COUNT",
          physicalCount: {
            catalogObjectId: variationId,
            state: "IN_STOCK",
            locationId: SQUARE_LOCATION_ID,
            quantity: String(quantity),
            occurredAt: new Date().toISOString(),
          },
        },
      ],
    }) as any;

    return NextResponse.json({
      success: true,
      counts: (result.counts || []).map((c: any) => ({
        catalogObjectId: c.catalogObjectId,
        quantity: c.quantity,
        state: c.state,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update inventory";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
