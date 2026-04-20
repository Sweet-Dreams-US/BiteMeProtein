# Images + CMS — Design Spec

**Date:** 2026-04-19
**Sub-project:** 3 of 5 in the BiteMeProtein admin-side roadmap
**Status:** approved, ready for implementation
**Depends on:** sub-projects 1 + 2 (error_logs, logError, square_products)

## Problem

1. **Images are hard-coded** in `lib/images.ts` + `lib/brand.ts`. Adding a product requires: create in Square → enrich in Supabase → upload image to Storage → **edit `lib/images.ts` + `app/shop/page.tsx`** → deploy. Step 4 blocks Haley.
2. **Every static page's copy is hard-coded.** Home hero, testimonials, trainer bios, about, reviews, contact, ambassador — every edit needs a developer.

Audit result (2026-04-19): every image currently referenced in code IS on Supabase (productPhotos, ProductExtras, pictures, BusinessAssets buckets). The 5 files in `public/*.svg` are unused `create-next-app` boilerplate — safe to delete.

## Goals

After this sub-project ships:

1. Haley uploads a new product image from `/admin/products` without any code change — drag, drop, reorder, save.
2. Every copy string on every static page is editable from `/admin/content` without a deploy.
3. Every public page still works identically to today (same look, same copy), now sourced from the DB with hard-coded fallback if the DB is empty.
4. `lib/images.ts` stays as a thin compat layer (DB-first, hard-coded fallback) so the blast radius is zero on day one.

## Non-goals

- **No rich-text editor** — plain text / textarea / JSON editor. Rich HTML with WYSIWYG is its own sprint if ever needed.
- **No content versioning/history.** `updated_at` + a single row is the state. Supabase's own point-in-time restore is the rollback mechanism.
- **No i18n / translations.**
- **No scheduled publishing.** Save = live.
- **No per-page drag-and-drop layout editing.** Keys are defined in code; values are editable.

## Design

### Data model — 3 new tables

**`site_content`** — key/value store for text/json content
```sql
key         text primary key,
value       jsonb not null,
updated_at  timestamptz not null default now(),
updated_by  uuid references auth.users(id)
```

Keys use dot notation: `hero.title`, `hero.subtitle`, `home.testimonials`, `trainers`, `about.story`, `contact.email`, `reviews`, `ambassador.copy`, etc.

`value` is `jsonb` so it can hold any shape — a string, an array of testimonial objects, a structured contact object, etc.

**`site_images`** — non-product images by key (hero, logos, about photos)
```sql
key         text primary key,
url         text not null,
alt         text,
updated_at  timestamptz not null default now()
```

**`product_images`** — product photo catalog
```sql
id                 uuid primary key default gen_random_uuid(),
square_product_id  text references public.square_products(id) on delete set null,
slug               text,               -- fallback identifier when Square product not yet synced
url                text not null,
kind               text not null check (kind in ('product','nutrition','lifestyle')) default 'product',
alt                text,
sort_order         int not null default 0,
created_at         timestamptz not null default now()
```

Seed rows have `slug` populated and `square_product_id` null. On admin product-edit, unmatched images can be linked. Auto-linking by name-similarity is a later enhancement.

### RLS

All three tables: authenticated admin SELECT via `is_admin()` from sub1; service role writes; nobody else any access. On public pages, content reads happen via a server route that returns data fetched with the service role (or via the anon client — both work since `SELECT` for authenticated is allowed and anon reads happen via a public-read policy limited to specific keys).

Wait — **public pages need to read this data.** That means either:
1. **Server-side fetch via service role** — page is a server component / uses a server helper, forwards already-rendered content. Safest.
2. **Client-side fetch with anon key + open RLS** — client components fetch directly. Requires permissive RLS.

Going with **(1)** — server-side fetch in a shared helper `getContent(key, fallback)`. Public pages are client components today; they call a lightweight `/api/content?keys=hero.title,...` or pull on mount. Simpler: keep an `anonymous-read` RLS policy so client components just call Supabase directly. Safer: server route.

**Decision: client components use a `useContent(key, fallback)` hook that fetches directly from Supabase (anon key + public read policy).** Content is non-sensitive public website copy — it's literally meant to be on the public internet. No reason to force a server round-trip.

Public-read RLS on `site_content`, `site_images`, `product_images`:
```sql
create policy "public read <table>" on public.<table>
  for select to anon, authenticated using (true);
```

Writes still locked down to service role only.

### Storage bucket policies

`productPhotos` bucket already exists, public-read. Need: admin write policy so admin can upload directly client-side via the admin's JWT session.

Apply this via Supabase SQL editor (storage policies are a bit different — they apply to `storage.objects` table):
```sql
create policy "admin upload productPhotos"
  on storage.objects
  for insert to authenticated
  with check (bucket_id = 'productPhotos' and public.is_admin());

create policy "admin update productPhotos"
  on storage.objects
  for update to authenticated using (bucket_id = 'productPhotos' and public.is_admin());

create policy "admin delete productPhotos"
  on storage.objects
  for delete to authenticated using (bucket_id = 'productPhotos' and public.is_admin());
```

### Helpers

- **`lib/content.ts`** — `useContent<T>(key, fallback)` hook; `getContent<T>(key, fallback)` server-side.
- **`lib/product-images.ts`** — `useProductImages(squareProductId, slug?)` returns images sorted.
- **`lib/images.ts`** — kept as compat layer. Re-exports the new helpers with the same shape as the legacy object. Consumers that read `images.brownieHearts[0]` still work during migration.

### Admin pages

**`/admin/content`** — grouped editor:
- Groups: Home / Testimonials / Trainers / About / Reviews / Contact / Ambassador / Footer
- Each group shows its keys. Type-aware input: text (single-line), textarea (multi-line), JSON editor (arrays/objects).
- Save writes to `site_content` via service-role API route (so RLS is bypassed safely).

**`/admin/products`** — new "Images" section per product:
- Drag-and-drop multi-file upload (client → Supabase Storage `productPhotos` bucket via user JWT)
- On upload success, insert row into `product_images` via API route (service role)
- Existing images shown as reorderable thumbnails (`@dnd-kit`) with delete button
- Image kind selector (product / nutrition / lifestyle)
- Optional alt text per image

### API routes

- **`GET /api/admin/content`** (admin) — list all content rows grouped by prefix
- **`PUT /api/admin/content`** (admin) — upsert a single key
- **`POST /api/admin/product-images`** (admin) — attach an uploaded image to a product
- **`PATCH /api/admin/product-images`** (admin) — reorder (bulk update sort_order)
- **`DELETE /api/admin/product-images?id=<uuid>`** (admin) — remove

### Migration plan

One migration file with:
1. CREATE TABLE for 3 tables + RLS policies
2. Storage policies for `productPhotos`
3. Seed data for:
   - Every URL in `lib/images.ts` → `product_images` (by slug) + `site_images` (for Haley photos)
   - Every URL in `lib/brand.ts` → `site_images` (logos)
   - Every hard-coded copy string on public pages → `site_content`

Seed values match today's copy exactly. Zero behavior change unless admin edits.

## Public-page migration strategy

Each page swap follows the same pattern:
```tsx
// Before
const title = "Bite Me";

// After
const title = useContent("hero.title", "Bite Me");
```

`useContent` returns `fallback` synchronously on first render (no UI flicker), then re-renders with DB value on fetch completion. If DB is empty or fetch fails, the fallback stays — the site never breaks.

Pages to refactor (ordered by visibility):
1. `app/page.tsx` — home hero + testimonials (highest visibility)
2. `app/shop/page.tsx` — product images via `product_images`
3. `app/about/page.tsx`
4. `app/trainers/page.tsx`
5. `app/reviews/page.tsx`
6. `app/contact/page.tsx`
7. `app/ambassador/page.tsx`

### Cleanup

- Delete `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg` — unused `create-next-app` boilerplate (grepped, zero references).

## Tests

- `lib/content.test.ts` — `useContent` returns fallback when Supabase fetch fails; returns value on success; SSR-safe (no window access at import time)
- `lib/product-images.test.ts` — sorts by sort_order; filters by kind
- `app/api/admin/content/route.test.ts` — 401 unauthed; list grouped response shape; PUT upserts
- `app/api/admin/product-images/route.test.ts` — POST inserts; PATCH reorder atomicity; DELETE returns 204

## Rollout

One PR on top of sub2. Logical commits:

1. `feat(db): site_content + site_images + product_images tables + RLS + storage policies`
2. `feat(db): seed site_content / site_images / product_images from current hard-coded values`
3. `feat: lib/content + lib/product-images helpers (with fallback)`
4. `feat(admin): /api/admin/content CRUD`
5. `feat(admin): /api/admin/product-images CRUD`
6. `feat(admin): /admin/content grouped editor`
7. `feat(admin): image upload + reorder on /admin/products`
8. `refactor: public pages read content via useContent(key, fallback)`
9. `refactor(shop): read product images from product_images table`
10. `chore: delete unused public/*.svg boilerplate; keep lib/images.ts as compat`
11. `test: content + product-images coverage`

Branch: `images-and-cms-sub3` (based on `square-supabase-sync-sub2`).

## Acceptance criteria

- [ ] `npm test` + `npm run lint` + `npx tsc --noEmit` all green
- [ ] 3 tables created with RLS
- [ ] Storage policies in place for `productPhotos` bucket
- [ ] Seed data populated: every current URL + current copy string
- [ ] `/admin/content` page works — can edit hero, testimonials, trainer bios
- [ ] `/admin/products` has image upload + reorder + delete per product
- [ ] All public pages render identically to today (before admin edits anything)
- [ ] After editing "hero.title" in admin, the home page shows the new title
- [ ] `public/*.svg` boilerplate deleted

## Manual steps after merge

1. Apply migration: `npm run db:push` (or paste SQL into Supabase SQL editor)
2. Apply storage policies (same SQL file includes them, but confirm they got applied — storage policies sometimes need dashboard-side action)
3. Open `/admin/products` — verify existing products now show the seeded images
4. Open `/admin/content` — tweak a testimonial; reload `/` and confirm it updated

## Related
- Sub-project 2: Square → Supabase pipeline (PR #2)
- Client README: `../../Clients/BiteMeProtein/` in Obsidian vault
