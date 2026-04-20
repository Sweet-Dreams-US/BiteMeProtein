-- 20260419300000_images_and_cms.sql
-- CMS infrastructure for sub-project 3:
--   - product_images   (catalog photos, nutrition cards, lifestyle shots)
--   - site_images      (non-product imagery: hero, logos, Haley's about photos)
--   - cms_content     (all editable copy: hero, testimonials, trainer bios, etc.)
-- Plus RLS, indexes, Supabase Storage policies, and seed data from the
-- current hard-coded values in lib/images.ts + lib/brand.ts.

-- ══════════════════════════════════════════════════════════════════════════
-- product_images
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.product_images (
  id                 uuid primary key default gen_random_uuid(),
  square_product_id  text references public.square_products(id) on delete set null,
  slug               text,
  url                text not null,
  kind               text not null check (kind in ('product', 'nutrition', 'lifestyle')) default 'product',
  alt                text,
  sort_order         int not null default 0,
  created_at         timestamptz not null default now()
);

create index if not exists product_images_square_product_id_idx on public.product_images (square_product_id);
create index if not exists product_images_slug_idx on public.product_images (slug);
create index if not exists product_images_kind_sort_idx on public.product_images (kind, sort_order);

alter table public.product_images enable row level security;

-- Public read — images are meant for public pages
drop policy if exists "public read product_images" on public.product_images;
create policy "public read product_images" on public.product_images
  for select to anon, authenticated using (true);

-- Authenticated admins can write
drop policy if exists "admin write product_images" on public.product_images;
create policy "admin write product_images" on public.product_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ══════════════════════════════════════════════════════════════════════════
-- site_images
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.site_images (
  key         text primary key,
  url         text not null,
  alt         text,
  updated_at  timestamptz not null default now()
);

alter table public.site_images enable row level security;

drop policy if exists "public read site_images" on public.site_images;
create policy "public read site_images" on public.site_images
  for select to anon, authenticated using (true);

drop policy if exists "admin write site_images" on public.site_images;
create policy "admin write site_images" on public.site_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ══════════════════════════════════════════════════════════════════════════
-- cms_content
-- ══════════════════════════════════════════════════════════════════════════
--
-- Named `cms_content` (not `site_content`) to avoid conflicting with any
-- pre-existing `site_content` table that older aspirational code in
-- app/page.tsx was querying against a different (section, content) schema.
-- This sub-project replaces that approach with a flat key/value store.

create table if not exists public.cms_content (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

create index if not exists cms_content_key_prefix_idx on public.cms_content (key text_pattern_ops);

alter table public.cms_content enable row level security;

drop policy if exists "public read cms_content" on public.cms_content;
create policy "public read cms_content" on public.cms_content
  for select to anon, authenticated using (true);

drop policy if exists "admin write cms_content" on public.cms_content;
create policy "admin write cms_content" on public.cms_content
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ══════════════════════════════════════════════════════════════════════════
-- Storage policies for productPhotos bucket
-- ══════════════════════════════════════════════════════════════════════════
-- These let admins upload/update/delete files via the client SDK using
-- their auth JWT. Public read is already on (bucket is public-read).
-- If these error on first apply, they may already exist under a different
-- name — check Supabase Dashboard → Storage → Policies.

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'admin upload productPhotos'
  ) then
    create policy "admin upload productPhotos"
      on storage.objects
      for insert to authenticated
      with check (bucket_id = 'productPhotos' and public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'admin update productPhotos'
  ) then
    create policy "admin update productPhotos"
      on storage.objects
      for update to authenticated
      using (bucket_id = 'productPhotos' and public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'admin delete productPhotos'
  ) then
    create policy "admin delete productPhotos"
      on storage.objects
      for delete to authenticated
      using (bucket_id = 'productPhotos' and public.is_admin());
  end if;
end $$;

-- ══════════════════════════════════════════════════════════════════════════
-- Seed: product_images from lib/images.ts
-- ══════════════════════════════════════════════════════════════════════════
-- Source URL base (productPhotos bucket):
--   https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/
-- Nutrition/lifestyle base (ProductExtras bucket):
--   https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/ProductExtras/
--
-- square_product_id left null initially; admin links them to synced Square
-- products in /admin/products → Images.

insert into public.product_images (slug, url, kind, sort_order, alt)
values
  -- blueberry muffin product
  ('blueberryMuffin', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/blueberryMuffin1.jpg', 'product', 0, 'Blueberry protein muffin'),
  ('blueberryMuffin', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/blueberryMuffin2.jpg', 'product', 1, 'Blueberry protein muffin'),
  ('blueberryMuffin', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/blueberryMuffin3.jpg', 'product', 2, 'Blueberry protein muffin'),

  -- brownie hearts product
  ('brownieHearts', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/brownieHearts1.jpg', 'product', 0, 'Protein brownie heart'),
  ('brownieHearts', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/brownieHearts2.jpg', 'product', 1, 'Protein brownie heart'),
  ('brownieHearts', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/brownieHearts3.jpg', 'product', 2, 'Protein brownie heart'),
  ('brownieHearts', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/brownieHearts4.jpg', 'product', 3, 'Protein brownie heart'),

  -- chocolate chip banana bread product
  ('chocChipBananaBread', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/chocChipBananaBread1.jpg', 'product', 0, 'Chocolate chip banana bread'),
  ('chocChipBananaBread', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/chocChipBananaBread2.jpg', 'product', 1, 'Chocolate chip banana bread'),
  ('chocChipBananaBread', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/chocChipBananaBread3.jpg', 'product', 2, 'Chocolate chip banana bread'),

  -- chocolate truffles product
  ('chocolateTruffles', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/chocolateTruffles1.jpg', 'product', 0, 'Vegan cookie dough protein truffle'),
  ('chocolateTruffles', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/chocolateTruffles2.jpg', 'product', 1, 'Vegan cookie dough protein truffle'),
  ('chocolateTruffles', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/chocolateTruffles3.jpg', 'product', 2, 'Vegan cookie dough protein truffle'),

  -- raspberry chocolate chip banana bread product
  ('rasChocChipBananaBread', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/rasChocChipBananaBread1.jpg', 'product', 0, 'Raspberry chocolate chip banana bread'),
  ('rasChocChipBananaBread', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/rasChocChipBananaBread2.jpg', 'product', 1, 'Raspberry chocolate chip banana bread'),
  ('rasChocChipBananaBread', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/rasChocChipBananaBread3.jpg', 'product', 2, 'Raspberry chocolate chip banana bread'),

  -- nutrition cards
  ('brownieHearts', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/ProductExtras/BrownieNutritionFacts.png', 'nutrition', 0, 'Brownie nutrition facts'),
  ('rasChocChipBananaBread', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/ProductExtras/RASPBERRYCHOCOLATECHIPBANANABreadNutritionFacts.png', 'nutrition', 0, 'Raspberry chocolate chip banana bread nutrition facts'),
  ('chocolateTruffles', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/ProductExtras/VeganCookieDoughTruffleNutritionFacts.png', 'nutrition', 0, 'Vegan cookie dough truffle nutrition facts'),
  ('blueberryMuffin', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/ProductExtras/BlueberryMuffinNutritionFacts.png', 'nutrition', 0, 'Blueberry muffin nutrition facts'),
  ('chocChipBananaBread', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/ProductExtras/ChicChipBananaBreadNutritionFacts.png', 'nutrition', 0, 'Chocolate chip banana bread nutrition facts'),

  -- lifestyle shots
  ('chocolateTruffles', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/ProductExtras/chocTrufflesRedBackground.jpg', 'lifestyle', 0, 'Chocolate truffles on red'),
  ('blueberryMuffin', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/ProductExtras/blueberryMuffinPurpleBackground1.jpg', 'lifestyle', 0, 'Blueberry muffin on purple'),
  ('blueberryMuffin', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/ProductExtras/blueberryMuffinPurpleBackground2.jpg', 'lifestyle', 1, 'Blueberry muffin on purple'),
  ('blueberryMuffin', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/ProductExtras/blueberryMuffinPurpleBackground3.jpg', 'lifestyle', 2, 'Blueberry muffin on purple'),
  ('blueberryMuffin', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/ProductExtras/blueberryMuffinPurpleBackground4.jpg', 'lifestyle', 3, 'Blueberry muffin on purple'),
  ('chocChipBananaBread', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/ProductExtras/chocChipBananaBread.jpg', 'lifestyle', 0, 'Chocolate chip banana bread lifestyle'),
  ('brownieHearts', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/ProductExtras/chocChipHeartBrownies.jpg', 'lifestyle', 0, 'Chocolate chip heart brownies lifestyle'),
  ('rasChocChipBananaBread', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/ProductExtras/chocChipRasberryRedBackground.jpg', 'lifestyle', 0, 'Raspberry choc chip banana bread on red'),
  ('rasChocChipBananaBread', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/ProductExtras/chocChipRasberryRedBackground2.jpg', 'lifestyle', 1, 'Raspberry choc chip banana bread on red'),
  ('rasChocChipBananaBread', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/ProductExtras/chocChipRasberryRedBackground3.jpg', 'lifestyle', 2, 'Raspberry choc chip banana bread on red')
on conflict do nothing;

-- ══════════════════════════════════════════════════════════════════════════
-- Seed: site_images (collection shots, Haley photos, logos)
-- ══════════════════════════════════════════════════════════════════════════

insert into public.site_images (key, url, alt) values
  -- Logos
  ('logo.wide', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/BusinessAssets/BiteMeWideLogo.png', 'Bite Me Protein — wide logo'),
  ('logo.square', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/BusinessAssets/BiteMeSquareLogo.png', 'Bite Me Protein — square logo'),

  -- Collection / group shots
  ('collection.allChocChipMuffins', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/allChocChipMuffins.jpg', null),
  ('collection.allChocProducts1', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/allChocProducts1.jpg', null),
  ('collection.allChocProducts2', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/allChocProducts2.jpg', null),
  ('collection.allMuffins', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/allMuffins.jpg', null),
  ('collection.allMuffins1', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/allMuffins1.jpg', null),
  ('collection.allMuffins2', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/allMuffins2.jpg', null),
  ('collection.allProducts1', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/allProducts1.jpg', null),
  ('collection.allProducts2', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/allProducts2.jpg', null),
  ('collection.allProducts3', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/allProducts3.jpg', null),
  ('collection.allProducts4', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/allProducts4.jpg', null),
  ('collection.allProducts5', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/allProducts5.jpg', null),
  ('collection.allProductsFaceDown', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/allProductsFaceDown.jpg', null),
  ('collection.raspberryBlueberryMuffins', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/productPhotos/rasberryBlueberryMuffins.jpg', null),

  -- Haley / about
  ('about.haley1', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/pictures/IMG_3676.jpg', 'Haley'),
  ('about.haley2', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/pictures/IMG_3832.jpg', 'Haley'),
  ('about.haley3', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/pictures/IMG_7258%202.jpg', 'Haley'),
  ('about.haley4', 'https://jsfxfqjikxzexokjxtby.supabase.co/storage/v1/object/public/pictures/IMG_8248.JPG', 'Haley')
on conflict (key) do nothing;

-- ══════════════════════════════════════════════════════════════════════════
-- Seed: cms_content (leave empty — public pages fall back to hardcoded
-- values via useContent(key, fallback). Admin edits populate rows.)
-- ══════════════════════════════════════════════════════════════════════════
-- Intentionally empty. The admin editor shows keys grouped by section;
-- empty rows mean "use the fallback baked into the page." Admin's first
-- save of a key creates the override row.
