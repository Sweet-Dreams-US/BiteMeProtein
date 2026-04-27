/**
 * Maps Square product names to legacy "slugs" used by lib/images.ts and
 * the slug column on product_images. Two paths converge here:
 *
 *   - The public site (shop, oven, home) reads images by slug from
 *     hardcoded image arrays in lib/images.ts and from product_images
 *     rows whose `slug` column matches.
 *   - The Square catalog identifies the same products by square_catalog_id
 *     (a long opaque string).
 *
 * To make the admin upload UI write photos that the public site can find,
 * every upload attaches BOTH identifiers (slug + square_product_id) to
 * the product_images row. This helper resolves the slug from a Square
 * product name. Add a new entry whenever a new product is added to
 * lib/images.ts.
 *
 * For products without a known slug we synthesize one by camelCasing the
 * product name (e.g., "New Cool Bites" → "newCoolBites"). Newly-uploaded
 * photos for unknown products will still be discoverable via slug — they
 * just won't show on hardcoded public-site sections that pull from
 * lib/images.ts (those need a code change).
 */

const KNOWN_SLUGS: Record<string, string> = {
  "Chocolate Chip Protein Banana Bread Bites": "chocChipBananaBread",
  "Raspberry Chocolate Chip Protein Banana Bread Bites": "rasChocChipBananaBread",
  "Blueberry Protein Muffin": "blueberryMuffin",
  "Protein Brownies": "brownieHearts",
  "Protein Vegan Cookie Dough Truffles": "chocolateTruffles",
};

export function slugForProductName(name: string | null | undefined): string {
  if (!name) return "";
  if (KNOWN_SLUGS[name]) return KNOWN_SLUGS[name];
  // Fallback: camelCase. Strip non-alphanum, split on spaces, lowercase
  // first word, capitalize first letter of subsequent words.
  const words = name
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "";
  return [
    words[0].toLowerCase(),
    ...words.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()),
  ].join("");
}
