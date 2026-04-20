# Square → Supabase sync pipeline — Design Spec

**Date:** 2026-04-19
**Sub-project:** 2 of 5 in the BiteMeProtein admin-side roadmap
**Status:** approved, ready for implementation
**Depends on:** sub-project 1 (`logError` helper, error_logs table) — PR #1

## Problem

`/admin/orders` today calls Square directly on every page load + 60 s poll. That means:

- **No historical analytics.** Can't filter "all in-person orders from January" — Square's `orders.search()` caps at ~50 per request, and joining across months is unpleasant.
- **No cross-entity joins.** Admin can't answer "which customers bought brownies 3 or more times?" without manual Square+Supabase stitching.
- **Slow admin dashboard.** Every stat card is a Square API roundtrip.
- **Zero visibility into in-person POS activity on the website admin.** All of Haley's actual sales to date happen in-person via Square POS, and the admin dashboard has no filter/drill-down on those.

Haley wants one admin view that shows **every order — POS and online — with real filters and fast response times.** The data lives in Square (source of truth); we mirror it into Supabase so admin queries are fast and expressive.

## Goals

After this sub-project ships:

1. Every Square entity the business cares about (orders, payments, refunds, customers, catalog, loyalty, inventory, locations) is mirrored into `square_*` tables in Supabase.
2. A Square webhook keeps mirrors within seconds of live. When webhooks fail or are misconfigured, admin page loads trigger a backfill of "recent" changes.
3. `/admin/orders` reads from Supabase with filters on source (POS / online), date range, customer, product, status, amount range. Page loads in < 500 ms.
4. A `npm run backfill` script does the initial all-history load.
5. Supabase CLI is set up so future schema changes are tracked migrations, not hand-applied SQL.

## Non-goals

- **No mutations** flow from Supabase back to Square. Square is source of truth; Supabase is a read-cache with analytics enrichments. Admin writes (create product, adjust inventory) still hit Square directly via existing `/api/square/*` routes.
- **No customer-facing use** of the mirror. `/shop`, `/checkout`, `/track` still call Square directly to avoid cache staleness on the critical path.
- **No dashboard rebuild.** Reuse existing `/admin` UI scaffolding; just swap the data source.

## Decisions

### Sync mechanism — Hybrid with fallback
- **Backfill (one-time):** `npm run backfill` pulls every entity's full history, paginated.
- **Live (primary):** Square webhooks → `/api/webhooks/square` → HMAC verify → dispatch to per-entity handler → upsert.
- **Fallback (safety net):** on admin page load, kick off `/api/admin/sync-recent` which refetches the last N hours of changes per entity. Idempotent — a missed webhook gets caught within one admin visit.

### Scope — Tier A + B + C (everything)
~18 tables. User picked "all 3 tiers" in brainstorm.

### Schema pattern — mirror + jsonb
Each `square_*` table has:
- The few columns admin filters on (id, created_at, state, customer_id, etc.)
- A `raw jsonb` column holding the full Square payload

Tradeoff: slight storage overhead; huge optionality — admin can write a new query against `raw->>'tenders'` or similar without another sync sprint.

### Idempotency — upsert by Square id
Every sync handler does `INSERT … ON CONFLICT (square_id) DO UPDATE`. Replaying a webhook or backfill is safe.

### Migration tooling — Supabase CLI
- `npm i -D supabase` (local devDep, no global install)
- `supabase init` creates `supabase/config.toml`
- `supabase link --project-ref <ref>` ties to existing production project
- `supabase db pull` captures the current production schema (product_enrichments, bundle_tiers, events, fedex_zones, fedex_rates, order_fulfillment, error_logs) into `supabase/migrations/<ts>_initial_schema.sql`
- New migrations via `supabase migration new square_sync`
- Applied to production via `supabase db push`

## Schema

### Core (Tier A) — 7 tables

**`square_orders`**
```sql
id                 text primary key,
created_at         timestamptz not null,
updated_at         timestamptz not null,
state              text,             -- OPEN / COMPLETED / CANCELED / DRAFT
location_id        text,
customer_id        text,             -- fk to square_customers
total_money_cents  bigint,
total_tax_cents    bigint,
total_tip_cents    bigint,
total_discount_cents bigint,
source_name        text,             -- "Point of Sale" / "External API" / "Online"
reference_id       text,
version            int,
raw                jsonb not null,
synced_at          timestamptz not null default now()
```

Indexes: `(created_at desc)`, `(customer_id)`, `(location_id, created_at desc)`, `(source_name, created_at desc)`, `(state)`.

**`square_order_line_items`**
```sql
id                text primary key,    -- Square's line_item.uid
order_id          text not null references square_orders(id) on delete cascade,
name              text,
quantity          text,                -- Square uses string quantity
base_price_cents  bigint,
variation_name    text,
catalog_object_id text,
note              text,
raw               jsonb not null
```

Index: `(order_id)`, `(catalog_object_id)`.

**`square_payments`**
```sql
id                 text primary key,
order_id           text references square_orders(id),
created_at         timestamptz not null,
amount_cents       bigint,
source_type        text,             -- CARD / CASH / EXTERNAL / BANK_ACCOUNT / GIFT_CARD
card_brand         text,             -- VISA / MC / etc. when source_type = CARD
card_last_4        text,
status             text,             -- APPROVED / COMPLETED / CANCELED / FAILED
receipt_url        text,
raw                jsonb not null
```

The `source_type` column is how we distinguish POS vs online. `CASH` + in-person `CARD` swipes = POS. Online `CARD` payments come through the Web Payments SDK.

Indexes: `(order_id)`, `(created_at desc)`, `(source_type, created_at desc)`.

**`square_refunds`**
```sql
id             text primary key,
payment_id     text references square_payments(id),
order_id       text references square_orders(id),
created_at     timestamptz not null,
amount_cents   bigint,
reason         text,
status         text,
raw            jsonb not null
```

**`square_customers`**
```sql
id              text primary key,
created_at      timestamptz,
updated_at      timestamptz,
email           text,
phone           text,
given_name      text,
family_name     text,
company_name    text,
reference_id    text,
raw             jsonb not null
```

Indexes: `(email)`, `(phone)`, `(created_at desc)`.

**`square_products`**
```sql
id              text primary key,
name            text,
description     text,
category_id     text,
is_archived     boolean default false,
updated_at      timestamptz,
raw             jsonb not null
```

**`square_product_variations`**
```sql
id                text primary key,
product_id        text references square_products(id) on delete cascade,
name              text,
price_cents       bigint,
sku               text,
track_inventory   boolean default false,
raw               jsonb not null
```

Index: `(product_id)`.

### Analytics (Tier B) — 6 tables

**`square_loyalty_accounts`**
```sql
id                text primary key,
customer_id       text,
phone             text,
program_id        text,
balance           int default 0,
lifetime_points   int default 0,
created_at        timestamptz,
updated_at        timestamptz,
raw               jsonb not null
```

Index on `(phone)` — primary admin lookup.

**`square_loyalty_events`**
```sql
id              text primary key,
account_id      text references square_loyalty_accounts(id),
type            text,    -- ACCUMULATE_POINTS / ADJUST_POINTS / REDEEM_REWARD / ...
points          int,
order_id        text references square_orders(id),
created_at      timestamptz not null,
raw             jsonb not null
```

Indexes: `(account_id, created_at desc)`, `(order_id)`.

**`square_inventory_counts`**
```sql
variation_id   text not null,
location_id    text not null,
state          text,     -- IN_STOCK / SOLD / WASTE / RETURNED_BY_CUSTOMER
quantity       text,     -- Square string-quantity
calculated_at  timestamptz not null,
primary key (variation_id, location_id, state),
raw            jsonb not null
```

Upsert replaces, doesn't append. (We only care about the current snapshot. For a history table, add `square_inventory_changes` later if needed.)

**`square_locations`**
```sql
id              text primary key,
name            text,
status          text,
address         jsonb,
raw             jsonb not null
```

**`square_catalog_categories`**
```sql
id              text primary key,
name            text,
raw             jsonb not null
```

**`square_catalog_modifiers`**
```sql
id                text primary key,
name              text,
modifier_list_id  text,
price_cents       bigint,
raw               jsonb not null
```

### Tier C — 5 tables

**`square_gift_cards`**, **`square_disputes`**, **`square_cash_drawer_shifts`**, **`square_team_members`**, **`square_invoices`** — minimal columns (id, key facts) + raw.

## Code layout

```
lib/sync/
  ├── square-client.ts      pagination helpers, retry/backoff wrapper around Square SDK calls
  ├── supabase-admin.ts     service-role Supabase client (separate from user-facing supabase.ts)
  ├── types.ts              shared type defs for sync input/output
  ├── orders.ts             upsertOrder + backfillOrders
  ├── payments.ts           upsertPayment + backfillPayments
  ├── refunds.ts
  ├── customers.ts
  ├── catalog.ts            products, variations, categories, modifiers
  ├── loyalty.ts            accounts + events
  ├── inventory.ts
  ├── locations.ts
  └── tier-c.ts             gift cards, disputes, cash drawer, team, invoices

app/api/webhooks/square/route.ts    HMAC verify → dispatch
app/api/admin/sync-recent/route.ts  Admin-triggered window sync

scripts/backfill.ts                 npm run backfill — full-history load
```

### Handler contract

Every entity file exports the same shape:

```ts
// lib/sync/orders.ts
export async function upsertOrder(rawSquareOrder: unknown): Promise<void>
export async function backfillOrders(since?: Date): Promise<{ count: number }>
export async function syncRecentOrders(hoursBack: number): Promise<{ count: number }>
```

- `upsert*` — called by webhook handlers. Takes one Square entity. Upserts by id.
- `backfill*` — called by the backfill script. Full pagination from Square, through retries.
- `syncRecent*` — called by admin-reload fallback. Last N hours only.

### Webhook handler

```
POST /api/webhooks/square
  verify x-square-hmacsha256-signature header
  parse body
  dispatch by event.type:
    order.created / order.updated    → upsertOrder(event.data.object.order_updated)
    payment.created / payment.updated → upsertPayment(...)
    refund.created / refund.updated  → upsertRefund(...)
    customer.created / customer.updated → upsertCustomer(...)
    catalog.version.updated          → backfillCatalog() (signals a refresh is needed)
    inventory.count.updated          → upsertInventoryCount(...)
    loyalty.account.*, loyalty.event.* → upsertLoyalty...
  respond 200 ok
```

Signature verification uses `SQUARE_WEBHOOK_SIGNATURE_KEY` env. Wrong signature = 401. Unknown event type = 200 + warn log (Square retries on 4xx/5xx, and we don't want "unknown event" to trigger retries).

### On-admin-reload fallback

```
POST /api/admin/sync-recent   (admin-auth required)
  body: { entities: string[]; hoursBack?: number }
  for each entity:
    syncRecent<Entity>(hoursBack ?? 24)
  returns { results: [{ entity, count, durationMs }] }
```

Called from `/admin/orders`, `/admin`, etc. on mount. Results displayed as a "last synced" badge.

### Backfill script

```
scripts/backfill.ts
  for each entity in order:
    backfill<Entity>()
    log progress
  exit
```

Run: `npm run backfill`. Reads env from `.env.local`. Writes via service role. Idempotent — safe to re-run.

## Admin dashboard updates

### `/admin/orders` — full rewrite (biggest user-visible change)
- Query `square_orders` joined to `square_order_line_items`, `square_customers`, `square_payments`.
- Filter bar:
  - **Source:** All / POS / Online / External (based on `source_name` + `payments.source_type`)
  - **Date range:** Today / 7d / 30d / 90d / custom
  - **Customer:** search by email, phone, or name (fuzzy across customers table)
  - **Product:** dropdown of `square_products.name`
  - **Status:** OPEN / COMPLETED / CANCELED
  - **Amount:** min / max
- Still subscribes to Supabase Realtime on `square_orders` for new-row toast.
- Existing fulfillment status / tracking input UI stays — writes to `order_fulfillment` as today.

### `/admin` dashboard
Stat cards re-query Supabase aggregates:
- Total orders (30d): `count(*) from square_orders where created_at > now() - interval '30 days'`
- Revenue (30d): `sum(total_money_cents) / 100`
- Avg order value
- In-person vs online split

Loads in one round-trip.

### `/admin/loyalty`
Phone lookup queries `square_loyalty_accounts` first (indexed, fast), falls back to live Square call only if no cached row. Much faster for repeat lookups.

### `/admin/products`
Reads from `square_products` / `square_product_variations` (fast list). Writes still go to Square directly via `/api/square/catalog` (POS is source of truth for product master).

## RLS policies

For every `square_*` table:
```sql
alter table public.<table> enable row level security;

-- Service role (backfill, webhook, admin-reload) bypasses RLS — writes.
-- Admins read via admin-authenticated JWT + is_admin() function (already exists from sub-project 1).

create policy "admin-read <table>" on public.<table>
  for select to authenticated using (public.is_admin());
```

Nobody else gets any access. Service role is used in every sync + admin route that reads these tables.

## Tests

### Unit tests
- `lib/sync/orders.test.ts` — upsert happy path, upsert idempotency (same input twice = same row), upsert conflict version check
- `lib/sync/payments.test.ts` — source_type extraction (POS vs online distinguishable)
- `lib/sync/loyalty.test.ts` — accounts + events in same sync
- `lib/sync/catalog.test.ts` — products + variations linked correctly
- `lib/sync/square-client.test.ts` — pagination advances cursor correctly, retry backoff

### Route tests
- `app/api/webhooks/square/route.test.ts`:
  - valid signature + known event → handler called + 200
  - invalid signature → 401 + no handler
  - unknown event type → 200 + warn log (no retry trigger)
  - replay (same event twice) → idempotent (handler called twice but DB state same)
- `app/api/admin/sync-recent/route.test.ts`:
  - 401 unauthed
  - authed → all entities synced, results returned

### Backfill test
- `scripts/backfill.test.ts` — mock Square paginated responses, assert all entities processed, progress log formatted

## Required env vars (new)

| Var | Purpose |
|---|---|
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | HMAC verification for incoming Square webhook POSTs. Cole sets this in Square Dashboard + copies to Vercel env. |

Added to `.env.example`.

## Manual steps (Cole, after merge)

1. **Apply migrations:** `supabase db push` (or copy-paste the generated SQL into Supabase SQL editor if CLI tooling isn't set up locally yet)
2. **Run backfill:** `npm run backfill` once against production (N minutes depending on history size)
3. **Create Square webhook:** Square Dashboard → Webhooks → Add subscription
   - URL: `https://bitemeprotein.com/api/webhooks/square`
   - Events: subscribe to `order.created`, `order.updated`, `order.fulfillment.updated`, `payment.created`, `payment.updated`, `refund.created`, `refund.updated`, `customer.created`, `customer.updated`, `customer.deleted`, `catalog.version.updated`, `inventory.count.updated`, `loyalty.account.created`, `loyalty.account.updated`, `loyalty.event.created`, `gift_card.*`, `dispute.*`
4. **Add env var:** `SQUARE_WEBHOOK_SIGNATURE_KEY` in Vercel Project Settings → Environment Variables (and .env.local for dev)
5. **Verify:** open `/admin/orders`, confirm POS orders from the last few days appear. Place a test POS transaction (if sandbox) or check a real recent one (if prod).

## Rollout

One PR titled "Square → Supabase data pipeline (sub-project 2/5)". Logical commits:

1. `chore(supabase): install CLI, init, link project, pull baseline`
2. `feat(db): 18 square_* tables + RLS + indexes`
3. `feat(sync): shared client helpers + types`
4. `feat(sync): orders + payments + refunds`
5. `feat(sync): customers + catalog + loyalty + inventory + locations + tier-c`
6. `feat: /api/webhooks/square (HMAC + dispatch)`
7. `feat: /api/admin/sync-recent + scripts/backfill`
8. `feat(admin): /admin/orders rewrite with Supabase-backed filters`
9. `feat(admin): /admin stats + loyalty use cached data`
10. `test: sync handlers + webhook + backfill`
11. `docs: update .env.example + README for Square webhook`

Branch: `square-supabase-sync-sub2`. Depends on #1 — rebase onto main after #1 merges.

## Acceptance criteria

- [x] `npm test` passes locally + CI (60 tests)
- [x] `npm run lint` passes (0 errors, 2 pre-existing warnings)
- [x] `npx tsc --noEmit` passes
- [x] Supabase CLI set up (`supabase/config.toml`, `npm run db:*` scripts)
- [x] 18 `square_*` tables migration written with RLS + indexes
- [x] Square webhook POST (simulated with known HMAC) dispatches to correct handler (7 webhook tests)
- [x] `/admin/orders` rewritten to query Supabase with rich filters
- [x] `.env.example` updated with `SQUARE_WEBHOOK_SIGNATURE_KEY`
- [ ] Migration applied to production Supabase *(pending Cole: `npm run db:push`)*
- [ ] `npm run backfill` ingests real Square data end-to-end *(pending Cole)*
- [ ] `/admin` dashboard loads in < 500 ms *(measurable after data populated)*

## Related
- Sub-project 1 PR: #1 (harden foundations)
- Client README: `../../Clients/BiteMeProtein/README.md` in Obsidian vault
- Next up: sub-project 3 (product images + CMS for static content)
