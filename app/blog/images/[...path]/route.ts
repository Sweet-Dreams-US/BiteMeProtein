import { readFile } from "node:fs/promises";
import path from "node:path";
import { getReleasedPost } from "@/lib/blog";

/**
 * Serves post images from content/blog/images/<slug>/. An image is only
 * served once the post it belongs to has been released.
 */

const IMAGES_DIR = path.join(process.cwd(), "content", "blog", "images");

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const notFound = () => new Response("Not found", { status: 404 });

  if (!segments || segments.length < 2 || !segments.every((s) => SAFE_SEGMENT.test(s) && !s.includes(".."))) {
    return notFound();
  }
  const type = TYPES[path.extname(segments[segments.length - 1]).toLowerCase()];
  if (!type) return notFound();

  const post = await getReleasedPost(segments[0]);
  if (!post) return notFound();

  const file = path.join(IMAGES_DIR, ...segments);
  if (!file.startsWith(IMAGES_DIR + path.sep)) return notFound();

  try {
    const data = await readFile(file);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch {
    return notFound();
  }
}
