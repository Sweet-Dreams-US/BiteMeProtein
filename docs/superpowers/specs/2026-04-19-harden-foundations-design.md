# Harden Foundations — Design Spec

**Date:** 2026-04-19
**Sub-project:** 1 of 5 in the BiteMeProtein admin-side roadmap
**Status:** approved, ready for implementation

## Problem

The site works in production but fails silently when it misbehaves. Recent incidents prove the pattern:

- **Loyalty SDK namespace bug** (`08c01dc`, 2026-04-19) — `client.loyalty.getProgram()` threw `TypeError` on every call, got swallowed by a catch, `/api/loyalty/program` returned `{enabled: false}` for weeks even though Haley had activated the "Stars" program.
- **Env-var loading bug** (`b170397`, `b6a5d78`) — two commits to land lazy client init.
- **Bundle-pricing bug** (`6e67719`) — checkout billed $48 instead of $38 because it summed item prices instead of using the bundle tier's fixed price.

Each of these would have been caught or at least *visible* with a test harness and an error log.

Today the repo has:
- No tests (no vitest / jest / playwright)
- No CI (no `.github/workflows/`)
- No pre-commit hooks
- No `.env.example`
- No error logging beyond `console.error` to Vercel runtime (which nobody actively monitors)

## Goals

After this sub-project ships:

1. A regression of any of the above bugs is caught by a test OR surfaces in an admin-visible error log within seconds.
2. Any new contributor can clone, set up env, and run tests in under 10 minutes using the repo's own documentation.
3. Every PR runs lint + typecheck + tests before merge.
4. No catch block in the codebase silently swallows an error.

## Non-goals

- Client-side error capture (belongs in a future sprint with Sentry or similar).
- Code coverage thresholds (let's first write tests that matter; chase coverage later if needed).
- Auto-pruning of old error logs (let it grow; add pruning when it hurts).
- E2E tests (belong in a later sprint once Square sandbox setup is nailed down).

## Design

### 1. Test harness — Vitest + happy-dom

Pick Vitest (not Jest) for:
- Faster startup (native ESM, no Babel)
- Better Next.js 16 / Turbopack compatibility
- Watch mode is instant

Layout:
- Config: `vitest.config.ts` at repo root
- Test environment: `happy-dom` (lighter than jsdom; we don't need full browser APIs)
- Colocated: `lib/square.test.ts` next to `lib/square.ts`, etc.
- Mocking: `vi.mock('square', ...)` and `vi.mock('@supabase/supabase-js', ...)` — zero network in tests

Initial smoke suite:

| Target | Why |
|---|---|
| `lib/square.ts` | Lazy init returns a singleton; env-var reads happen on first call, not at import |
| `lib/loyalty.ts` | Nested namespace paths (`client.loyalty.programs.get`); 5-min cache TTL; phone E.164 normalization |
| `lib/admin-auth.ts` | 401 on missing/bad token; pass on valid JWT; both Bearer header and `sb-access-token` cookie work |
| `app/api/shipping/rates/route.ts` | Zone lookup from ZIP prefix; rate selection by box type; bad-ZIP error; missing-param error |
| `app/api/orders/track/route.ts` | 2-factor requirement (both id + email); not-found handling; short-ID (6-char) match |

Scripts:
- `npm test` → one-shot run
- `npm run test:watch` → watch mode
- `npm run test:ui` → Vitest UI (devx nicety)

### 2. CI — GitHub Actions

Workflow: `.github/workflows/ci.yml`

Triggers: every PR targeting `main`, every push to `main`.

Steps:
1. `actions/checkout@v4`
2. `actions/setup-node@v4` with Node 24 (Vercel default)
3. `npm ci`
4. `npm run lint`
5. `npx tsc --noEmit`
6. `npm test`

Caching: npm cache keyed on `package-lock.json` hash.

**Manual follow-up for Cole after first successful run:** enable branch protection on `main` in GitHub UI, require this workflow to pass before merge. (Can't do this from CLI.)

### 3. `.env.example` + README "Local Setup"

`.env.example` — every env var from `Website/Environment.md` as placeholder values. Committed. Real `.env.local` stays ignored.

README additions:
- **Local Setup** section: prereqs (Node 24, npm), copy-env, install, dev, test
- **How to add a test** — one-paragraph pointer to `lib/square.test.ts` as an example

### 4. Error logging infra

**Table** `error_logs`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (default gen_random_uuid) | PK |
| `created_at` | timestamptz (default now()) | Indexed desc |
| `level` | text | `error` / `warn` / `info`. Check constraint. |
| `source` | text | `api-route` / `lib` / `client` / `webhook`. Check constraint. |
| `path` | text | Route path or function name, e.g. `/api/square/pay` or `lib/loyalty.ts:accruePoints` |
| `message` | text | Primary human-readable message |
| `stack` | text | nullable — full stack trace |
| `context` | jsonb | nullable — arbitrary structured data (order ID, user, inputs) |
| `user_id` | uuid | nullable — Supabase user if the error happened during an authed request |
| `request_id` | text | nullable — for correlation (future use, populate when available) |

Indexes:
- `(created_at desc)` — primary list view
- `(level, created_at desc)` — filtered by level
- `(source, created_at desc)` — filtered by source

RLS:
- Service role: `INSERT` only (that's how `logError` writes)
- Authenticated users (via JWT): `SELECT` only, gated by an `is_admin()` SQL function that checks a whitelist (for now: emails in an `ADMIN_EMAILS` env var, or a new `admin_users` table — pick one; see Open Decisions).
- Nobody else: no access

**Helper** `lib/log-error.ts`:

```ts
type LogLevel = 'error' | 'warn' | 'info'
type LogSource = 'api-route' | 'lib' | 'client' | 'webhook'

interface LogContext {
  path: string
  source?: LogSource
  level?: LogLevel
  userId?: string
  requestId?: string
  context?: Record<string, unknown>
}

export async function logError(
  err: unknown,
  ctx: LogContext
): Promise<void>
```

Behavior:
1. `console.error` immediately (so Vercel runtime still logs it)
2. Insert into `error_logs` via service-role Supabase client
3. Swallow any insert failure — last resort is another `console.error`. Logger must NEVER throw into the caller.

**Wiring into existing code** — update every `catch` in:
- `app/api/square/pay/route.ts` — main catch + fire-and-forget blocks (Resend email + loyalty accrual)
- `app/api/square/orders/route.ts`
- `app/api/square/catalog/route.ts`
- `app/api/square/inventory/route.ts`
- `app/api/shipping/rates/route.ts`
- `app/api/loyalty/program/route.ts`
- `app/api/loyalty/balance/route.ts`
- `app/api/orders/track/route.ts`
- `lib/loyalty.ts` — the try-catch that was hiding the namespace bug. This single line is the most-important code change in this sub-project.

**Admin page** `/admin/errors/page.tsx`:
- Auth-gated (redirects to `/admin/login` if unauthed)
- Reads via new `GET /api/admin/errors` with query params `?level=error&source=api-route&since=7d&q=loyalty`
- Table columns: time, level, source, path, message (truncated; click to expand)
- Row expansion: full stack + pretty-printed JSON context
- Default view: last 7 days, all levels, all sources
- Page-size 50 with cursor-based "load more"

**Retention:** no auto-delete. MVP grows; prune later.

### 5. Tests for the new code

- `lib/log-error.test.ts` — `logError` inserts row with correct shape, doesn't throw on insert failure
- `app/api/admin/errors/route.test.ts` — 401 unauthed, returns filtered rows when authed, respects query params

## Data model changes

1. New table `error_logs` (above)
2. New SQL function `public.is_admin()` — checks current user's email against `ADMIN_EMAILS` env or `admin_users` table
3. New RLS policies on `error_logs`

Migration file: `supabase/migrations/YYYYMMDDHHMMSS_error_logs.sql`

## Open decisions

### D1. Admin identity — how do we know a session is admin?

Three options:
- **A.** Simple env var `ADMIN_EMAILS` = comma-list. RLS function reads current user email, checks membership. Cheap, but rotating admins requires a Vercel env edit + redeploy.
- **B.** New `admin_users` table (`user_id uuid primary key`). RLS function checks membership. Scales, but introduces a second source of truth for "who can log in."
- **C.** Status quo — `requireAdmin()` just checks "is this a valid Supabase auth session at all?" because there's only one Supabase user today (Haley). Cheapest, least safe, works fine for 1-user MVP.

**Recommendation:** **C for now**, upgrade to **A** the day a second admin is added. Explicit comment in `requireAdmin()` noting the implicit assumption.

### D2. `ADMIN_EMAILS` scoping for option A

Deferred — only matters if D1 picks A.

### D3. Migration tooling

`supabase/migrations/` with the Supabase CLI, OR hand-crafted SQL applied via the Supabase dashboard?

**Recommendation:** hand-crafted SQL for this sub-project. The repo doesn't have a `supabase/` directory today; introducing the Supabase CLI workflow is its own setup cost. One file committed under `supabase/migrations/YYYYMMDDHHMMSS_error_logs.sql` as documentation; applied manually via Supabase SQL editor for now. Migration workflow can come in sub-project 2 where schema churn will be real.

## Testing strategy

- Unit tests for all new modules (`lib/log-error`, admin-errors API route)
- Unit tests for the 5 existing modules in the smoke list above
- No integration/E2E tests in this sprint — blocked on Square sandbox setup
- Tests run on CI + locally
- Manual verification post-deploy: trigger an error (curl a broken endpoint), confirm it appears in `/admin/errors`

## Rollout

One PR titled "Harden foundations: tests + CI + error logging". Logical commits inside:

1. `chore: vitest + happy-dom + npm scripts`
2. `ci: add GitHub Actions workflow`
3. `docs: .env.example + README Local Setup section`
4. `feat(db): error_logs table + RLS`
5. `feat: lib/log-error helper`
6. `feat: /admin/errors page + API`
7. `refactor: wire logError into all catch blocks`
8. `test: smoke tests for existing modules`

After merge: Cole enables branch protection on `main` in GitHub UI.

## Acceptance criteria

- [x] `npm test` passes locally (44/44)
- [x] `npm run lint` passes (0 errors, 2 pre-existing unused-var warnings)
- [x] `npx tsc --noEmit` passes
- [x] `.env.example` present, commented, matches `Website/Environment.md`
- [x] README has "Local Setup" that a new contributor can follow
- [x] `/admin/errors` renders logged errors with filter + search
- [x] Every catch block in `app/api/*` and `lib/loyalty.ts` calls `logError`
- [ ] `error_logs` table live in Supabase with RLS *(pending Cole applies `supabase/migrations/20260419120000_error_logs.sql`)*
- [ ] PR to `main` triggers CI workflow *(pending push)*
- [ ] A deliberately-triggered error appears in `/admin/errors` within seconds *(pending migration + deploy, verify post-deploy)*

## Related

- Client README: `../Clients/BiteMeProtein/README.md` in Obsidian vault
- Next sub-project: Square → Supabase data pipeline (will be spec'd after this one ships)
