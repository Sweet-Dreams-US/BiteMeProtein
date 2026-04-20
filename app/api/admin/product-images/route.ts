import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";
import { logError } from "@/lib/log-error";

/**
 * /api/admin/product-images
 *
 * POST   — attach a newly-uploaded image to a product
 *          body: { squareProductId?: string, slug?: string, url, kind, alt?, sort_order? }
 * PATCH  — reorder: body: { updates: Array<{ id, sort_order }> }
 * DELETE — body: { id } or ?id=<uuid>
 */

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json();
    const { squareProductId, slug, url, kind, alt, sort_order } = body as {
      squareProductId?: string;
      slug?: string;
      url?: string;
      kind?: "product" | "nutrition" | "lifestyle";
      alt?: string;
      sort_order?: number;
    };

    if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });
    if (!squareProductId && !slug) {
      return NextResponse.json({ error: "squareProductId or slug required" }, { status: 400 });
    }
    if (kind && !["product", "nutrition", "lifestyle"].includes(kind)) {
      return NextResponse.json({ error: "invalid kind" }, { status: 400 });
    }

    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("product_images")
      .insert({
        square_product_id: squareProductId ?? null,
        slug: slug ?? null,
        url,
        kind: kind ?? "product",
        alt: alt ?? null,
        sort_order: sort_order ?? 0,
      })
      .select()
      .single();

    if (error) {
      await logError(error, {
        path: "/api/admin/product-images:POST",
        source: "api-route",
        context: { squareProductId, slug, kind },
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ image: data });
  } catch (err) {
    await logError(err, { path: "/api/admin/product-images:POST", source: "api-route" });
    const message = err instanceof Error ? err.message : "Failed to attach image";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json();
    const updates = Array.isArray(body.updates) ? body.updates : null;
    if (!updates) return NextResponse.json({ error: "updates[] required" }, { status: 400 });

    const supabase = getServiceClient();
    // Supabase doesn't support bulk update-with-different-values in one call,
    // so issue in parallel. Small N (typically < 20 per product), so fine.
    const results = await Promise.all(
      updates.map(({ id, sort_order }: { id: string; sort_order: number }) =>
        supabase.from("product_images").update({ sort_order }).eq("id", id),
      ),
    );
    const firstError = results.find((r) => r.error)?.error;
    if (firstError) {
      await logError(firstError, { path: "/api/admin/product-images:PATCH", source: "api-route" });
      return NextResponse.json({ error: firstError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    await logError(err, { path: "/api/admin/product-images:PATCH", source: "api-route" });
    const message = err instanceof Error ? err.message : "Failed to reorder";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const unauthorized = await requireAdmin(req);
  if (unauthorized) return unauthorized;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const supabase = getServiceClient();
    const { error } = await supabase.from("product_images").delete().eq("id", id);
    if (error) {
      await logError(error, {
        path: "/api/admin/product-images:DELETE",
        source: "api-route",
        context: { id },
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    await logError(err, { path: "/api/admin/product-images:DELETE", source: "api-route" });
    const message = err instanceof Error ? err.message : "Failed to delete image";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
