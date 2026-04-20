# Bite Me Protein

E-commerce + in-person POS integration for Haley's protein bakery — bitemeprotein.com.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase · Square · Resend · Vercel.

## ⚠️ This is NOT the Next.js you know

Next.js 16 has breaking changes from earlier versions. **Check `node_modules/next/dist/docs/` for the installed-version docs** before applying patterns you remember from Next 14/15.

## Local Setup

### Prereqs
- Node 24 LTS (match Vercel)
- npm (there's a `package-lock.json`; don't switch to pnpm/yarn)

### First-time setup

```bash
git clone https://github.com/Sweet-Dreams-US/BiteMeProtein.git
cd BiteMeProtein
npm install
cp .env.example .env.local
# Fill in .env.local with real values (see Environment section below)
```

### Run the dev server

```bash
npm run dev
```

Open http://localhost:3000.

### Run the admin dashboard
Go to http://localhost:3000/admin/login and sign in with a Supabase user.

### Run tests

```bash
npm test            # one-shot
npm run test:watch  # watch mode
npm run test:ui     # Vitest UI
```

### Typecheck + lint

```bash
npm run lint
npm run typecheck
```

## Environment

Every env var is documented with a placeholder in [`.env.example`](./.env.example). Real values live in Vercel Project Settings → Environment Variables (ask Cole for access).

**Do not commit `.env.local`.** It's gitignored.

## Architecture at a glance

- **`app/`** — Next.js App Router (pages + API routes)
- **`app/admin/*`** — Supabase-auth-gated dashboard for Haley
- **`app/api/*`** — server routes: Square catalog/orders/payments, loyalty, shipping, order tracking
- **`lib/`** — `square.ts` (lazy singleton), `supabase.ts`, `loyalty.ts`, `admin-auth.ts`, `notifications.ts` (Resend), `log-error.ts`
- **`supabase/migrations/`** — schema changes (hand-applied via Supabase SQL editor for now)
- **`docs/superpowers/specs/`** — design specs for larger changes

## Deploy

Push to `main` → Vercel auto-deploys to production. Pull requests get preview URLs automatically.

## CI

Every PR and every push to `main` runs [`.github/workflows/ci.yml`](./.github/workflows/ci.yml): lint + typecheck + test. **Enable branch protection on `main` in GitHub UI** to block merges on red CI.

## Writing tests

Tests are colocated next to source as `*.test.ts`:

```
lib/square.ts
lib/square.test.ts    ← tests for the above
```

See `lib/square.test.ts` for the pattern (mock SDKs at the top of the file, no network). Run `npm test` to verify.

## Reference

- **Client profile & docs** — `../../Clients/BiteMeProtein/` in the Sweet Dreams Obsidian vault (`SweetDreamsOfficial`).
- **Square docs** — https://developer.squareup.com/reference/square
- **Supabase docs** — https://supabase.com/docs
- **Resend docs** — https://resend.com/docs
