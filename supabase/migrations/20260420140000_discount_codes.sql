-- 20260420140000_discount_codes.sql
-- Promo codes for checkout. Schema supports three discount types but the
-- initial checkout wire-up applies only per_item_fixed_price (seeded
-- BiteMeTraining uses that). percent_off and fixed_off can be created
-- via the admin UI but their checkout application is a future PR.
--
-- Codes are case-insensitive (citext) so "BiteMeTraining" = "bitemetraining".
-- No public SELECT policy — customers enter a code, /api/discounts/validate
-- checks it server-side and returns only the result. Prevents enumeration.

create extension if not exists citext;

create table if not exists public.discount_codes (
  id                         uuid primary key default gen_random_uuid(),
  code                       citext not null unique,
  name                       text not null,
  discount_type              text not null check (discount_type in ('per_item_fixed_price', 'percent_off', 'fixed_off')),
  amount_cents               int,
  percent                    int check (percent is null or (percent >= 0 and percent <= 100)),
  fulfillment_restriction    text not null default 'all' check (fulfillment_restriction in ('all', 'pickup', 'shipping')),
  product_scope              text not null default 'all' check (product_scope in ('all', 'allowlist')),
  allowed_square_product_ids text[],
  starts_at                  timestamptz,
  ends_at                    timestamptz,
  max_total_uses             int,
  max_per_customer           int,
  is_active                  boolean not null default true,
  notes                      text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create index if not exists discount_codes_is_active_idx on public.discount_codes (is_active);

alter table public.discount_codes enable row level security;

drop policy if exists "admin read discount_codes" on public.discount_codes;
create policy "admin read discount_codes" on public.discount_codes
  for select to authenticated using (public.is_admin());

drop policy if exists "admin write discount_codes" on public.discount_codes;
create policy "admin write discount_codes" on public.discount_codes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Redemptions — one row per successful use. Powers the per-code usage
-- counter + future "which trainer's code drove N orders" reports.
create table if not exists public.discount_redemptions (
  id                 uuid primary key default gen_random_uuid(),
  discount_code_id   uuid not null references public.discount_codes(id) on delete cascade,
  square_order_id    text,
  customer_email     text,
  amount_cents_saved bigint,
  created_at         timestamptz not null default now()
);

create index if not exists discount_redemptions_code_created_idx on public.discount_redemptions (discount_code_id, created_at desc);
create index if not exists discount_redemptions_email_idx on public.discount_redemptions (lower(customer_email));
create index if not exists discount_redemptions_order_idx on public.discount_redemptions (square_order_id);

alter table public.discount_redemptions enable row level security;

drop policy if exists "admin read discount_redemptions" on public.discount_redemptions;
create policy "admin read discount_redemptions" on public.discount_redemptions
  for select to authenticated using (public.is_admin());

-- Inserts = service role only (deny-by-default for authenticated/anon).

-- ── Seed the BiteMeTraining code ────────────────────────────────────────

insert into public.discount_codes
  (code, name, discount_type, amount_cents, fulfillment_restriction, product_scope, is_active, notes)
values
  ('BiteMeTraining', 'Trainer referral — $5 per piece (pickup only)',
   'per_item_fixed_price', 500, 'pickup', 'all', true,
   'For trainers who refer customers to the brand. Every bundled item priced at $5 on pickup orders. Share this code with trainer partners.')
on conflict (code) do nothing;
