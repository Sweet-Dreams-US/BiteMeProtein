import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/log-error";

/**
 * POST /api/client-errors
 *
 * Public endpoint used by app/error.tsx + app/global-error.tsx to surface
 * client-side React render errors into /admin/errors. Fire-and-forget
 * from the boundary — a failure here must not cascade back into the
 * boundary itself.
 *
 * We don't trust any of the fields (bad actor could spam noise); keep
 * the logging source-tagged as "client" so the admin can filter it out.
 */

interface Body {
  message?: string;
  stack?: string;
  digest?: string;
  path?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const msg = typeof body.message === "string" ? body.message.slice(0, 2000) : "Client render error";
    const stack = typeof body.stack === "string" ? body.stack.slice(0, 10_000) : undefined;
    const path = typeof body.path === "string" ? body.path.slice(0, 500) : "(unknown)";
    const digest = typeof body.digest === "string" ? body.digest.slice(0, 200) : undefined;

    await logError(msg, {
      path: `client:${path}`,
      source: "client",
      context: { stack, digest },
    });

    return NextResponse.json({ received: true });
  } catch {
    // Swallow anything the log-error path throws — this endpoint MUST
    // return cleanly so the boundary doesn't loop.
    return NextResponse.json({ received: false }, { status: 200 });
  }
}
