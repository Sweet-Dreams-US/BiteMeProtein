import Link from "next/link";
import type { Block, Inline } from "@/lib/blog-markdown";
import { isSafeHref } from "@/lib/blog-markdown";

const linkClass =
  "text-burgundy font-semibold underline decoration-salmon decoration-2 underline-offset-4 hover:text-burgundy-dark transition-colors";

function imageSrc(src: string): string {
  if (/^(https?:)?\/\//i.test(src) || src.startsWith("/")) return src;
  return `/blog/${src.replace(/^\.?\/+/, "")}`;
}

export function InlineText({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.t) {
          case "text":
            return n.v;
          case "strong":
            return (
              <strong key={i} className="font-bold text-dark">
                <InlineText nodes={n.c} />
              </strong>
            );
          case "em":
            return (
              <em key={i}>
                <InlineText nodes={n.c} />
              </em>
            );
          case "code":
            return (
              <code key={i} className="rounded-md bg-cream-dark px-1.5 py-0.5 text-[0.9em] text-burgundy-dark">
                {n.v}
              </code>
            );
          case "link": {
            if (!isSafeHref(n.href)) return <InlineText key={i} nodes={n.c} />;
            if (n.href.startsWith("/")) {
              return (
                <Link key={i} href={n.href} className={linkClass}>
                  <InlineText nodes={n.c} />
                </Link>
              );
            }
            return (
              <a key={i} href={n.href} className={linkClass} target="_blank" rel="noopener noreferrer">
                <InlineText nodes={n.c} />
              </a>
            );
          }
        }
      })}
    </>
  );
}

const paragraphClass = "text-[1.0625rem] md:text-lg leading-[1.75] text-dark/80";

function Callout({ block }: { block: Extract<Block, { t: "callout" }> }) {
  const isTip = block.kind === "tip";
  return (
    <aside
      className={
        isTip
          ? "my-9 rounded-3xl border border-golden-dark/40 bg-golden-light/60 p-6 md:p-8"
          : "my-9 rounded-3xl border border-burgundy/10 border-l-4 border-l-salmon bg-white p-6 md:p-8 shadow-[0_4px_24px_rgba(132,52,48,0.04)]"
      }
    >
      <p
        className={
          isTip
            ? "inline-block rounded-full bg-burgundy px-3 py-1 text-[0.7rem] font-extrabold uppercase tracking-widest text-white"
            : "inline-block rounded-full bg-salmon/30 px-3 py-1 text-[0.7rem] font-extrabold uppercase tracking-widest text-burgundy"
        }
      >
        {isTip ? "Tip" : "Note"}
      </p>
      {block.title ? (
        <h3 className="font-fun text-burgundy text-2xl md:text-3xl mt-3 mb-2 leading-tight">{block.title}</h3>
      ) : null}
      <div className="flex flex-col gap-3">
        {block.blocks.map((b, i) => (
          <BlockView key={i} block={b} compact />
        ))}
      </div>
      {isTip && block.links.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-3">
          {block.links.map((l, i) => {
            const cls = "btn-primary text-sm py-3 px-6";
            if (l.href.startsWith("/") && isSafeHref(l.href)) {
              return (
                <Link key={i} href={l.href} className={cls}>
                  {l.text}
                </Link>
              );
            }
            if (!isSafeHref(l.href)) return null;
            return (
              <a key={i} href={l.href} className={cls} target="_blank" rel="noopener noreferrer">
                {l.text}
              </a>
            );
          })}
        </div>
      ) : null}
    </aside>
  );
}

function BlockView({ block, compact = false }: { block: Block; compact?: boolean }) {
  switch (block.t) {
    case "h": {
      if (block.level === 2) {
        return (
          <h2
            id={block.id}
            className="font-display text-burgundy text-[1.65rem] md:text-3xl font-bold leading-tight mt-9 md:mt-14 mb-3 md:mb-4 scroll-mt-28"
          >
            <InlineText nodes={block.c} />
          </h2>
        );
      }
      if (block.level === 3) {
        return (
          <h3 id={block.id} className="font-display text-dark text-xl md:text-2xl font-bold mt-8 mb-3 scroll-mt-28">
            <InlineText nodes={block.c} />
          </h3>
        );
      }
      return (
        <h4 id={block.id} className="text-dark text-lg font-bold mt-6 mb-2 scroll-mt-28">
          <InlineText nodes={block.c} />
        </h4>
      );
    }
    case "p":
      return (
        <p className={compact ? "text-base md:text-[1.0625rem] leading-relaxed text-dark/80" : paragraphClass}>
          <InlineText nodes={block.c} />
        </p>
      );
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag
          className={`${block.ordered ? "list-decimal" : "list-disc"} pl-6 flex flex-col gap-2 marker:text-salmon marker:font-bold ${
            compact ? "text-base" : paragraphClass
          } ${compact ? "text-dark/80" : ""}`}
        >
          {block.items.map((item, i) => (
            <li key={i} className="pl-1">
              <InlineText nodes={item} />
            </li>
          ))}
        </Tag>
      );
    }
    case "quote":
      return (
        <blockquote className="my-2 border-l-4 border-salmon pl-5 italic flex flex-col gap-3">
          {block.blocks.map((b, i) => (
            <BlockView key={i} block={b} compact />
          ))}
        </blockquote>
      );
    case "hr":
      return <hr className="my-10 border-0 h-px bg-burgundy/15" />;
    case "code":
      return (
        <pre className="my-4 overflow-x-auto rounded-2xl bg-dark p-5 text-sm leading-relaxed text-cream">
          <code>{block.v}</code>
        </pre>
      );
    case "img":
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc(block.src)}
          alt={block.alt}
          loading="lazy"
          className="my-4 w-full rounded-3xl border border-burgundy/10"
        />
      );
    case "callout":
      return <Callout block={block} />;
  }
}

export default function BlogBody({ blocks }: { blocks: Block[] }) {
  return (
    <div className="flex flex-col gap-5">
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </div>
  );
}
