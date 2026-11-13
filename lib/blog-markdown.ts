/**
 * A small markdown reader for blog posts. It understands exactly what the
 * blog format needs (headings, paragraphs, flat lists, quotes, rules, code,
 * images, and the :::tip / :::note callouts) and turns it into plain data
 * that the blog components render as React elements. No HTML is ever
 * injected, and post text is never altered.
 */

export type Inline =
  | { t: "text"; v: string }
  | { t: "strong"; c: Inline[] }
  | { t: "em"; c: Inline[] }
  | { t: "code"; v: string }
  | { t: "link"; href: string; c: Inline[] };

export interface CalloutLink {
  text: string;
  href: string;
}

export type Block =
  | { t: "h"; level: 2 | 3 | 4; id: string; text: string; c: Inline[] }
  | { t: "p"; c: Inline[] }
  | { t: "list"; ordered: boolean; items: Inline[][] }
  | { t: "quote"; blocks: Block[] }
  | { t: "hr" }
  | { t: "code"; v: string }
  | { t: "img"; alt: string; src: string }
  | { t: "callout"; kind: "tip" | "note"; title: string; blocks: Block[]; links: CalloutLink[] };

export interface BlogHeading {
  id: string;
  text: string;
}

export interface ParsedBody {
  blocks: Block[];
  /** The `##` headings, in order. These make the table of contents. */
  headings: BlogHeading[];
  /** A closing "not medical advice" paragraph, kept word for word, shown last. */
  closing: Inline[] | null;
}

/* ------------------------------------------------------------------ inline */

const ESCAPABLE = /[\\`*_{}[\]()#+\-.!|:>~]/;

function findClosingBracket(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === "\\") {
      i++;
      continue;
    }
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findClosingParen(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let buf = "";
  const flush = () => {
    if (buf) {
      out.push({ t: "text", v: buf });
      buf = "";
    }
  };

  let i = 0;
  while (i < src.length) {
    const ch = src[i];

    if (ch === "\\" && i + 1 < src.length && ESCAPABLE.test(src[i + 1])) {
      buf += src[i + 1];
      i += 2;
      continue;
    }

    if (ch === "`") {
      const end = src.indexOf("`", i + 1);
      if (end > i + 1) {
        flush();
        out.push({ t: "code", v: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    if (ch === "[") {
      const close = findClosingBracket(src, i);
      if (close > i && src[close + 1] === "(") {
        const parenEnd = findClosingParen(src, close + 1);
        if (parenEnd > close + 1) {
          const rawTarget = src.slice(close + 2, parenEnd).trim();
          const href = rawTarget.split(/\s+/)[0] ?? "";
          if (href) {
            flush();
            out.push({ t: "link", href, c: parseInline(src.slice(i + 1, close)) });
            i = parenEnd + 1;
            continue;
          }
        }
      }
    }

    if (ch === "*" && src[i + 1] === "*") {
      const end = src.indexOf("**", i + 2);
      if (end > i + 2) {
        flush();
        out.push({ t: "strong", c: parseInline(src.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }

    if (ch === "*" && src[i + 1] !== "*" && src[i + 1] !== " " && src[i + 1] !== undefined) {
      let end = i + 1;
      while (end < src.length) {
        end = src.indexOf("*", end);
        if (end === -1 || src[end + 1] !== "*") break;
        end += 2;
      }
      if (end > i + 1 && src[end - 1] !== " ") {
        flush();
        out.push({ t: "em", c: parseInline(src.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }

    if (ch === "_" && !/[A-Za-z0-9]/.test(src[i - 1] ?? "") && src[i + 1] && src[i + 1] !== " " && src[i + 1] !== "_") {
      let end = src.indexOf("_", i + 1);
      while (end !== -1 && /[A-Za-z0-9]/.test(src[end + 1] ?? "")) end = src.indexOf("_", end + 1);
      if (end > i + 1 && src[end - 1] !== " ") {
        flush();
        out.push({ t: "em", c: parseInline(src.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }

    buf += ch;
    i++;
  }
  flush();
  return out;
}

export function inlineToText(nodes: Inline[]): string {
  return nodes
    .map((n) => {
      if (n.t === "text" || n.t === "code") return n.v;
      return inlineToText(n.c);
    })
    .join("");
}

/* --------------------------------------------------------------- callouts */

/**
 * Inside a tip, links become buttons under the text, never inline links.
 *  - A link standing alone at the end of the text ("... for you. [Find your treat](/quiz)")
 *    moves out of the sentence and becomes the button.
 *  - A link that is part of a sentence keeps its words in the sentence as plain
 *    text, and the same link is offered as a button too.
 */
function liftLinks(nodes: Inline[], found: CalloutLink[]): Inline[] {
  let list = nodes;

  // Is the last meaningful node a link set apart from the sentence before it?
  let lastIdx = list.length - 1;
  while (lastIdx >= 0) {
    const n = list[lastIdx];
    if (n.t === "text" && n.v.trim() === "") lastIdx--;
    else break;
  }
  const last = lastIdx >= 0 ? list[lastIdx] : undefined;
  if (last && last.t === "link") {
    const prev = lastIdx > 0 ? list[lastIdx - 1] : undefined;
    const standalone =
      !prev || (prev.t === "text" && (prev.v.trim() === "" || /[.!?:]["')”]?\s+$/.test(prev.v)));
    if (standalone) {
      found.push({ text: inlineToText(last.c).trim(), href: last.href });
      list = list.slice(0, lastIdx);
      const tail = list[list.length - 1];
      if (tail && tail.t === "text") {
        const trimmed: Inline = { t: "text", v: tail.v.replace(/\s+$/, "") };
        list = [...list.slice(0, -1), trimmed].filter((n) => !(n.t === "text" && n.v === ""));
      }
    }
  }

  const flatten = (items: Inline[]): Inline[] =>
    items.flatMap((n): Inline[] => {
      if (n.t === "link") {
        found.push({ text: inlineToText(n.c).trim(), href: n.href });
        return flatten(n.c);
      }
      if (n.t === "strong" || n.t === "em") return [{ ...n, c: flatten(n.c) }];
      return [n];
    });

  return flatten(list);
}

function liftCalloutLinks(blocks: Block[]): { blocks: Block[]; links: CalloutLink[] } {
  const found: CalloutLink[] = [];
  const next: Block[] = [];
  for (const b of blocks) {
    if (b.t === "p") {
      const c = liftLinks(b.c, found);
      if (c.length) next.push({ ...b, c });
    } else if (b.t === "list") {
      next.push({ ...b, items: b.items.map((it) => liftLinks(it, found)) });
    } else {
      next.push(b);
    }
  }
  const seen = new Set<string>();
  const links = found.filter((l) => {
    const key = `${l.href}\u0000${l.text}`;
    if (!l.text || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { blocks: next, links };
}

/* ------------------------------------------------------------------ blocks */

const RE_FENCE = /^```/;
const RE_CALLOUT_OPEN = /^:::(tip|note)\b[ \t]*(.*)$/i;
const RE_CALLOUT_CLOSE = /^:::[ \t]*$/;
const RE_HEADING = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/;
const RE_HR = /^(?:-{3,}|\*{3,}|_{3,})[ \t]*$/;
const RE_UL = /^[ \t]*[-*+][ \t]+(.*)$/;
const RE_OL = /^[ \t]*\d+[.)][ \t]+(.*)$/;
const RE_QUOTE = /^>[ \t]?(.*)$/;
const RE_IMG = /^!\[([^\]]*)\]\(([^)\s]+)(?:[ \t]+"[^"]*")?\)[ \t]*$/;

function slugify(text: string): string {
  const s = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "section";
}

function startsBlock(line: string): boolean {
  return (
    RE_FENCE.test(line) ||
    RE_CALLOUT_OPEN.test(line) ||
    RE_HEADING.test(line) ||
    RE_HR.test(line) ||
    RE_UL.test(line) ||
    RE_OL.test(line) ||
    RE_QUOTE.test(line) ||
    RE_IMG.test(line)
  );
}

function parseLines(lines: string[], ids: Map<string, number>, allowCallouts: boolean): Block[] {
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    if (RE_FENCE.test(line)) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !RE_FENCE.test(lines[i])) body.push(lines[i++]);
      i++;
      blocks.push({ t: "code", v: body.join("\n") });
      continue;
    }

    const callout = allowCallouts ? line.match(RE_CALLOUT_OPEN) : null;
    if (callout) {
      const kind = callout[1].toLowerCase() as "tip" | "note";
      const title = callout[2].trim();
      const inner: string[] = [];
      i++;
      while (i < lines.length && !RE_CALLOUT_CLOSE.test(lines[i])) inner.push(lines[i++]);
      i++;
      const parsed = parseLines(inner, ids, false);
      if (kind === "tip") {
        const { blocks: innerBlocks, links } = liftCalloutLinks(parsed);
        blocks.push({ t: "callout", kind, title, blocks: innerBlocks, links });
      } else {
        blocks.push({ t: "callout", kind, title, blocks: parsed, links: [] });
      }
      continue;
    }

    const heading = line.match(RE_HEADING);
    if (heading) {
      const hashes = heading[1].length;
      const level = (hashes <= 2 ? 2 : hashes === 3 ? 3 : 4) as 2 | 3 | 4;
      const c = parseInline(heading[2]);
      const text = inlineToText(c).trim();
      const base = slugify(text);
      const n = ids.get(base) ?? 0;
      ids.set(base, n + 1);
      blocks.push({ t: "h", level, id: n === 0 ? base : `${base}-${n + 1}`, text, c });
      i++;
      continue;
    }

    if (RE_HR.test(line)) {
      blocks.push({ t: "hr" });
      i++;
      continue;
    }

    const img = line.match(RE_IMG);
    if (img) {
      blocks.push({ t: "img", alt: img[1], src: img[2] });
      i++;
      continue;
    }

    if (RE_UL.test(line) || RE_OL.test(line)) {
      const ordered = RE_OL.test(line);
      const re = ordered ? RE_OL : RE_UL;
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(re);
        if (m) {
          items.push(m[1]);
          i++;
          continue;
        }
        // a wrapped continuation line belongs to the item above it
        if (items.length && lines[i].trim() !== "" && /^\s+\S/.test(lines[i]) && !startsBlock(lines[i])) {
          items[items.length - 1] += ` ${lines[i].trim()}`;
          i++;
          continue;
        }
        break;
      }
      blocks.push({ t: "list", ordered, items: items.map(parseInline) });
      continue;
    }

    if (RE_QUOTE.test(line)) {
      const inner: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(RE_QUOTE);
        if (!m) break;
        inner.push(m[1]);
        i++;
      }
      blocks.push({ t: "quote", blocks: parseLines(inner, ids, false) });
      continue;
    }

    const para: string[] = [line.trim()];
    i++;
    while (i < lines.length && lines[i].trim() !== "" && !startsBlock(lines[i])) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push({ t: "p", c: parseInline(para.join(" ")) });
  }

  return blocks;
}

export function parseBody(markdown: string): ParsedBody {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks = parseLines(lines, new Map(), true);

  // A closing "not medical advice" line stays exactly as written and is shown last.
  let closing: Inline[] | null = null;
  const lastBlock = blocks[blocks.length - 1];
  if (lastBlock && lastBlock.t === "p" && /not medical advice/i.test(inlineToText(lastBlock.c))) {
    closing = lastBlock.c;
    blocks.pop();
  }

  const headings = blocks
    .filter((b): b is Extract<Block, { t: "h" }> => b.t === "h" && b.level === 2)
    .map((b) => ({ id: b.id, text: b.text }));

  return { blocks, headings, closing };
}

/** Only these link targets are ever rendered as links. */
export function isSafeHref(href: string): boolean {
  return /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(href);
}
