-- 20260423000000_order_event_and_refund_meta.sql
-- Tag each order with the event it came from (esp. in-person POS sales
-- made at Haley's tent events). Also adds metadata so admin-initiated
-- refunds via our app track who initiated them.

-- ── square_orders.event_id ───────────────────────────────────────────────
-- Nullable FK to events. In-person POS orders get auto-tagged by date
-- overlap on sync; online orders are null unless manually tagged.
-- on delete set null: deleting an event shouldn't cascade-delete orders
-- made at that event — we still want the revenue history.

alter table public.square_orders
  add column if not exists event_id uuid references public.events(id) on delete set null;

create index if not exists square_orders_event_id_idx on public.square_orders (event_id)
  where event_id is not null;

-- Notify PostgREST so the FK is immediately available for embedding
-- (select *, event:events(title, date)).
notify pgrst, 'reload schema';

-- ── order_refund_initiations ─────────────────────────────────────────────
-- Tracks refunds we initiated from the admin panel (vs refunds initiated
-- in the Square Dashboard). Gives the admin page an immediate, optimistic
-- badge while we wait for Square's async webhook to echo back the real
-- refund row. One row per (order, attempt) so partial refunds are allowed.

create table if not exists public.order_refund_initiations (
  id               uuid primary key default gen_random_uuid(),
  square_order_id  text not null references public.square_orders(id) on delete cascade,
  square_payment_id text,
  amount_cents     integer,
  status           text not null default 'pending'
                   check (status in ('pending', 'completed', 'failed')),
  square_refund_id text,
  error            text,
  initiated_by     uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists order_refund_initiations_order_idx
  on public.order_refund_initiations (square_order_id);

alter table public.order_refund_initiations enable row level security;

drop policy if exists "admin manage refund initiations" on public.order_refund_initiations;
create policy "admin manage refund initiations"
  on public.order_refund_initiations
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
