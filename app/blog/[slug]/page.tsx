import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BlogBody, { InlineText } from "@/components/blog/BlogBody";
import BlogToc from "@/components/blog/BlogToc";
import { SITE_URL, formatReleaseDate, getReleasedPost, getReleasedPosts } from "@/lib/blog";
import { parseBody } from "@/lib/blog-markdown";
import { brand } from "@/lib/brand";

// Posts are read from content/blog when the page renders. Revalidating every
// hour is what lets a post appear on its release date without a deploy.
export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

// Posts released at build time are prerendered. A post that releases later is
// rendered on its first visit and then rebuilt every hour. A post that is not
// due yet never reaches this page: proxy.ts answers it with a real 404 first
// (the app's root loading.tsx would otherwise turn notFound() into a 200).
export async function generateStaticParams() {
  return (await getReleasedPosts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getReleasedPost(slug);
  if (!post) return {};
  const url = `${SITE_URL}/blog/${post.slug}`;
  return {
    title: `${post.title} | Bite Me Protein Bakery`,
    description: post.description || undefined,
    alternates: {
      canonical: url,
      types: { "application/rss+xml": "/blog/rss.xml" },
    },
    openGraph: {
      type: "article",
      url,
      siteName: "Bite Me Protein Bakery",
      title: post.title,
      description: post.description || undefined,
      publishedTime: post.release_on,
      ...(post.cover_image ? { images: [post.cover_image] } : {}),
    },
    twitter: {
      card: post.cover_image ? "summary_large_image" : "summary",
      title: post.title,
      description: post.description || undefined,
      ...(post.cover_image ? { images: [post.cover_image] } : {}),
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getReleasedPost(slug);
  if (!post) notFound();

  const { blocks, headings, closing } = parseBody(post.body);
  const url = `${SITE_URL}/blog/${post.slug}`;
  const absolute = (src: string) => (/^https?:\/\//i.test(src) ? src : `${SITE_URL}${src}`);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description || undefined,
    datePublished: post.release_on,
    dateModified: post.release_on,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    ...(post.cover_image ? { image: [absolute(post.cover_image)] } : {}),
    author: { "@type": "Organization", name: "Bite Me Protein Bakery", url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: "Bite Me Protein Bakery",
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: brand.squareLogo },
    },
    ...(post.sources.length
      ? { citation: post.sources.map((s) => ({ "@type": "CreativeWork", name: s.title, url: s.url })) }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      {/* Header */}
      <section className="pt-12 md:pt-16 pb-10 bg-gradient-warm relative overflow-hidden">
        <div className="absolute top-10 right-10 md:right-16 w-20 h-20 rounded-full bg-salmon/15 animate-float" />
        <div className="absolute bottom-8 left-8 md:left-12 w-14 h-14 rounded-full bg-golden/20 animate-float-reverse" />
        <div className="relative max-w-3xl mx-auto px-6 lg:px-8 text-center">
          <Link
            href="/blog"
            className="stamp text-burgundy mb-6 hover:bg-burgundy hover:text-white transition-colors"
          >
            All posts
          </Link>
          <h1 className="font-fun text-burgundy text-4xl md:text-6xl leading-[1.08] mb-5">{post.title}</h1>
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-bold uppercase tracking-widest text-burgundy/70">
            <time dateTime={post.release_on}>{formatReleaseDate(post.release_on)}</time>
            <span aria-hidden="true" className="h-1 w-1 rounded-full bg-salmon" />
            <span>{post.reading_minutes} min read</span>
          </p>
          {post.description ? (
            <p className="text-body-lg text-dark/55 max-w-xl mx-auto mt-5">{post.description}</p>
          ) : null}
        </div>
      </section>

      {/* Post */}
      <div className="bg-cream pb-6">
        <article id="blog-article" className="max-w-2xl mx-auto px-6 py-10 md:py-14">
          {post.cover_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.cover_image}
              alt=""
              className="mb-8 aspect-[16/9] w-full rounded-3xl border border-burgundy/10 object-cover"
            />
          ) : null}

          <BlogBody blocks={blocks} />

          {post.sources.length > 0 ? (
            <section aria-labelledby="blog-sources" className="mt-14 border-t border-burgundy/10 pt-8">
              <h2
                id="blog-sources"
                className="mb-4 text-xs font-extrabold uppercase tracking-widest text-burgundy"
              >
                Sources
              </h2>
              <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm leading-relaxed text-dark/70 marker:font-bold marker:text-salmon">
                {post.sources.map((s) => (
                  <li key={s.url} className="pl-1">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-burgundy underline decoration-salmon decoration-2 underline-offset-4 hover:text-burgundy-dark transition-colors break-words"
                    >
                      {s.title}
                    </a>
                    {s.author ? `, ${s.author}` : ""}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {closing ? (
            <p className="mt-8 text-sm italic leading-relaxed text-dark/60">
              <InlineText nodes={closing} />
            </p>
          ) : null}
        </article>
      </div>

      {/* Back to the blog */}
      <section className="py-12 bg-white">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <p className="font-fun text-burgundy text-3xl mb-5">Hungry for more?</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/blog" className="btn-secondary">
              More from the blog
            </Link>
            <Link href="/shop" className="btn-primary">
              Shop now
            </Link>
          </div>
        </div>
      </section>

      <BlogToc headings={headings} articleId="blog-article" />
    </>
  );
}
