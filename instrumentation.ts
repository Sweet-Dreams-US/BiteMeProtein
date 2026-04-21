/**
 * Next.js runs this file once per serverless function cold start, before
 * any route handler executes. Used here to install a BigInt → JSON shim
 * so stringifying Square SDK responses (which use BigInt for money values)
 * doesn't throw "Do not know how to serialize a BigInt" inside Supabase's
 * insert path or anywhere else.
 *
 * Converts BigInt → string on JSON.stringify. Money values we actually
 * read are always converted to Number via toCents() in sync handlers, so
 * the string representation is purely for the raw-dump JSONB column.
 */

export async function register() {
  if (typeof (BigInt.prototype as { toJSON?: () => string }).toJSON !== "function") {
    (BigInt.prototype as { toJSON?: () => string }).toJSON = function () {
      return this.toString();
    };
  }
}
