"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ScrollReveal from "@/components/animations/ScrollReveal";
import {
  BITES,
  GOBBLE_BOXES,
  MENU,
  THANKSGIVING_INFO,
  money,
  priceCart,
  type BoxOrderLine,
  type DietTag,
  type GobbleBoxCount,
  type MenuCategory,
  type MenuItem,
  type PieOrderLine,
  type PricedCart,
} from "@/lib/thanksgiving";

const inputClass =
  "w-full bg-bitepink-blush border border-bitepink-light rounded-xl px-4 py-3 text-dark placeholder:text-dark/30 focus:outline-none focus:border-bitepink focus:ring-2 focus:ring-bitepink/20 transition-all";

const TAG_STYLES: Record<DietTag, string> = {
  Keto: "bg-bitepink-pale text-bitepink-dark",
  Vegan: "bg-green/10 text-green",
  "Gluten-free": "bg-golden-light/60 text-golden-dark",
  "Sugar-free": "bg-blue/10 text-blue",
};

const BOX_BITES = BITES.filter((b) => b.inBox);
const MAX_QTY = 25;

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function Stepper({
  value,
  onChange,
  min = 0,
  max = MAX_QTY,
  label,
  disableIncrement = false,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  label: string;
  disableIncrement?: boolean;
}) {
  const btn =
    "w-9 h-9 rounded-full border-2 border-bitepink text-bitepink font-bold text-lg leading-none flex items-center justify-center hover:bg-bitepink hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-bitepink disabled:cursor-not-allowed";
  return (
    <div className="inline-flex items-center gap-3">
      <button type="button" className={btn} aria-label={`Fewer ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <span className="w-6 text-center font-bold text-dark tabular-nums" aria-live="polite">{value}</span>
      <button type="button" className={btn} aria-label={`More ${label}`} disabled={value >= max || disableIncrement} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}

function DottedRow({ name, price }: { name: string; price: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <h3 className="font-bold text-dark text-base md:text-lg uppercase tracking-wide">{name}</h3>
      <span className="flex-1 border-b-2 border-dotted border-bitepink/30 translate-y-[-4px]" aria-hidden />
      <span className="font-bold text-bitepink-dark whitespace-nowrap">{price}</span>
    </div>
  );
}

function PillHeading({ children, tone = "pink" }: { children: React.ReactNode; tone?: "pink" | "moma" }) {
  return (
    <h3
      className={`font-fun text-2xl md:text-4xl text-center rounded-full px-8 py-3 mx-auto w-fit ${
        tone === "pink" ? "bg-bitepink-light text-dark" : "bg-golden-light text-burgundy"
      }`}
    >
      {children}
    </h3>
  );
}

// ---------------------------------------------------------------------------
// Pie card — pick a size + quantity, then add to the order
// ---------------------------------------------------------------------------

function PieCard({
  item,
  tone,
  inCart,
  onAdd,
}: {
  item: MenuItem;
  tone: "pink" | "moma";
  inCart: number;
  onAdd: (line: PieOrderLine) => void;
}) {
  const [size, setSize] = useState(item.sizes[0].label);
  const [qty, setQty] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const selected = item.sizes.find((s) => s.label === size) ?? item.sizes[0];
  const accent = tone === "pink" ? "bg-bitepink hover:bg-bitepink-dark" : "bg-burgundy hover:bg-burgundy-dark";
  const accentText = tone === "pink" ? "text-bitepink-dark" : "text-burgundy";
  const pillOn = tone === "pink" ? "bg-bitepink text-white border-bitepink" : "bg-burgundy text-white border-burgundy";
  const pillOff = tone === "pink" ? "border-bitepink-light text-dark hover:border-bitepink" : "border-golden-dark/50 text-dark hover:border-burgundy";

  function add() {
    onAdd({ id: item.id, size: selected.label, qty });
    setQty(1);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1400);
  }

  return (
    <div className={`bg-white rounded-3xl p-5 md:p-6 flex flex-col border ${tone === "pink" ? "border-bitepink-light/70" : "border-golden-dark/30"} shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <h4 className="font-bold text-dark uppercase tracking-wide text-base md:text-lg leading-snug">{item.name}</h4>
        <span className={`font-bold whitespace-nowrap ${accentText}`}>{money(selected.price)}</span>
      </div>

      {item.tags && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {item.tags.map((t) => (
            <span key={t} className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${TAG_STYLES[t]}`}>{t}</span>
          ))}
        </div>
      )}

      {item.description && <p className="text-dark/60 italic text-sm mt-2 flex-1">{item.description}</p>}
      {!item.description && <div className="flex-1" />}

      <div className="mt-4 space-y-3">
        {item.sizes.length > 1 ? (
          <div className="flex gap-2" role="radiogroup" aria-label={`Size for ${item.name}`}>
            {item.sizes.map((s) => (
              <button
                key={s.label}
                type="button"
                role="radio"
                aria-checked={s.label === size}
                onClick={() => setSize(s.label)}
                className={`flex-1 rounded-full border-2 px-3 py-1.5 text-sm font-bold transition-colors ${s.label === size ? pillOn : pillOff}`}
              >
                {s.label} · {money(s.price)}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs font-bold uppercase tracking-wider text-dark/40">
            {item.sizes[0].label === "Loaf" ? "One loaf" : `${item.sizes[0].label} only`}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <Stepper value={qty} min={1} onChange={setQty} label={item.name} />
          <button type="button" onClick={add} className={`${accent} text-white font-bold rounded-full px-5 py-2.5 text-sm transition-colors`}>
            {justAdded ? "Added ✓" : "Add to order"}
          </button>
        </div>

        {inCart > 0 && <p className={`text-xs font-semibold ${accentText}`}>{inCart} in your order</p>}
      </div>
    </div>
  );
}

function CategoryBlock({
  category,
  tone,
  countFor,
  onAdd,
}: {
  category: MenuCategory;
  tone: "pink" | "moma";
  countFor: (id: string) => number;
  onAdd: (line: PieOrderLine) => void;
}) {
  return (
    <div className="mt-14 first:mt-0">
      <ScrollReveal>
        <PillHeading tone={tone}>{category.title}</PillHeading>
        {category.blurb && <p className="text-center text-dark/60 mt-3">{category.blurb}</p>}
      </ScrollReveal>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
        {category.items.map((item) => (
          <PieCard key={item.id} item={item} tone={tone} inCart={countFor(item.id)} onAdd={onAdd} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export default function PreorderBuilder() {
  const [pies, setPies] = useState<PieOrderLine[]>([]);
  const [boxes, setBoxes] = useState<BoxOrderLine[]>([]);
  const [alaCarte, setAlaCarte] = useState<Record<string, number>>({});

  // Gobble Box in progress
  const [boxCount, setBoxCount] = useState<GobbleBoxCount>(6);
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [boxJustAdded, setBoxJustAdded] = useState(false);

  // Form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pickup, setPickup] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<PricedCart | null>(null);

  const formRef = useRef<HTMLDivElement>(null);
  const [formInView, setFormInView] = useState(false);

  const biteLines = useMemo(
    () => Object.entries(alaCarte).filter(([, q]) => q > 0).map(([id, qty]) => ({ id, qty })),
    [alaCarte],
  );
  const cartInput = useMemo(() => ({ pies, boxes, bites: biteLines }), [pies, boxes, biteLines]);
  const priced = useMemo(() => priceCart(cartInput), [cartInput]);
  const cart = priced.ok ? priced.cart : null;

  const picked = Object.values(picks).reduce((a, b) => a + b, 0);
  const remaining = boxCount - picked;
  const boxPriceNow = GOBBLE_BOXES.find((b) => b.count === boxCount)?.price ?? 0;

  useEffect(() => {
    const el = formRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([entry]) => setFormInView(entry.isIntersecting), { threshold: 0.05 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ---- cart actions ----
  function addPie(line: PieOrderLine) {
    setPies((prev) => {
      const i = prev.findIndex((p) => p.id === line.id && p.size === line.size);
      if (i === -1) return [...prev, line];
      return prev.map((p, idx) => (idx === i ? { ...p, qty: Math.min(MAX_QTY, p.qty + line.qty) } : p));
    });
  }

  function pieCount(id: string) {
    return pies.filter((p) => p.id === id).reduce((sum, p) => sum + p.qty, 0);
  }

  function setPick(id: string, qty: number) {
    setPicks((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }

  function chooseBoxSize(count: GobbleBoxCount) {
    setBoxCount(count);
    // Shrinking a half-built box below what's picked would leave it invalid — start over.
    if (picked > count) setPicks({});
  }

  function surpriseMe() {
    const next = { ...picks };
    for (let i = 0; i < remaining; i++) {
      const bite = BOX_BITES[Math.floor(Math.random() * BOX_BITES.length)];
      next[bite.id] = (next[bite.id] ?? 0) + 1;
    }
    setPicks(next);
  }

  function addBox() {
    if (remaining !== 0) return;
    setBoxes((prev) => [...prev, { count: boxCount, picks }]);
    setPicks({});
    setBoxJustAdded(true);
    window.setTimeout(() => setBoxJustAdded(false), 1600);
  }

  function removeLine(index: number) {
    if (index < pies.length) {
      setPies((prev) => prev.filter((_, i) => i !== index));
    } else if (index < pies.length + boxes.length) {
      const b = index - pies.length;
      setBoxes((prev) => prev.filter((_, i) => i !== b));
    } else {
      const id = biteLines[index - pies.length - boxes.length]?.id;
      if (id) setAlaCarte((prev) => ({ ...prev, [id]: 0 }));
    }
  }

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cart) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/special-order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          orderType: "thanksgiving",
          fulfillment: "pickup",
          details: { cart: cartInput, pickup },
          notes: notes.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Couldn't send your preorder.");
      setDone(cart);
      window.scrollTo({ top: (formRef.current?.offsetTop ?? 0) - 120, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send your preorder. Please try again.");
    }
    setSubmitting(false);
  }

  function startOver() {
    setPies([]);
    setBoxes([]);
    setAlaCarte({});
    setPicks({});
    setNotes("");
    setDone(null);
  }

  const biteMeCategories = MENU.filter((c) => c.line === "bite-me");
  const momaCategories = MENU.filter((c) => c.line === "moma");
  const hasPickupWindows = THANKSGIVING_INFO.pickupWindows.length > 0;

  return (
    <div className="bg-bitepink-blush">
      {/* Jump nav */}
      <div className="sticky top-20 z-30 bg-white/90 backdrop-blur border-y border-bitepink-light/60">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 flex gap-2 overflow-x-auto py-2.5 text-sm font-bold [scrollbar-width:none]">
          {[
            ["#pies", "🥧 Pies & Treats"],
            ["#bites", "🍂 Pretty Little Bites"],
            ["#classics", "⭐ Mo&Ma Classics"],
            ["#your-preorder", "🦃 Your Preorder"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="whitespace-nowrap rounded-full bg-bitepink-pale text-bitepink-dark px-4 py-1.5 hover:bg-bitepink hover:text-white transition-colors">
              {label}
            </a>
          ))}
        </div>
      </div>

      {/* ============ BITE ME PIES & TREATS ============ */}
      <section id="pies" className="scroll-mt-36 py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <p className="stamp text-bitepink-dark !border-bitepink mb-4 block w-fit mx-auto">Bite Me Protein Bakery</p>
            <h2 className="font-fun text-bitepink-dark text-4xl md:text-6xl text-center mb-3">Pies, tarts &amp; treats</h2>
            <p className="text-center text-dark/60 max-w-xl mx-auto mb-14">Pick a pie, choose your size, and add it to your order.</p>
          </ScrollReveal>
          {biteMeCategories.map((c) => (
            <CategoryBlock key={c.id} category={c} tone="pink" countFor={pieCount} onAdd={addPie} />
          ))}
        </div>
      </section>

      <div className="dots-pink" aria-hidden />

      {/* ============ PRETTY LITTLE BITES ============ */}
      <section id="bites" className="scroll-mt-36 py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="font-fun text-bitepink-dark text-4xl md:text-6xl text-center mb-3">Pretty Little Bites</h2>
            <p className="text-center text-dark/60 max-w-xl mx-auto mb-12">Order individually, or build your own Gobble Box!</p>
          </ScrollReveal>

          {/* Gobble Box builder */}
          <ScrollReveal>
            <div className="rounded-[2rem] border-4 border-dotted border-bitepink bg-bitepink-blush p-6 md:p-10">
              <div className="text-center">
                <p className="text-4xl mb-1" aria-hidden>🦃</p>
                <h3 className="font-fun text-bitepink-dark text-3xl md:text-4xl">Build your Gobble Box</h3>
                <p className="text-dark/60 mt-2">Choose a box size, then pick your bites.</p>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-8 max-w-2xl mx-auto" role="radiogroup" aria-label="Gobble Box size">
                {GOBBLE_BOXES.map((b) => {
                  const on = b.count === boxCount;
                  return (
                    <button
                      key={b.count}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => chooseBoxSize(b.count)}
                      className={`rounded-3xl py-4 px-2 border-2 transition-all ${on ? "bg-bitepink text-white border-bitepink scale-[1.03] shadow-lg" : "bg-white text-dark border-bitepink-light hover:border-bitepink"}`}
                    >
                      <span className="block text-xs font-bold uppercase tracking-wider opacity-80">{b.count} assorted</span>
                      <span className="block font-fun text-3xl">{money(b.price)}</span>
                    </button>
                  );
                })}
              </div>

              {/* Progress */}
              <div className="mt-8 text-center">
                <div className="flex flex-wrap justify-center gap-1.5 max-w-md mx-auto" aria-hidden>
                  {Array.from({ length: boxCount }).map((_, i) => (
                    <span key={i} className={`w-5 h-5 rounded-full border-2 transition-colors ${i < picked ? "bg-bitepink border-bitepink" : "bg-white border-bitepink-light"}`} />
                  ))}
                </div>
                <p className="mt-3 font-bold text-dark" aria-live="polite">
                  {remaining === 0 ? "Your box is full! 🎉" : `${picked} of ${boxCount} picked — ${remaining} to go`}
                </p>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl mx-auto">
                {BOX_BITES.map((bite) => (
                  <div key={bite.id} className="bg-white rounded-2xl p-4 flex items-center justify-between gap-3 border border-bitepink-light/60">
                    <div className="min-w-0">
                      <p className="font-bold text-dark uppercase tracking-wide text-sm">{bite.name}</p>
                      <p className="text-dark/50 italic text-xs mt-0.5">{bite.description}</p>
                    </div>
                    <Stepper
                      value={picks[bite.id] ?? 0}
                      onChange={(n) => setPick(bite.id, n)}
                      label={bite.name}
                      disableIncrement={remaining <= 0}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center items-center">
                <button type="button" onClick={surpriseMe} disabled={remaining <= 0} className="rounded-full border-2 border-bitepink text-bitepink-dark font-bold px-6 py-3 hover:bg-bitepink hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  🎲 Surprise me
                </button>
                {picked > 0 && (
                  <button type="button" onClick={() => setPicks({})} className="text-sm font-semibold text-dark/50 hover:text-bitepink-dark underline">
                    Clear box
                  </button>
                )}
                <button
                  type="button"
                  onClick={addBox}
                  disabled={remaining !== 0}
                  className="rounded-full bg-bitepink hover:bg-bitepink-dark text-white font-bold px-8 py-3 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
                >
                  {boxJustAdded ? "Box added ✓" : `Add box to order · ${money(boxPriceNow)}`}
                </button>
              </div>
              <p className="text-center text-xs text-dark/40 mt-4">
                Gobble Boxes are made from our {BOX_BITES.length} signature bites. The rest are available individually below.
              </p>
            </div>
          </ScrollReveal>

          {/* À la carte */}
          <div className="mt-16">
            <ScrollReveal>
              <PillHeading>Order individually</PillHeading>
            </ScrollReveal>
            <div className="mt-8 max-w-3xl mx-auto divide-y divide-bitepink-light/50">
              {BITES.map((bite) => (
                <div key={bite.id} className="py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <DottedRow name={`${bite.keto ? "*" : ""}${bite.name}`} price={`${money(bite.price)} each`} />
                    <p className="text-dark/50 italic text-sm mt-1">
                      {bite.keto && <span className="not-italic font-bold text-bitepink-dark">*KETO </span>}
                      {bite.description}
                    </p>
                  </div>
                  <Stepper value={alaCarte[bite.id] ?? 0} onChange={(n) => setAlaCarte((p) => ({ ...p, [bite.id]: n }))} label={bite.name} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="dots-pink" aria-hidden />

      {/* ============ MO&MA CLASSICS ============ */}
      <section id="classics" className="scroll-mt-36 py-16 md:py-24 bg-cream">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <p className="stamp text-burgundy mb-4 block w-fit mx-auto">From the Mo&amp;Ma kitchen</p>
            <h2 className="font-fun text-burgundy text-4xl md:text-6xl text-center mb-3">Mo&amp;Ma Classics</h2>
            <p className="text-center text-dark/60 max-w-xl mx-auto mb-14">
              The original Mo&amp;Ma bakery favorites. These are separate from the Bite Me pies and treats above, but you can order them in the same preorder.
            </p>
          </ScrollReveal>
          {momaCategories.map((c) => (
            <CategoryBlock key={c.id} category={{ ...c, blurb: undefined }} tone="moma" countFor={pieCount} onAdd={addPie} />
          ))}
        </div>
      </section>

      {/* ============ YOUR PREORDER ============ */}
      <section id="your-preorder" ref={formRef} className="scroll-mt-28 py-16 md:py-24 bg-gradient-to-b from-bitepink-pale to-bitepink-blush">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="font-fun text-bitepink-dark text-4xl md:text-6xl text-center mb-3">Your preorder</h2>
            <p className="text-center text-dark/60 mb-10">
              Look it over, tell us who&apos;s picking up, and send it in.
            </p>
          </ScrollReveal>

          {done ? (
            <div className="bg-white rounded-[2rem] border-4 border-dotted border-bitepink p-8 md:p-12 text-center">
              <p className="text-6xl mb-4" aria-hidden>🦃🥧</p>
              <h3 className="font-fun text-bitepink-dark text-3xl md:text-4xl mb-3">Preorder received!</h3>
              <p className="text-dark/70 mb-6">
                Thank you, {name.split(" ")[0] || "friend"}! We&apos;ll reach out by email or text to confirm your order and pickup details.
                No payment has been taken.
              </p>
              <ul className="text-left max-w-md mx-auto space-y-2 mb-6">
                {done.lines.map((l, i) => (
                  <li key={i} className="flex justify-between gap-4 text-sm">
                    <span>
                      {l.kind === "box" ? "" : `${l.qty}× `}{l.label}
                    </span>
                    <span className="font-bold">{money(l.amount)}</span>
                  </li>
                ))}
                <li className="flex justify-between gap-4 pt-2 border-t border-bitepink-light font-bold text-bitepink-dark">
                  <span>Estimated total</span>
                  <span>{money(done.total)}</span>
                </li>
              </ul>
              <button type="button" onClick={startOver} className="btn-secondary">Start another preorder</button>
            </div>
          ) : (
            <form onSubmit={submit} className="bg-white rounded-[2rem] border-4 border-dotted border-bitepink p-6 md:p-10 space-y-8">
              {/* Cart */}
              <div>
                <h3 className="font-fun text-bitepink-dark text-2xl mb-4">What&apos;s in your order</h3>
                {cart ? (
                  <>
                    <ul className="divide-y divide-bitepink-light/50">
                      {cart.lines.map((l, i) => (
                        <li key={`${l.kind}-${i}`} className="py-3 flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-bold text-dark text-sm md:text-base">
                              {l.kind === "box" ? "" : `${l.qty}× `}{l.label}
                            </p>
                            {l.detail && <p className="text-dark/50 text-xs mt-0.5">{l.detail}</p>}
                            <button type="button" onClick={() => removeLine(i)} className="text-xs font-semibold text-dark/40 hover:text-bitepink-dark underline mt-1">
                              Remove
                            </button>
                          </div>
                          <span className="font-bold text-bitepink-dark whitespace-nowrap">{money(l.amount)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex justify-between items-center pt-4 border-t-2 border-dotted border-bitepink/40 mt-2">
                      <span className="font-bold text-dark">Estimated total</span>
                      <span className="font-fun text-bitepink-dark text-3xl">{money(cart.total)}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 rounded-2xl bg-bitepink-blush">
                    <p className="text-4xl mb-2" aria-hidden>🛒</p>
                    <p className="text-dark/60">Nothing here yet — add pies, bites or a Gobble Box above.</p>
                  </div>
                )}
              </div>

              {/* Contact */}
              <div>
                <h3 className="font-fun text-bitepink-dark text-2xl mb-4">Your info</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="tg-name" className="block text-sm font-semibold text-dark mb-1.5">Name *</label>
                    <input id="tg-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="tg-phone" className="block text-sm font-semibold text-dark mb-1.5">Phone *</label>
                    <input id="tg-phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" autoComplete="tel" className={inputClass} />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="tg-email" className="block text-sm font-semibold text-dark mb-1.5">Email *</label>
                    <input id="tg-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" className={inputClass} />
                  </div>
                </div>
              </div>

              {/* Pickup */}
              <div>
                <h3 className="font-fun text-bitepink-dark text-2xl mb-1">Pickup</h3>
                <p className="text-sm text-dark/60 mb-4">
                  Pickup only. We&apos;ll email your pickup location with your confirmation.
                </p>
                {hasPickupWindows ? (
                  <div className="space-y-2" role="radiogroup" aria-label="Pickup window">
                    {THANKSGIVING_INFO.pickupWindows.map((w) => (
                      <label key={w} className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-colors ${pickup === w ? "border-bitepink bg-bitepink-pale" : "border-bitepink-light hover:border-bitepink"}`}>
                        <input type="radio" name="tg-pickup" required value={w} checked={pickup === w} onChange={() => setPickup(w)} className="w-5 h-5 accent-bitepink" />
                        <span className="font-semibold text-dark">{w}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <>
                    <label htmlFor="tg-pickup" className="block text-sm font-semibold text-dark mb-1.5">Preferred pickup day &amp; time *</label>
                    <input id="tg-pickup" required value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="e.g. Wednesday afternoon" className={inputClass} />
                    <p className="text-xs text-dark/40 mt-1.5">We&apos;ll confirm the exact time with you.</p>
                  </>
                )}
              </div>

              <div>
                <label htmlFor="tg-notes" className="block text-sm font-semibold text-dark mb-1.5">Allergies or special requests</label>
                <textarea id="tg-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything we should know?" className={`${inputClass} resize-none`} />
              </div>

              {error && <p role="alert" className="rounded-xl bg-red/10 text-red px-4 py-3 text-sm font-semibold">{error}</p>}

              <div>
                <button
                  type="submit"
                  disabled={!cart || submitting}
                  className="w-full rounded-full bg-bitepink hover:bg-bitepink-dark text-white font-bold text-lg py-4 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
                >
                  {submitting ? "Sending…" : cart ? `Send my preorder · ${money(cart.total)}` : "Add something to send your preorder"}
                </button>
                <p className="text-center text-xs text-dark/50 mt-3">
                  No payment is taken here. We&apos;ll confirm your order and total before anything is final.
                </p>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* Sticky order bar */}
      {cart && !formInView && !done && (
        <div className="fixed bottom-4 inset-x-4 z-40 flex justify-center pointer-events-none">
          <button
            type="button"
            onClick={scrollToForm}
            className="pointer-events-auto flex items-center gap-4 rounded-full bg-bitepink hover:bg-bitepink-dark text-white pl-5 pr-3 py-3 shadow-2xl transition-colors"
          >
            <span className="font-bold text-sm">
              🦃 {cart.itemCount} {cart.itemCount === 1 ? "item" : "items"} · {money(cart.total)}
            </span>
            <span className="bg-white text-bitepink-dark font-bold text-sm rounded-full px-4 py-2">Review &amp; send</span>
          </button>
        </div>
      )}
    </div>
  );
}
