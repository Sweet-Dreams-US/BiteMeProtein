# Customer Accounts + Order History — Design Spec

**Date:** 2026-04-20
**Sub-project:** 5 of 5 — last one in the BiteMeProtein admin-side roadmap
**Status:** approved, ready for implementation
**Depends on:** sub-projects 1–4 (especially sub-2's `square_orders` + `square_customers` mirror for history lookup)

## Problem

Today `/track` is the only way a customer sees order status — and they need BOTH the order ID AND the email to find one order at a time. Repeat buyers have no memory of what they bought, no saved addresses, no way to see all their orders in one place.

Haley also wants a long-term foundation for:
- Abandoned-cart recovery
- Loyalty tied to identity (currently phone-only)
- Preference center / unsubscribe (needed once marketing emails arrive)

A customer account system solves all of it in one go.

## Goals

After this sub-project ships:

1. Customers sign in with **magic-link only** — no password.
2. `/account` shows their order history (POS orders included when phone or email matches), with the same timeline UI as `/track`.
3. `/track` auto-fills and skips the 2-factor prompt when the signed-in customer visits.
4. A simple `customer_profiles` table links Supabase Auth `user.id` to `square_customers.id` on first sign-in via email match.
5. Admin dashboard unaffected — no changes to `/admin/*`, same RLS, same behavior.

## Non-goals

- **No password auth.** Magic link only. Simpler, safer, less to manage.
- **No saved addresses UI** — surface what Square has, but don't let the customer edit them here (Square's a mess to mutate from the site and Haley's the admin).
- **No stored payment methods.** Square handles card storage server-side.
- **No social login** (Google/Apple).
- **No unsubscribe center.** Transactional-only world; can revisit when marketing emails arrive.
- **No guest-to-registered upgrade flow.** Existing orders surface automatically on first sign-in via email match; no "claim your past orders" wizard needed.

## Design

### Data model

**New table `customer_profiles`**
```sql
user_id            uuid primary key references auth.users(id) on delete cascade,
email              text not null,
phone              text,
square_customer_id text references public.square_customers(id) on delete set null,
created_at         timestamptz not null default now(),
last_signin_at     timestamptz
```

Links one Supabase Auth user to one Square customer (if match found). If no match exists at first sign-in, `square_customer_id` stays null; order history falls back to matching by email on `square_orders.raw`.

**RLS**:
- Authenticated users can SELECT their own row (`user_id = auth.uid()`)
- Authenticated users can UPDATE their own row (for phone editing later)
- Service role only for INSERT (sign-up hook)

### Auth config

- **Provider:** Supabase Auth, email OTP (magic link).
- **Email delivery:** we already use Resend for transactional emails — configure Supabase SMTP to route through Resend so branding is consistent.
- **Redirects:** `NEXT_PUBLIC_SITE_ORIGIN/account/callback`

Manual Supabase Dashboard steps (documented in PR body):
1. Enable **Magic Link** in Auth → Providers → Email
2. Disable password auth (optional but cleaner)
3. Configure Resend SMTP credentials under Auth → Email Templates
4. Add `/account/callback` to the redirect allowlist

### Sign-in flow

1. Customer visits `/account/login` → enters email
2. Clicks "Send magic link" → Supabase emails a one-click link
3. Link targets `/account/callback?code=…` → Next.js route exchanges code for session
4. First sign-in: server creates a `customer_profiles` row, tries to match `square_customers` by email, stores `square_customer_id` if found
5. Redirect to `/account`

### `/account` — order history UI

- Guards: unauthed → redirect to `/account/login`
- Fetches from `GET /api/account/orders` which returns the signed-in user's orders
- Query strategy (in the API route):
  1. Look up `customer_profiles.square_customer_id` for the authed user
  2. If present, query `square_orders WHERE customer_id = $1` + line items + fulfillment
  3. Also query `square_orders` with `raw->fulfillments[0]->shipmentDetails->recipient->emailAddress = authed.email` to catch anonymous POS orders under the same email
  4. Also match on `raw->fulfillments[0]->pickupDetails->recipient->emailAddress`
  5. Dedupe by order id, sort created_at desc

Returned rows include: id, short id, created_at, total, fulfillment status (joined from `order_fulfillment`), line items, tracking (if any).

UI: list of cards, each tappable → expands a timeline view matching the `/track` layout. One component shared.

### `/track` auto-fill

When a customer visits `/track` while signed in:
- Pre-fill `email` field from `supabase.auth.getUser()`
- If `?id=xxx` is set in URL, skip the manual form entirely and render the order detail

(Intentionally: 2-factor still applies to unauth visits so an enumeration attack still needs both pieces.)

### Navbar

Add a right-side "Account" link:
- Signed out: "Sign in" → `/account/login`
- Signed in: user initial or "Account" → `/account`

### Sign-out

Button on `/account` → `supabase.auth.signOut()` → redirect to home.

## Files

```
supabase/migrations/20260420100000_customer_profiles.sql
  customer_profiles table + RLS + on-signin trigger function (stub)

lib/customer-auth.ts
  useCurrentCustomer() — hook returning { user, profile, loading }
  getCurrentCustomer() — server-side helper

app/account/login/page.tsx
  email input → sends magic link
app/account/callback/route.ts
  exchanges code for session + ensures customer_profiles row exists
app/account/page.tsx
  order history list + account info
app/account/layout.tsx
  auth gate, signed-in shell

app/api/account/orders/route.ts
  authed GET, returns the signed-in user's orders

components/account/OrderHistoryCard.tsx
components/account/OrderTimeline.tsx (reusable between /account and /track)

Navbar update: sign-in/account link
/track update: auto-fill email + skip form when authed

Tests
  app/api/account/orders/route.test.ts
```

## Rollout commits

1. `feat(db): customer_profiles table + RLS + seed`
2. `feat: lib/customer-auth hook + server helper`
3. `feat(account): /account/login + /account/callback magic-link flow`
4. `feat(account): /account order history page + /api/account/orders`
5. `refactor(track): auto-fill email + skip form when signed in`
6. `feat(nav): Account link in Navbar`
7. `test: account orders API coverage`

## Acceptance criteria

- [ ] `npm test` + `npm run lint` + `npx tsc --noEmit` green
- [ ] New customer can enter email at `/account/login`, receive magic link, click it, land on `/account`
- [ ] Existing Square customer with matching email sees their past orders immediately (via email match on raw fulfillment recipients)
- [ ] `customer_profiles` row gets created on first sign-in and `square_customer_id` is populated when match found
- [ ] `/track` pre-fills email for signed-in users
- [ ] Navbar shows "Sign in" when unauthed, "Account" when authed
- [ ] Sign-out returns to home
- [ ] No regression on existing admin auth (separate Supabase user base but same auth provider is fine — RLS on admin tables still checks is_admin())

## Manual steps after merge

1. Merge prior PRs in order: #1 → #2 → #3 → #4 → #5 → #6
2. Apply migration: `npm run db:push` (or paste SQL)
3. **Supabase Dashboard**:
   - Auth → Providers → Email: enable Magic Link (disable password if desired)
   - Auth → SMTP: point at Resend with `ADMIN_NOTIFICATION_EMAIL` or a dedicated "no-reply@bitemeprotein.com"
   - Auth → URL Configuration: add `https://bitemeprotein.com/account/callback` to redirect allowlist
   - Auth → Email Templates: customize magic-link template with Bite Me branding
4. Smoke test: sign in with a real email, confirm landing on `/account`, confirm order history shows

## Related

- Sub-project 4 PR #4 — customer email infrastructure (Resend)
- Client README: `../../Clients/BiteMeProtein/` in Obsidian vault
- **This is the last sub-project in the roadmap.** After this, the admin-side hardening arc is complete.
