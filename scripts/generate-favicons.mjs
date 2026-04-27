/**
 * Generate proper favicon.ico + sized icon variants from app/icon.png.
 *
 * Why this exists: the original app/icon.png is 1206x1163 — a great
 * source size for OG images, but Google's SERP icon crawler wants
 * standard favicon sizes (16/32/48px) packed into a real .ico file at
 * /favicon.ico. Without that, Google falls back to the Vercel default
 * triangle in search results.
 *
 * Outputs:
 *   - app/favicon.ico   — multi-size 16/32/48 ICO (Google + IE + others)
 *   - app/icon.png      — 512x512 PNG (browser tab + Next.js auto-link)
 *   - app/apple-icon.png — 180x180 PNG (iOS home-screen icon size)
 *
 * Re-run with: node scripts/generate-favicons.mjs
 * Source preserved at app/icon.source.png.
 */
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const appDir = resolve(root, "app");
const sourcePath = resolve(appDir, "icon.source.png");
const iconPath = resolve(appDir, "icon.png");

// Preserve the original 1206x1163 logo as icon.source.png on first run so
// future regenerations have the high-res master to work from.
if (!existsSync(sourcePath)) {
  copyFileSync(iconPath, sourcePath);
  console.log("Saved high-res master to app/icon.source.png");
}

const source = readFileSync(sourcePath);

console.log("Generating 512x512 icon.png (browser tab)…");
await sharp(source)
  .resize(512, 512, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toFile(iconPath);

console.log("Generating 180x180 apple-icon.png (iOS)…");
await sharp(source)
  .resize(180, 180, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toFile(resolve(appDir, "apple-icon.png"));

console.log("Generating multi-size favicon.ico (16, 32, 48)…");
const sizes = [16, 32, 48];
const pngBuffers = await Promise.all(
  sizes.map((size) =>
    sharp(source)
      .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer(),
  ),
);
const icoBuffer = await pngToIco(pngBuffers);
writeFileSync(resolve(appDir, "favicon.ico"), icoBuffer);

console.log("Done. Files written:");
console.log("  app/favicon.ico (16+32+48)");
console.log("  app/icon.png (512x512)");
console.log("  app/apple-icon.png (180x180)");
