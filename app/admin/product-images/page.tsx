import { redirect } from "next/navigation";

/**
 * The standalone /admin/product-images page was retired — image management
 * now lives directly inside the Website Details modal in /admin/products,
 * so admins don't have to hop tabs to upload a photo for a product they're
 * already editing. We redirect any stale links/bookmarks rather than 404
 * because the URL was widely shared during early testing.
 */
export default function ProductImagesRedirect() {
  redirect("/admin/products");
}
