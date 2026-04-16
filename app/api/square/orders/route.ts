import { NextResponse } from "next/server";
import { getSquareClient, getLocationId } from "@/lib/square";

/* eslint-disable @typescript-eslint/no-explicit-any */

// GET — List recent orders
export async function GET() {
  try {
    const squareClient = getSquareClient();
    const SQUARE_LOCATION_ID = getLocationId();

    const result = await squareClient.orders.search({
      locationIds: [SQUARE_LOCATION_ID],
      query: {
        sort: {
          sortField: "CREATED_AT",
          sortOrder: "DESC",
        },
        filter: {
          dateTimeFilter: {
            createdAt: {
              startAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            },
          },
        },
      },
      limit: 50,
    }) as any;

    const orders = ((result.orders || []) as any[]).map((order: any) => ({
      id: order.id,
      createdAt: order.createdAt,
      state: order.state,
      totalMoney: order.totalMoney
        ? {
            amount: Number(order.totalMoney.amount),
            currency: order.totalMoney.currency,
          }
        : null,
      lineItems: (order.lineItems || []).map((li: any) => ({
        name: li.name,
        quantity: li.quantity,
        totalMoney: li.totalMoney
          ? { amount: Number(li.totalMoney.amount), currency: li.totalMoney.currency }
          : null,
      })),
      fulfillments: (order.fulfillments || []).map((f: any) => ({
        type: f.type,
        state: f.state,
      })),
      source: order.source?.name || null,
    }));

    return NextResponse.json({ orders });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch orders";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
