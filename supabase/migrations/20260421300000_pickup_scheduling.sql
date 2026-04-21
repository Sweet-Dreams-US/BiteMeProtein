-- 20260421300000_pickup_scheduling.sql
-- Pickup scheduling: slot-based customer pickup times with admin-controlled
-- weekly hours, one-off closures, and an atomic reservation table that
-- prevents two customers grabbing the same minute.

-- ── pickup_schedule ──────────────────────────────────────────────────────
-- One row per day of week. is_open=false means closed that day; when open,
-- open_time/close_time must be populated.

create table if not exists public.pickup_schedule (
  day_of_week smallint primary key check (day_of_week between 0 and 6),
  is_open     boolean     not null default false,
  open_time   time,
  close_time  time,
  updated_at  timestamptz not null default now(),
  check ((is_open and open_time is not null and close_time is not null and open_time < close_time)
         or (not is_open))
);

-- Seed sensible defaults: Mon-Sat 10am-6pm, Sunday closed. Admin can edit.
insert into public.pickup_schedule (day_of_week, is_open, open_time, close_time)
values
  (0, false, null,       null),       -- Sunday
  (1, true,  '10:00:00', '18:00:00'), -- Monday
  (2, true,  '10:00:00', '18:00:00'), -- Tuesday
  (3, true,  '10:00:00', '18:00:00'), -- Wednesday
  (4, true,  '10:00:00', '18:00:00'), -- Thursday
  (5, true,  '10:00:00', '18:00:00'), -- Friday
  (6, true,  '10:00:00', '18:00:00')  -- Saturday
on conflict (day_of_week) do nothing;

-- ── pickup_closures ──────────────────────────────────────────────────────
-- Specific dates Haley's kitchen is closed — holidays, travel, etc. Takes
-- precedence over pickup_schedule for that date.

create table if not exists public.pickup_closures (
  closure_date date        primary key,
  reason       text,
  created_at   timestamptz not null default now()
);

-- ── pickup_settings ──────────────────────────────────────────────────────
-- Singleton config row. slot_duration_minutes drives the slot grid;
-- rush_fee_cents is charged on same-day orders.

create table if not exists public.pickup_settings (
  id                          smallint primary key default 1 check (id = 1),
  slot_duration_minutes       smallint not null default 8  check (slot_duration_minutes between 1 and 60),
  allow_same_day              boolean  not null default true,
  same_day_rush_fee_cents     integer  not null default 500 check (same_day_rush_fee_cents >= 0),
  same_day_min_lead_minutes   smallint not null default 30  check (same_day_min_lead_minutes >= 0),
  max_days_ahead              smallint not null default 14  check (max_days_ahead between 1 and 60),
  updated_at                  timestamptz not null default now()
);

insert into public.pickup_settings (id) values (1)
on conflict (id) do nothing;

-- ── pickup_reservations ──────────────────────────────────────────────────
-- Atomic slot locks. pickup_at is the primary key, so two concurrent
-- customers racing for 10:08 both try to INSERT — whoever's insert lands
-- first wins, the other gets a unique-violation we translate into
-- "that slot just got taken, pick another."

create table if not exists public.pickup_reservations (
  pickup_at        timestamptz primary key,
  square_order_id  text        not null unique,
  customer_email   text,
  customer_name    text,
  customer_phone   text,
  items            jsonb       not null default '[]'::jsonb,
  rush_fee_cents   integer     not null default 0 check (rush_fee_cents >= 0),
  status           text        not null default 'pending'
                               check (status in ('pending', 'preparing', 'ready', 'picked_up', 'cancelled')),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Primary key on pickup_at already indexes timestamps, so range queries
-- (where pickup_at >= day_start and pickup_at < day_end) are covered.
-- We also add a status index for "today's pending/preparing" dashboard
-- queries.

create index if not exists pickup_reservations_status_idx
  on public.pickup_reservations (status);

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Public reads of pickup_schedule + closures + settings so the checkout
-- page can render available slots without a session. Writes are admin-only
-- (via is_admin() hardened by admin_users table).
-- pickup_reservations is admin-only for reads (customer data); inserts go
-- through the service role from /api/square/pay.

alter table public.pickup_schedule     enable row level security;
alter table public.pickup_closures     enable row level security;
alter table public.pickup_settings     enable row level security;
alter table public.pickup_reservations enable row level security;

drop policy if exists "public read pickup_schedule" on public.pickup_schedule;
create policy "public read pickup_schedule"
  on public.pickup_schedule for select to anon, authenticated
  using (true);

drop policy if exists "admin write pickup_schedule" on public.pickup_schedule;
create policy "admin write pickup_schedule"
  on public.pickup_schedule for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read pickup_closures" on public.pickup_closures;
create policy "public read pickup_closures"
  on public.pickup_closures for select to anon, authenticated
  using (true);

drop policy if exists "admin write pickup_closures" on public.pickup_closures;
create policy "admin write pickup_closures"
  on public.pickup_closures for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read pickup_settings" on public.pickup_settings;
create policy "public read pickup_settings"
  on public.pickup_settings for select to anon, authenticated
  using (true);

drop policy if exists "admin write pickup_settings" on public.pickup_settings;
create policy "admin write pickup_settings"
  on public.pickup_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin read pickup_reservations" on public.pickup_reservations;
create policy "admin read pickup_reservations"
  on public.pickup_reservations for select to authenticated
  using (public.is_admin());

drop policy if exists "admin write pickup_reservations" on public.pickup_reservations;
create policy "admin write pickup_reservations"
  on public.pickup_reservations for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- Inserts happen via service role only (from /api/square/pay). No
-- INSERT policy for anon/authenticated = deny-by-default under RLS.
