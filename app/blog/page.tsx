import type { Metadata } from "next";
import Link from "next/link";
import ScrollReveal from "@/components/animations/ScrollReveal";
import AnimatedSquiggly from "@/components/animations/AnimatedSquiggly";
import { formatReleaseDate, getReleasedPosts } from "@/lib/blog";

// Posts are read from content/blog when the page renders. Revalidating every
// hour is what lets a post appear on its release date without a deploy.
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const posts = await getReleasedPosts();
  return {
    title: "Blog | Bite Me Protein Bakery",
    description: "Easy reads from Bite Me Protein Bakery about protein and food.",
    alternates: {
      canonical: "/blog",
      types: { "application/rss+xml": "/blog/rss.xml" },
    },
    robots: posts.length ? undefined : { index: false, follow: true },
  };
}

export default async function BlogIndexPage() {
  const posts = await getReleasedPosts();

  return (
    <>
      {/* Header */}
      <section className="pt-16 pb-10 bg-gradient-warm relative overflow-hidden">
        <div className="absolute top-10 right-10 md:right-16 w-20 h-20 rounded-full bg-salmon/15 animate-float" />
        <div className="absolute bottom-8 left-8 md:left-12 w-14 h-14 rounded-full bg-golden/20 animate-float-reverse" />
        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <ScrollReveal>
            <p className="stamp text-burgundy mb-6">The Blog</p>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <h1 className="font-fun text-burgundy text-5xl md:text-7xl mb-4">
              Fresh from the <AnimatedSquiggly>bakery.</AnimatedSquiggly>
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-body-lg text-dark/50 max-w-lg mx-auto">
              Easy reads about protein and food, from Bite Me Protein Bakery.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Posts */}
      <section className="py-12 md:py-16 bg-cream">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">
          {posts.length === 0 ? (
            <ScrollReveal>
              <div className="card-bakery p-8 md:p-12 text-center">
                <span className="text-4xl mb-3 block">🧁</span>
                <h2 className="font-fun text-burgundy text-3xl mb-2">Fresh posts are on the way.</h2>
                <p className="text-dark/60 mb-6">Check back soon. The treats are ready while you wait.</p>
                <Link href="/shop" className="btn-primary">
                  Shop now
                </Link>
              </div>
            </ScrollReveal>
          ) : (
            <ul className="flex flex-col gap-6">
              {posts.map((post, i) => (
                <li key={post.slug}>
                  <ScrollReveal delay={Math.min(i, 3) * 0.08}>
                    <Link href={`/blog/${post.slug}`} className="card-bakery group block p-6 md:p-9">
                      {post.cover_image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={post.cover_image}
                          alt=""
                          loading="lazy"
                          className="mb-5 aspect-[16/9] w-full rounded-2xl object-cover"
                        />
                      ) : null}
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold uppercase tracking-widest text-burgundy/70">
                        <time dateTime={post.release_on}>{formatReleaseDate(post.release_on)}</time>
                        <span aria-hidden="true" className="h-1 w-1 rounded-full bg-salmon" />
                        <span>{post.reading_minutes} min read</span>
                      </p>
                      <h2 className="font-display text-burgundy text-2xl md:text-3xl font-bold leading-tight mt-3">
                        {post.title}
                      </h2>
                      {post.description ? (
                        <p className="text-dark/60 leading-relaxed mt-3">{post.description}</p>
                      ) : null}
                      <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-burgundy">
                        Read the post
                        <svg
                          viewBox="0 0 20 20"
                          aria-hidden="true"
                          className="h-4 w-4 transition-transform group-hover:translate-x-1"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M4 10h12M11 5l5 5-5 5" />
                        </svg>
                      </span>
                    </Link>
                  </ScrollReveal>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
