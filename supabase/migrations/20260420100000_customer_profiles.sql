-- 20260420100000_customer_profiles.sql
-- Links Supabase Auth users to Square customers for the /account feature.
--
-- Flow:
--   1. Customer signs in via magic link → Supabase Auth creates auth.users row
--   2. On first sign-in, /account/callback inserts a customer_profiles row
--   3. Server-side we try to find the matching square_customers row by email
--      and populate square_customer_id when found
--   4. /account uses square_customer_id (if present) + email match against
--      raw fulfillment recipients to surface that customer's orders

create table if not exists public.customer_profiles (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  email                text not null,
  phone                text,
  square_customer_id   text references public.square_customers(id) on delete set null,
  created_at           timestamptz not null default now(),
  last_signin_at       timestamptz
);

create index if not exists customer_profiles_email_idx on public.customer_profiles (lower(email));
create index if not exists customer_profiles_square_customer_idx on public.customer_profiles (square_customer_id);

alter table public.customer_profiles enable row level security;

-- Customers read their own profile
drop policy if exists "customer read own profile" on public.customer_profiles;
create policy "customer read own profile" on public.customer_profiles
  for select to authenticated using (user_id = auth.uid());

-- Customers update their own profile (phone, etc.)
drop policy if exists "customer update own profile" on public.customer_profiles;
create policy "customer update own profile" on public.customer_profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Admins read any profile
drop policy if exists "admin read any profile" on public.customer_profiles;
create policy "admin read any profile" on public.customer_profiles
  for select to authenticated using (public.is_admin());

-- Inserts happen via service role only (from /account/callback server route).
-- No INSERT policy for anon/authenticated = deny-by-default under RLS.
