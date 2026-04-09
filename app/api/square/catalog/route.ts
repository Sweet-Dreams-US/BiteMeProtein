import { NextRequest, NextResponse } from "next/server";
import { squareClient, SQUARE_LOCATION_ID } from "@/lib/square";
import crypto from "crypto";

/* eslint-disable @typescript-eslint/no-explicit-any */

// GET — List all catalog items
export async function GET() {
  try {
    const result = await squareClient.catalog.searchItems({
      enabledLocationIds: [SQUARE_LOCATION_ID],
      productTypes: ["REGULAR"],
      limit: 100,
    });

    const variationIds: string[] = [];
    const items = (result.items || []) as any[];
    for (const item of items) {
      const variations = item.itemData?.variations || [];
      for (const v of variations) {
        if (v.id) variationIds.push(v.id);
      }
    }

    let inventoryCounts: Record<string, string> = {};
    if (variationIds.length > 0) {
      try {
        const invResult = squareClient.inventory.batchGetCounts({
          catalogObjectIds: variationIds,
          locationIds: [SQUARE_LOCATION_ID],
        });
        for await (const count of invResult as any) {
          if (count.catalogObjectId && count.state === "IN_STOCK") {
            inventoryCounts[count.catalogObjectId] = count.quantity || "0";
          }
        }
      } catch {
        // Inventory might not be set up yet
      }
    }

    const serialized = items.map((item: any) => {
      const variations = (item.itemData?.variations || []).map((v: any) => ({
        id: v.id,
        name: v.itemVariationData?.name || "Regular",
        priceMoney: v.itemVariationData?.priceMoney
          ? {
              amount: Number(v.itemVariationData.priceMoney.amount),
              currency: v.itemVariationData.priceMoney.currency,
            }
          : null,
        sku: v.itemVariationData?.sku || null,
        trackInventory: v.itemVariationData?.trackInventory || false,
        inventoryCount: v.id ? Number(inventoryCounts[v.id] || 0) : 0,
      }));

      return {
        id: item.id,
        name: item.itemData?.name || "",
        description: item.itemData?.description || "",
        categoryId: item.itemData?.categoryId || null,
        imageIds: item.itemData?.imageIds || [],
        variations,
        isArchived: item.itemData?.isArchived || false,
      };
    });

    return NextResponse.json({ items: serialized });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch catalog";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — Create a new catalog item
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      description,
      variations = [{ name: "Regular", price: 0 }],
      trackInventory = false,
    } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const idempotencyKey = crypto.randomUUID();
    const itemId = `#${name.replace(/\s+/g, "_")}_${Date.now()}`;

    const variationObjects = variations.map(
      (v: { name: string; price: number; sku?: string }, i: number) => ({
        type: "ITEM_VARIATION" as const,
        id: `${itemId}_var_${i}`,
        itemVariationData: {
          itemId,
          name: v.name || "Regular",
          pricingType: "FIXED_PRICING" as const,
          priceMoney: {
            amount: BigInt(Math.round(v.price * 100)),
            currency: "USD" as const,
          },
          sku: v.sku || undefined,
          trackInventory,
          locationOverrides: [
            {
              locationId: SQUARE_LOCATION_ID,
              trackInventory,
            },
          ],
        },
      })
    );

    const result = await squareClient.catalog.batchUpsert({
      idempotencyKey,
      batches: [
        {
          objects: [
            {
              type: "ITEM",
              id: itemId,
              presentAtAllLocations: true,
              itemData: {
                name,
                description: description || "",
                variations: variationObjects,
              },
            },
          ],
        },
      ],
    });

    const created = (result as any).objects?.[0];
    return NextResponse.json({
      success: true,
      item: created ? { id: created.id, name: created.itemData?.name } : null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT — Update a catalog item
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, description, variations, trackInventory } = body;

    if (!id) {
      return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
    }

    const current = await squareClient.catalog.object.get({ objectId: id });
    const currentObj = current.object as any;
    if (!currentObj) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const variationObjects = variations
      ? variations.map(
          (v: { id?: string; name: string; price: number; sku?: string }, i: number) => ({
            type: "ITEM_VARIATION" as const,
            id: v.id || `#new_var_${i}_${Date.now()}`,
            itemVariationData: {
              itemId: id,
              name: v.name || "Regular",
              pricingType: "FIXED_PRICING" as const,
              priceMoney: {
                amount: BigInt(Math.round(v.price * 100)),
                currency: "USD" as const,
              },
              sku: v.sku || undefined,
              trackInventory: trackInventory ?? false,
              locationOverrides: [
                {
                  locationId: SQUARE_LOCATION_ID,
                  trackInventory: trackInventory ?? false,
                },
              ],
            },
          })
        )
      : currentObj.itemData?.variations;

    const result = await squareClient.catalog.batchUpsert({
      idempotencyKey: crypto.randomUUID(),
      batches: [
        {
          objects: [
            {
              type: "ITEM",
              id,
              version: currentObj.version,
              presentAtAllLocations: true,
              itemData: {
                name: name ?? currentObj.itemData?.name,
                description: description ?? currentObj.itemData?.description ?? "",
                variations: variationObjects,
              },
            },
          ],
        },
      ],
    });

    const updated = (result as any).objects?.[0];
    return NextResponse.json({
      success: true,
      item: updated ? { id: updated.id, name: updated.itemData?.name } : null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE — Delete a catalog item
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
    }

    await squareClient.catalog.object.delete({ objectId: id });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
