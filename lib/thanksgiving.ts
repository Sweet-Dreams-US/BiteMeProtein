/**
 * Thanksgiving pre-order menu, pricing, and validation.
 *
 * Single source of truth shared by the /thanksgiving page (client builder)
 * and POST /api/special-order (server). The server re-prices every cart
 * from this file, so the total that lands in the admin email never trusts
 * a number sent from the browser.
 *
 * Menu content comes from the four Thanksgiving menu pages the client sent
 * (Nov 2026). To change a price, flavor or description, edit it here.
 */

// ---------------------------------------------------------------------------
// Pre-order logistics — FILL THESE IN before the page goes live.
// ---------------------------------------------------------------------------
// The client hasn't given us the deadline or pickup windows yet. While a
// field is null/empty the page shows a friendly "coming soon" line instead
// of inventing a date, and the form falls back to a free-text pickup box.
export const THANKSGIVING_INFO = {
  /** Display string, e.g. "Sunday, Nov 22 at 8 PM". null = not announced yet. */
  preorderDeadline: "Sunday, Nov 22" as string | null,
  /**
   * Pickup windows customers can choose from, e.g.
   * ["Tue, Nov 24 · 10 AM – 4 PM", "Wed, Nov 25 · 10 AM – 4 PM"].
   * Empty = customers type a preferred day/time and we confirm by text.
   */
  pickupWindows: [
    "Wednesday, Nov 25",
    "Thursday, Nov 26 · pickup until 12 PM",
  ] as string[],
  /** Thanksgiving Day, shown in the hero. */
  holidayLabel: "Thursday, Nov 26",
};

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

export type MenuLine = "bite-me" | "moma";
export type DietTag = "Keto" | "Vegan" | "Gluten-free" | "Sugar-free";

export interface PieSize {
  /** Label shown to the customer, e.g. `10"` or `Loaf`. Also the key in orders. */
  label: string;
  price: number;
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  sizes: PieSize[];
  tags?: DietTag[];
}

export interface MenuCategory {
  id: string;
  title: string;
  /** Which bakery the category belongs to — Mo&Ma Classics are kept apart. */
  line: MenuLine;
  blurb?: string;
  items: MenuItem[];
}

const TEN = (price: number): PieSize => ({ label: '10"', price });
const TWELVE = (price: number): PieSize => ({ label: '12"', price });

export const MENU: MenuCategory[] = [
  {
    id: "protein-pies",
    title: "Protein Pies & Tarts",
    line: "bite-me",
    items: [
      { id: "apple-bottom-pie", name: "Apple Bottom Pie", description: "Rose-arranged apples finished with a glossy maple glaze", sizes: [TWELVE(65)] },
      { id: "sweet-potato-fluff-pie", name: "Sweet Potato Fluff Pie", description: "Maple sweet potato filling topped with toasted meringue", sizes: [TWELVE(65)] },
      { id: "berry-thankful", name: "Berry Thankful", description: "Blueberries and cranberries under golden toasted meringue", sizes: [TWELVE(65)] },
      { id: "little-miss-chocolate-pie", name: "Little Miss Chocolate Pie", description: "A silky chocolate filling in a delicate crust, crowned with glossy ganache", sizes: [TWELVE(65)] },
      { id: "pumpkin-gingersnap", name: "Pumpkin Gingersnap", description: "Creamy pumpkin filling with a spiced gingersnap crust", sizes: [TEN(55)] },
      { id: "raspberry-brownie-pie", name: "Raspberry Brownie Pie", description: "Brownie base layered with creamy cheesecake and raspberry, topped with whipped cream and chocolate chips", sizes: [TEN(55)] },
      { id: "cinna-bite-me", name: "Cinna-Bite-Me", description: "Cinnamon protein pie with apple cider meringue", sizes: [TEN(55), TWELVE(60)] },
      { id: "peaches-and-glutes", name: "Peaches & Glutes", description: "Peaches and cream protein pie", sizes: [TEN(55), TWELVE(60)] },
      { id: "strawberry-and-cream", name: "Strawberry & Cream", description: "Strawberry-vanilla protein pie", sizes: [TEN(55), TWELVE(60)] },
      { id: "chocolate-fix", name: "Chocolate Fix", description: "A light chocolate protein pie with vanilla meringue", sizes: [TEN(55), TWELVE(60)] },
    ],
  },
  {
    id: "keto-cuties",
    title: "Keto Cuties",
    line: "bite-me",
    items: [
      { id: "little-miss-keto", name: "Little Miss Keto", description: "Flourless chocolate cake finished with silky ganache", sizes: [TEN(65)], tags: ["Keto"] },
      { id: "silky-little-secret", name: "Silky Little Secret", description: "A smooth, rich chocolate silk pie", sizes: [TEN(65)], tags: ["Keto"] },
      { id: "pumpkin-cheesecake", name: "Pumpkin Cheesecake", description: "A smooth pumpkin-spice cheesecake with cozy fall flavor", sizes: [TEN(65)], tags: ["Keto"] },
      { id: "peppermint-truffle-tart", name: "Peppermint Truffle Tart", description: "Rich chocolate truffle with cool peppermint finish", sizes: [TEN(65)], tags: ["Keto"] },
    ],
  },
  {
    id: "vegan-collection",
    title: "Vegan Collection",
    line: "bite-me",
    items: [
      { id: "dark-side-of-the-bite", name: "Dark Side of the Bite", description: "Rich vegan dark-chocolate truffle pie with silky ganache", sizes: [TEN(65)], tags: ["Vegan"] },
      { id: "sweater-weather-tart", name: "Sweater Weather Tart", description: "Maple-vanilla plant cream with apples, pears, and cranberries", sizes: [TEN(65)], tags: ["Vegan"] },
    ],
  },
  {
    id: "specialty",
    title: "Specialty Pies & Cheesecakes",
    line: "bite-me",
    items: [
      { id: "gf-sf-chocolate-pie", name: "GF & Sugar-Free Chocolate Pie", sizes: [TEN(60)], tags: ["Gluten-free", "Sugar-free"] },
      { id: "gf-sf-key-lime-pie", name: "GF & Sugar-Free Key Lime Pie", sizes: [TEN(60)], tags: ["Gluten-free", "Sugar-free"] },
      { id: "cinnamon-roll-cheesecake", name: "Cinnamon Roll Cheesecake", sizes: [TEN(55)] },
    ],
  },
  {
    id: "gluten-free-pies",
    title: "Gluten-Free Pies",
    line: "bite-me",
    items: [
      { id: "gf-pumpkin-pie", name: "Gluten-Free Pumpkin Pie", sizes: [TWELVE(60)], tags: ["Gluten-free"] },
      { id: "gf-banana-cream-pie", name: "Gluten-Free Banana Cream Pie", sizes: [TWELVE(60)], tags: ["Gluten-free"] },
      { id: "gf-banofee-pie", name: "Gluten-Free Banofee Pie", sizes: [TWELVE(60)], tags: ["Gluten-free"] },
      { id: "gf-key-lime-pie", name: "Gluten-Free Key Lime Pie", sizes: [TWELVE(60)], tags: ["Gluten-free"] },
      { id: "gf-apple-pie", name: "Gluten-Free Apple Pie", sizes: [TWELVE(60)], tags: ["Gluten-free"] },
    ],
  },
  {
    id: "banana-bread",
    title: "Banana Bread Loaves",
    line: "bite-me",
    items: [
      { id: "choc-chip-banana-bread", name: "Chocolate Chip Banana Bread", description: "Soft classic banana bread with chocolate chips", sizes: [{ label: "Loaf", price: 25 }] },
      { id: "raspberry-choc-chip-banana-bread", name: "Raspberry Chocolate Chip Banana Bread", description: "Banana bread with raspberries and chocolate chips", sizes: [{ label: "Loaf", price: 25 }] },
    ],
  },
  {
    id: "classics",
    title: "The Classics",
    line: "moma",
    blurb: "The original Mo&Ma bakery favorites.",
    items: [
      { id: "classic-pumpkin-pie", name: "Pumpkin Pie", sizes: [TEN(45), TWELVE(50)] },
      { id: "classic-banana-cream-pie", name: "Banana Cream Pie", sizes: [TEN(45), TWELVE(50)] },
      { id: "classic-banofee-pie", name: "Banofee Pie", sizes: [TEN(45), TWELVE(50)] },
      { id: "classic-key-lime-pie", name: "Key Lime Pie", sizes: [TEN(45), TWELVE(50)] },
      { id: "classic-apple-pie", name: "Apple Pie", sizes: [TEN(45), TWELVE(50)] },
    ],
  },
];

// ---------------------------------------------------------------------------
// Pretty Little Bites + Gobble Boxes
// ---------------------------------------------------------------------------

export interface Bite {
  id: string;
  name: string;
  description: string;
  price: number;
  keto?: boolean;
  /**
   * Can this bite go in a Gobble Box? The box prices ($30 / $55 / $105)
   * work out to about $5 a bite, so the pricier bites ($6–$9) are
   * à la carte only for now. Flip to true to let one into boxes.
   */
  inBox: boolean;
}

export const BITES: Bite[] = [
  { id: "apple-bottom-bites", name: "Apple Bottom Bites", description: "Mini apple crisp protein cheesecakes", price: 5, inBox: true },
  { id: "gingersnap-swirls", name: "Gingersnap Swirls", description: "Cheesecake bars with cozy gingersnap spice", price: 5, inBox: true },
  { id: "pie-shots", name: "Pie Shots", description: "Tiny edible pie cups filled with seasonal favorites", price: 5, inBox: true },
  { id: "maple-apple-blondies", name: "Maple Apple Blondies", description: "Soft apple blondies finished with maple frosting", price: 5, inBox: true },
  { id: "mini-chocolate-silk-tarts", name: "Mini Chocolate Silk Tarts", description: "Petite tarts filled with silky chocolate", price: 6, keto: true, inBox: false },
  { id: "talk-turkey-to-me", name: "Talk Turkey To Me", description: "Turkey-shaped chocolate mousse with a gooey Bite-coff center", price: 8, keto: true, inBox: false },
  { id: "apple-creme-brulee", name: "Apple Creme Brulee", description: "A whole apple filled with vanilla protein custard and a crackly bruleed top", price: 9, inBox: false },
];

export const GOBBLE_BOXES = [
  { count: 6, price: 30 },
  { count: 12, price: 55 },
  { count: 24, price: 105 },
] as const;

export type GobbleBoxCount = (typeof GOBBLE_BOXES)[number]["count"];

// ---------------------------------------------------------------------------
// Order shape + validation
// ---------------------------------------------------------------------------

export interface PieOrderLine { id: string; size: string; qty: number }
export interface BiteOrderLine { id: string; qty: number }
export interface BoxOrderLine { count: number; picks: Record<string, number> }

export interface ThanksgivingCart {
  pies: PieOrderLine[];
  boxes: BoxOrderLine[];
  bites: BiteOrderLine[];
}

export interface PricedLine {
  kind: "pie" | "box" | "bite";
  label: string;
  /** Box contents, e.g. "2× Pie Shots, 4× Maple Apple Blondies". */
  detail?: string;
  qty: number;
  amount: number;
}

export interface PricedCart {
  lines: PricedLine[];
  total: number;
  itemCount: number;
}

const MAX_QTY = 25;
const MAX_LINES = 60;

const menuItemById = new Map<string, { item: MenuItem; category: MenuCategory }>(
  MENU.flatMap((category) => category.items.map((item) => [item.id, { item, category }] as const)),
);
const biteById = new Map(BITES.map((b) => [b.id, b]));

export function money(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

export function findMenuItem(id: string) {
  return menuItemById.get(id);
}

export function boxPrice(count: number): number | null {
  return GOBBLE_BOXES.find((b) => b.count === count)?.price ?? null;
}

function isQty(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= MAX_QTY;
}

/**
 * Prices a cart from the menu above. Returns an error string for anything
 * that doesn't match (unknown item, wrong size, half-filled box, ...) so
 * both the UI and the API can reject tampered or stale carts.
 */
export function priceCart(raw: unknown): { ok: true; cart: PricedCart } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Your order is empty." };
  const input = raw as Partial<ThanksgivingCart>;
  const pies = Array.isArray(input.pies) ? input.pies : [];
  const boxes = Array.isArray(input.boxes) ? input.boxes : [];
  const bites = Array.isArray(input.bites) ? input.bites : [];

  if (pies.length + boxes.length + bites.length === 0) return { ok: false, error: "Add something to your order first." };
  if (pies.length + boxes.length + bites.length > MAX_LINES) return { ok: false, error: "That's a big order — please call or use Special Orders." };

  const lines: PricedLine[] = [];

  for (const line of pies) {
    const found = line && typeof line.id === "string" ? menuItemById.get(line.id) : undefined;
    const size = found?.item.sizes.find((s) => s.label === line.size);
    if (!found || !size || !isQty(line.qty)) return { ok: false, error: "One of the pies in your order isn't on the menu. Please refresh and try again." };
    const sizeNote = found.item.sizes.length > 1 || size.label !== "Loaf" ? ` (${size.label})` : "";
    lines.push({
      kind: "pie",
      label: `${found.item.name}${sizeNote}`,
      qty: line.qty,
      amount: size.price * line.qty,
    });
  }

  for (const box of boxes) {
    const price = box && typeof box.count === "number" ? boxPrice(box.count) : null;
    if (price === null || !box.picks || typeof box.picks !== "object") return { ok: false, error: "A Gobble Box in your order isn't valid." };
    let picked = 0;
    const parts: string[] = [];
    for (const [biteId, qty] of Object.entries(box.picks)) {
      const bite = biteById.get(biteId);
      if (!bite || !bite.inBox || !isQty(qty)) return { ok: false, error: "A Gobble Box has a bite that can't go in a box." };
      picked += qty;
      parts.push(`${qty}× ${bite.name}`);
    }
    if (picked !== box.count) return { ok: false, error: `A Gobble Box of ${box.count} needs exactly ${box.count} bites.` };
    lines.push({ kind: "box", label: `Gobble Box of ${box.count}`, detail: parts.join(", "), qty: 1, amount: price });
  }

  for (const line of bites) {
    const bite = line && typeof line.id === "string" ? biteById.get(line.id) : undefined;
    if (!bite || !isQty(line.qty)) return { ok: false, error: "One of the bites in your order isn't on the menu. Please refresh and try again." };
    lines.push({ kind: "bite", label: bite.name, qty: line.qty, amount: bite.price * line.qty });
  }

  return {
    ok: true,
    cart: {
      lines,
      total: lines.reduce((sum, l) => sum + l.amount, 0),
      itemCount: lines.reduce((sum, l) => sum + l.qty, 0),
    },
  };
}

/** Plain-text order summary used in the admin email and stored on the row. */
export function cartToText(cart: PricedCart): string {
  return cart.lines
    .map((l) => {
      const qty = l.kind === "box" ? "" : `${l.qty}× `;
      const detail = l.detail ? `\n    ${l.detail}` : "";
      return `• ${qty}${l.label} — ${money(l.amount)}${detail}`;
    })
    .join("\n");
}
