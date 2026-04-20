-- 20260419200000_square_sync.sql
-- Mirror tables for Square entities: orders, payments, refunds, customers,
-- catalog, loyalty, inventory, locations, and Tier-C tables (gift cards,
-- disputes, cash drawer, team, invoices).
--
-- Every table follows the same pattern:
--   - Square's id as primary key (text)
--   - A few indexed columns for common admin filters
--   - `raw jsonb` holding the full Square payload
--   - `synced_at` timestamp for "last sync" debug
--   - RLS: service role writes (bypass), admins read via is_admin()
--
-- Schema is idempotent. Safe to re-apply.

-- ══════════════════════════════════════════════════════════════════════════
-- TIER A — core
-- ══════════════════════════════════════════════════════════════════════════

-- square_customers (referenced by orders, define first) -----------------------
create table if not exists public.square_customers (
  id              text primary key,
  created_at      timestamptz,
  updated_at      timestamptz,
  email           text,
  phone           text,
  given_name      text,
  family_name     text,
  company_name    text,
  reference_id    text,
  raw             jsonb not null,
  synced_at       timestamptz not null default now()
);

create index if not exists square_customers_email_idx on public.square_customers (lower(email));
create index if not exists square_customers_phone_idx on public.square_customers (phone);
create index if not exists square_customers_created_at_idx on public.square_customers (created_at desc);

alter table public.square_customers enable row level security;
drop policy if exists "admin-read square_customers" on public.square_customers;
create policy "admin-read square_customers" on public.square_customers
  for select to authenticated using (public.is_admin());

-- square_orders -------------------------------------------------------------
create table if not exists public.square_orders (
  id                    text primary key,
  created_at            timestamptz not null,
  updated_at            timestamptz not null,
  state                 text,
  location_id           text,
  customer_id           text,
  total_money_cents     bigint,
  total_tax_cents       bigint,
  total_tip_cents       bigint,
  total_discount_cents  bigint,
  source_name           text,
  reference_id          text,
  version               int,
  raw                   jsonb not null,
  synced_at             timestamptz not null default now()
);

create index if not exists square_orders_created_at_idx on public.square_orders (created_at desc);
create index if not exists square_orders_customer_id_idx on public.square_orders (customer_id);
create index if not exists square_orders_location_created_idx on public.square_orders (location_id, created_at desc);
create index if not exists square_orders_source_created_idx on public.square_orders (source_name, created_at desc);
create index if not exists square_orders_state_idx on public.square_orders (state);

alter table public.square_orders enable row level security;
drop policy if exists "admin-read square_orders" on public.square_orders;
create policy "admin-read square_orders" on public.square_orders
  for select to authenticated using (public.is_admin());

-- square_order_line_items ---------------------------------------------------
create table if not exists public.square_order_line_items (
  id                 text primary key,
  order_id           text not null references public.square_orders(id) on delete cascade,
  name               text,
  quantity           text,
  base_price_cents   bigint,
  variation_name     text,
  catalog_object_id  text,
  note               text,
  raw                jsonb not null
);

create index if not exists square_order_line_items_order_id_idx on public.square_order_line_items (order_id);
create index if not exists square_order_line_items_catalog_object_idx on public.square_order_line_items (catalog_object_id);

alter table public.square_order_line_items enable row level security;
drop policy if exists "admin-read square_order_line_items" on public.square_order_line_items;
create policy "admin-read square_order_line_items" on public.square_order_line_items
  for select to authenticated using (public.is_admin());

-- square_payments -----------------------------------------------------------
create table if not exists public.square_payments (
  id               text primary key,
  order_id         text,
  created_at       timestamptz not null,
  amount_cents     bigint,
  source_type      text,
  card_brand       text,
  card_last_4      text,
  status           text,
  receipt_url      text,
  raw              jsonb not null,
  synced_at        timestamptz not null default now()
);

create index if not exists square_payments_order_id_idx on public.square_payments (order_id);
create index if not exists square_payments_created_at_idx on public.square_payments (created_at desc);
create index if not exists square_payments_source_type_idx on public.square_payments (source_type, created_at desc);

alter table public.square_payments enable row level security;
drop policy if exists "admin-read square_payments" on public.square_payments;
create policy "admin-read square_payments" on public.square_payments
  for select to authenticated using (public.is_admin());

-- square_refunds ------------------------------------------------------------
create table if not exists public.square_refunds (
  id            text primary key,
  payment_id    text,
  order_id      text,
  created_at    timestamptz not null,
  amount_cents  bigint,
  reason        text,
  status        text,
  raw           jsonb not null,
  synced_at     timestamptz not null default now()
);

create index if not exists square_refunds_payment_id_idx on public.square_refunds (payment_id);
create index if not exists square_refunds_order_id_idx on public.square_refunds (order_id);
create index if not exists square_refunds_created_at_idx on public.square_refunds (created_at desc);

alter table public.square_refunds enable row level security;
drop policy if exists "admin-read square_refunds" on public.square_refunds;
create policy "admin-read square_refunds" on public.square_refunds
  for select to authenticated using (public.is_admin());

-- square_products -----------------------------------------------------------
create table if not exists public.square_products (
  id            text primary key,
  name          text,
  description   text,
  category_id   text,
  is_archived   boolean default false,
  updated_at    timestamptz,
  raw           jsonb not null,
  synced_at     timestamptz not null default now()
);

create index if not exists square_products_name_idx on public.square_products (lower(name));
create index if not exists square_products_category_idx on public.square_products (category_id);

alter table public.square_products enable row level security;
drop policy if exists "admin-read square_products" on public.square_products;
create policy "admin-read square_products" on public.square_products
  for select to authenticated using (public.is_admin());

-- square_product_variations -------------------------------------------------
create table if not exists public.square_product_variations (
  id                text primary key,
  product_id        text references public.square_products(id) on delete cascade,
  name              text,
  price_cents       bigint,
  sku               text,
  track_inventory   boolean default false,
  raw               jsonb not null,
  synced_at         timestamptz not null default now()
);

create index if not exists square_product_variations_product_idx on public.square_product_variations (product_id);
create index if not exists square_product_variations_sku_idx on public.square_product_variations (sku);

alter table public.square_product_variations enable row level security;
drop policy if exists "admin-read square_product_variations" on public.square_product_variations;
create policy "admin-read square_product_variations" on public.square_product_variations
  for select to authenticated using (public.is_admin());

-- ══════════════════════════════════════════════════════════════════════════
-- TIER B — analytics
-- ══════════════════════════════════════════════════════════════════════════

-- square_loyalty_accounts ---------------------------------------------------
create table if not exists public.square_loyalty_accounts (
  id               text primary key,
  customer_id      text,
  phone            text,
  program_id       text,
  balance          int default 0,
  lifetime_points  int default 0,
  created_at       timestamptz,
  updated_at       timestamptz,
  raw              jsonb not null,
  synced_at        timestamptz not null default now()
);

create index if not exists square_loyalty_accounts_phone_idx on public.square_loyalty_accounts (phone);
create index if not exists square_loyalty_accounts_customer_idx on public.square_loyalty_accounts (customer_id);

alter table public.square_loyalty_accounts enable row level security;
drop policy if exists "admin-read square_loyalty_accounts" on public.square_loyalty_accounts;
create policy "admin-read square_loyalty_accounts" on public.square_loyalty_accounts
  for select to authenticated using (public.is_admin());

-- square_loyalty_events -----------------------------------------------------
create table if not exists public.square_loyalty_events (
  id            text primary key,
  account_id    text,
  type          text,
  points        int,
  order_id      text,
  created_at    timestamptz not null,
  raw           jsonb not null,
  synced_at     timestamptz not null default now()
);

create index if not exists square_loyalty_events_account_idx on public.square_loyalty_events (account_id, created_at desc);
create index if not exists square_loyalty_events_order_idx on public.square_loyalty_events (order_id);

alter table public.square_loyalty_events enable row level security;
drop policy if exists "admin-read square_loyalty_events" on public.square_loyalty_events;
create policy "admin-read square_loyalty_events" on public.square_loyalty_events
  for select to authenticated using (public.is_admin());

-- square_inventory_counts ---------------------------------------------------
-- Composite PK: latest count per (variation, location, state). Upsert replaces.
create table if not exists public.square_inventory_counts (
  variation_id    text not null,
  location_id     text not null,
  state           text not null,
  quantity        text,
  calculated_at   timestamptz not null,
  raw             jsonb not null,
  synced_at       timestamptz not null default now(),
  primary key (variation_id, location_id, state)
);

create index if not exists square_inventory_counts_variation_idx on public.square_inventory_counts (variation_id);
create index if not exists square_inventory_counts_location_idx on public.square_inventory_counts (location_id);

alter table public.square_inventory_counts enable row level security;
drop policy if exists "admin-read square_inventory_counts" on public.square_inventory_counts;
create policy "admin-read square_inventory_counts" on public.square_inventory_counts
  for select to authenticated using (public.is_admin());

-- square_locations ----------------------------------------------------------
create table if not exists public.square_locations (
  id           text primary key,
  name         text,
  status       text,
  address      jsonb,
  raw          jsonb not null,
  synced_at    timestamptz not null default now()
);

alter table public.square_locations enable row level security;
drop policy if exists "admin-read square_locations" on public.square_locations;
create policy "admin-read square_locations" on public.square_locations
  for select to authenticated using (public.is_admin());

-- square_catalog_categories -------------------------------------------------
create table if not exists public.square_catalog_categories (
  id           text primary key,
  name         text,
  raw          jsonb not null,
  synced_at    timestamptz not null default now()
);

alter table public.square_catalog_categories enable row level security;
drop policy if exists "admin-read square_catalog_categories" on public.square_catalog_categories;
create policy "admin-read square_catalog_categories" on public.square_catalog_categories
  for select to authenticated using (public.is_admin());

-- square_catalog_modifiers --------------------------------------------------
create table if not exists public.square_catalog_modifiers (
  id                text primary key,
  name              text,
  modifier_list_id  text,
  price_cents       bigint,
  raw               jsonb not null,
  synced_at         timestamptz not null default now()
);

create index if not exists square_catalog_modifiers_list_idx on public.square_catalog_modifiers (modifier_list_id);

alter table public.square_catalog_modifiers enable row level security;
drop policy if exists "admin-read square_catalog_modifiers" on public.square_catalog_modifiers;
create policy "admin-read square_catalog_modifiers" on public.square_catalog_modifiers
  for select to authenticated using (public.is_admin());

-- ══════════════════════════════════════════════════════════════════════════
-- TIER C — long-tail entities (minimal columns + raw)
-- ══════════════════════════════════════════════════════════════════════════

-- square_gift_cards ---------------------------------------------------------
create table if not exists public.square_gift_cards (
  id            text primary key,
  type          text,
  state         text,
  balance_cents bigint,
  created_at    timestamptz,
  raw           jsonb not null,
  synced_at     timestamptz not null default now()
);

alter table public.square_gift_cards enable row level security;
drop policy if exists "admin-read square_gift_cards" on public.square_gift_cards;
create policy "admin-read square_gift_cards" on public.square_gift_cards
  for select to authenticated using (public.is_admin());

-- square_disputes -----------------------------------------------------------
create table if not exists public.square_disputes (
  id              text primary key,
  payment_id      text,
  amount_cents    bigint,
  reason          text,
  state           text,
  due_at          timestamptz,
  created_at      timestamptz,
  raw             jsonb not null,
  synced_at       timestamptz not null default now()
);

create index if not exists square_disputes_payment_idx on public.square_disputes (payment_id);
create index if not exists square_disputes_state_idx on public.square_disputes (state);

alter table public.square_disputes enable row level security;
drop policy if exists "admin-read square_disputes" on public.square_disputes;
create policy "admin-read square_disputes" on public.square_disputes
  for select to authenticated using (public.is_admin());

-- square_cash_drawer_shifts -------------------------------------------------
create table if not exists public.square_cash_drawer_shifts (
  id                       text primary key,
  state                    text,
  opened_at                timestamptz,
  closed_at                timestamptz,
  opened_cash_money_cents  bigint,
  closed_cash_money_cents  bigint,
  raw                      jsonb not null,
  synced_at                timestamptz not null default now()
);

create index if not exists square_cash_drawer_opened_idx on public.square_cash_drawer_shifts (opened_at desc);

alter table public.square_cash_drawer_shifts enable row level security;
drop policy if exists "admin-read square_cash_drawer_shifts" on public.square_cash_drawer_shifts;
create policy "admin-read square_cash_drawer_shifts" on public.square_cash_drawer_shifts
  for select to authenticated using (public.is_admin());

-- square_team_members -------------------------------------------------------
create table if not exists public.square_team_members (
  id            text primary key,
  given_name    text,
  family_name   text,
  email         text,
  status        text,
  is_owner      boolean default false,
  created_at    timestamptz,
  raw           jsonb not null,
  synced_at     timestamptz not null default now()
);

alter table public.square_team_members enable row level security;
drop policy if exists "admin-read square_team_members" on public.square_team_members;
create policy "admin-read square_team_members" on public.square_team_members
  for select to authenticated using (public.is_admin());

-- square_invoices -----------------------------------------------------------
create table if not exists public.square_invoices (
  id                text primary key,
  order_id          text,
  status            text,
  total_cents       bigint,
  due_date          date,
  created_at        timestamptz,
  updated_at        timestamptz,
  raw               jsonb not null,
  synced_at         timestamptz not null default now()
);

create index if not exists square_invoices_order_idx on public.square_invoices (order_id);
create index if not exists square_invoices_status_idx on public.square_invoices (status);

alter table public.square_invoices enable row level security;
drop policy if exists "admin-read square_invoices" on public.square_invoices;
create policy "admin-read square_invoices" on public.square_invoices
  for select to authenticated using (public.is_admin());
