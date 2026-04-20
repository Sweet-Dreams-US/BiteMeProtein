# Customer Email Notifications — Design Spec

**Date:** 2026-04-19
**Sub-project:** 4 of 5 in the BiteMeProtein admin-side roadmap
**Status:** approved, ready for implementation
**Depends on:** sub-projects 1-3 (logError, admin order table, CMS infra unused for now)

## Problem

Today, **customers get zero email from the site**. Only Haley gets an admin-alert on new orders. When Haley marks an order shipped in `/admin/orders`, the customer only finds out if they go visit `/track` voluntarily.

Industry standard for DTC food is:
1. **Immediate order confirmation** on payment success
2. **Status updates** when the order starts preparing / ships / delivers
3. Tracking link the moment it's available

## Goals

After this sub-project ships:

1. Every successful checkout fires a customer-facing **order confirmation email** (in addition to the existing admin alert).
2. When Haley updates fulfillment status in `/admin/orders`, a customer-facing **status email** fires automatically (with an opt-out toggle per action).
3. Haley can **resend any email** from the order detail modal.
4. Emails use the same Resend integration as admin alerts — no new providers.
5. Failures surface in `/admin/errors` via `logError`.

## Non-goals

- **No marketing emails.** Transactional only.
- **No abandoned cart.**
- **No SMS.**
- **No React Email components.** Inline HTML matching the existing `lib/notifications.ts` admin-alert pattern — consistent, no new toolchain.
- **No customer-editable preferences.** Sub-project 5 (customer accounts) adds account-based unsub; transactional emails until then don't need a preference surface.

## Design

### Four templates, one file

`lib/customer-emails.ts` exports:

```ts
sendOrderConfirmation(data: OrderEmailData): Promise<void>
sendOrderPreparing(data: OrderEmailData): Promise<void>
sendOrderShipped(data: OrderEmailData & { trackingUrl?: string }): Promise<void>
sendOrderDelivered(data: OrderEmailData): Promise<void>
```

All four are **fire-and-forget** — same pattern as `notifyAdminOfOrder` in `lib/notifications.ts`. Failures call `logError` so they appear at `/admin/errors`. The caller never awaits the result in critical paths (checkout, admin save).

`OrderEmailData` shape (builds on existing admin notification data):
```ts
{
  orderId: string;
  shortId: string;           // 6-char uppercase
  buyerEmail: string;        // required — no email = no send
  buyerName?: string;
  totalCents: number;
  orderType: "pickup" | "shipping";
  items: Array<{ name: string; quantity: number }>;
  trackUrl: string;          // https://bitemeprotein.com/track?id=<full>&email=<...>
}
```

### Trigger points

**Order confirmation** — inside `/api/square/pay` after Square Order + Payment succeed. Fire-and-forget next to the existing admin email + loyalty accrual. If `buyerEmail` is empty (rare but possible), skip with an info log.

**Status emails** — inside `/admin/orders` when saving fulfillment. After the `order_fulfillment` upsert succeeds, if status changed AND customer email is available, POST to `/api/admin/customer-email` with `{ orderId, type: "preparing" | "shipped" | "delivered" }`. API route fetches the order details from Supabase (sub2's `square_orders` + `square_customers`), builds the template, sends via Resend.

**Resend-any-email button** — admin UI gains a "Resend email" dropdown in the order detail modal with items for confirmation / preparing / shipped / delivered. Same endpoint as above.

### Templates — shape guideline

Each email follows this skeleton (same visual DNA as the existing admin email so brand stays consistent):

```
┌─────────────────────────────────────┐
│  [Burgundy header]                  │
│  🎉 / 🧁 / 📦 / ✨    Subject emoji │
│  Order #XXXXXX · $price             │
├─────────────────────────────────────┤
│  Dear {name},                       │
│                                     │
│  {status-specific body — 1 short    │
│  paragraph with warmth + clarity}   │
│                                     │
│  ORDER SUMMARY                      │
│  • Item ×Qty     $xx                │
│  • Item ×Qty     $xx                │
│  Total          $xx                 │
│                                     │
│  {CTA button: Track order}          │
│                                     │
│  Questions? Reply to this email.    │
├─────────────────────────────────────┤
│  [Cream footer with small text]     │
└─────────────────────────────────────┘
```

Subject lines (default, could be CMS-editable later):
- Confirmation: `🎉 Your Bite Me order is confirmed — #XXXXXX`
- Preparing: `🧁 We're baking your order — #XXXXXX`
- Shipped: `📦 Your Bite Me order is on the way — #XXXXXX` (+ carrier/tracking in body)
- Delivered: `✨ Your Bite Me order arrived — enjoy! — #XXXXXX`

### Reply-to handling

Every email sets `reply_to: ADMIN_NOTIFICATION_EMAIL` (haley@bitemeprotein.com), so if a customer replies, it goes straight to Haley. No new inbox needed.

### API route

`POST /api/admin/customer-email` — admin-gated
```
body: { orderId: string; type: "confirmation" | "preparing" | "shipped" | "delivered"; }
```

Flow:
1. Look up order + customer + fulfillment from Supabase
2. Build `OrderEmailData`
3. Call the appropriate `send*` function
4. Return `{ sent: true }` or `{ sent: false, reason }` if no customer email

Used by both the admin "Resend" dropdown AND the auto-send-on-status-change wiring.

### Admin UI addition

In `/admin/orders` modal, below the "Save Fulfillment" button, add:
- Auto-send email checkbox (default on) — when checked, Save triggers the matching status email after persist.
- "Resend email" dropdown — lets Haley manually re-send any template in case of issue.

### Failure modes

- **Customer email missing** — skip + warn log (no customer-facing consequence).
- **Resend API down** — fire-and-forget logs error. Order still saves. Haley can retry from the Resend dropdown.
- **Invalid status type in API** — 400.

### CMS integration (deferred)

Sub-project 3 shipped `cms_content`. Future: subject lines + body text as CMS keys (e.g., `email.confirmation.subject`, `email.shipped.cta_label`). Not in this PR — inline defaults are good enough and shipping without them doesn't block anything.

## Rollout

Branch: `customer-emails-sub4` (based on sub3). Commits:

1. `feat: lib/customer-emails.ts with 4 transactional templates`
2. `feat: customer confirmation from /api/square/pay`
3. `feat(admin): /api/admin/customer-email route`
4. `feat(admin): email controls in /admin/orders (auto-send + resend dropdown)`
5. `test: customer-emails + admin API coverage`

## Acceptance criteria

- [x] `npm test` (103 tests) + `npm run lint` (0 errors) + `npx tsc --noEmit` green
- [x] Checkout fires customer confirmation on success (next to admin email)
- [x] Saving fulfillment with `status` change fires matching email (wiring via /api/admin/customer-email)
- [x] Admin modal has auto-send checkbox + resend dropdown
- [x] All failures surface at `/admin/errors` via logError
- [x] No regression on existing admin-alert email (notifyAdminOfOrder unchanged)
- [ ] End-to-end confirmation *(pending Cole: merge + smoke test with a real order)*

## Manual steps after merge

1. Merge PR #1 → #2 → #3 → #4 in order
2. Verify Resend env vars (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`) are set (already there from sub1/prior)
3. Place a test order — confirm customer confirmation email lands
4. Mark the test order shipped in /admin/orders — confirm shipping email lands

## Related

- Sub-project 3: Images + CMS (PR #3)
- Client README: `../../Clients/BiteMeProtein/` in Obsidian vault
- Future sub-project 5: customer accounts + order history (adds preference center + unsubscribe)
