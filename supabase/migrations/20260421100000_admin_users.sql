-- 20260421100000_admin_users.sql
-- Replaces the stub is_admin() (which returned true for any authenticated
-- user) with a whitelist check against the new admin_users table. This
-- protects every RLS policy that calls public.is_admin() — admin reads of
-- orders, customers, reward_tiers, discount_codes, error_logs, CMS, etc.

-- ── Table: admin_users ────────────────────────────────────────────────────
-- Email is the natural key. We lowercase on insert (citext normalizes
-- comparison) so a case-mismatched login doesn't bypass the check.

create extension if not exists citext;

create table if not exists public.admin_users (
  email       citext primary key,
  created_at  timestamptz not null default now(),
  note        text
);

comment on table public.admin_users is
  'Whitelist of admin email addresses. is_admin() checks membership against this table.';

-- Seed the two current admins. on conflict do nothing keeps re-runs safe.
insert into public.admin_users (email, note) values
  ('cole@marcuccilli.com', 'Sweet Dreams engineering'),
  ('haley@bitemeprotein.com', 'Bite Me Protein founder')
on conflict (email) do nothing;

-- ── is_admin() — harden ───────────────────────────────────────────────────
-- Joins auth.users on auth.uid() to recover the current user's email, then
-- checks admin_users membership. security definer lets this read from
-- auth.users even when called from a RLS-restricted query. stable lets
-- Postgres cache within a single query.

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users u
    join public.admin_users a on a.email = u.email
    where u.id = auth.uid()
  );
$$;

-- Lock down admin_users itself. Only admins (via the newly-hardened
-- is_admin) can read; inserts/updates go through the service role.
alter table public.admin_users enable row level security;

drop policy if exists "Admins can view admin_users" on public.admin_users;
create policy "Admins can view admin_users"
  on public.admin_users
  for select to authenticated
  using (public.is_admin());
