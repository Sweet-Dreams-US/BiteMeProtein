-- 20260419120000_error_logs.sql
-- Creates the error_logs table, RLS policies, and the is_admin() helper.
-- Applied manually via the Supabase SQL editor for now.
-- Migration tooling is deferred to sub-project 2.

-- ── Helper: is_admin() ────────────────────────────────────────────────────
-- For now this returns true for any authenticated user (Haley is the only
-- admin). When a second admin is added, replace the body with a whitelist
-- check against either an ADMIN_EMAILS GUC or an admin_users table.
-- See docs/superpowers/specs/2026-04-19-harden-foundations-design.md D1.

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select auth.uid() is not null;
$$;

-- ── Table: error_logs ─────────────────────────────────────────────────────

create table if not exists public.error_logs (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  level       text not null check (level in ('error', 'warn', 'info')),
  source      text not null check (source in ('api-route', 'lib', 'client', 'webhook')),
  path        text not null,
  message     text not null,
  stack       text,
  context     jsonb,
  user_id     uuid references auth.users(id) on delete set null,
  request_id  text
);

comment on table public.error_logs is
  'Surface for fire-and-forget flow failures. Written by service role, read by admins via /admin/errors.';

-- Indexes for the common admin-dashboard filters
create index if not exists error_logs_created_at_idx
  on public.error_logs (created_at desc);

create index if not exists error_logs_level_created_at_idx
  on public.error_logs (level, created_at desc);

create index if not exists error_logs_source_created_at_idx
  on public.error_logs (source, created_at desc);

-- ── Row Level Security ────────────────────────────────────────────────────

alter table public.error_logs enable row level security;

-- Service role bypasses RLS by default (that's how logError writes).
-- These policies cover anon + authenticated access, which is what we
-- want to lock down.

drop policy if exists "error_logs admins can read" on public.error_logs;
create policy "error_logs admins can read"
  on public.error_logs
  for select
  to authenticated
  using (public.is_admin());

-- No insert/update/delete policies for authenticated/anon — only service
-- role can write. Omitting the policy is deny-by-default under RLS.
