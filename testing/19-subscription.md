# 19 — Subscription Testing

**Scope:** plans, pricing UI, entitlements, quotas, checkout/webhook authority, downgrade safety (§44-§69).

## Plans under test (from `backend/src/config/plans.ts` — the single source of truth)

| Plan | Monthly | 6 Months | Yearly |
|---|---|---|---|
| Free | ₹0 | — | — |
| AETHER Pro | ₹299 | ₹1,499 | ₹2,499 |
| Campus | custom | — | — |

Savings % is **computed** by `savingsPercent()` — expected:
halfyear ≈ **−17%** (299→249.83/mo), yearly ≈ **−30%** (299→208.25/mo).
The pricing toggle must show exactly these numbers, nothing hardcoded (§60).

## Tests

| # | Test | Steps | Expected | Actual | PASS/FAIL |
|---|---|---|---|---|---|
| 19.1 | Plans config API | `GET /api/subscription/plans-config` | All 3 plans, prices, features, computed savings — no env keys leaked | | |
| 19.2 | Pricing UI matches config | /subscription → toggle intervals | Prices + −% match table above for each interval | | |
| 19.3 | Billing status (§53) | `GET /api/subscription/me` | planId, status enum (ACTIVE/PAST_DUE/…), periodEnd, usage meters | | |
| 19.4 | Free blocked at backend (§50) | Free user → create 2nd resume version via API directly (bypass UI) | **402 UPGRADE_REQUIRED** — frontend button is presentation only | | |
| 19.5 | Pro permitted | Pro user → same call | 201 created; usage ledger row written | | |
| 19.6 | AI credits (§48) | Free user exhausts 20 credits → AI ATS explanation | 402 with "Monthly AI credits exhausted"; deterministic explanation still available without AI | | |
| 19.7 | Credits billed on success only | Trigger AI call that errors | No UsageLedger row for the failed call | | |
| 19.8 | Checkout (§56) | Pro → Upgrade → Stripe test checkout | Session created with selected interval; webhook flips status ACTIVE | | |
| 19.9 | Webhook authoritative | Complete checkout, but DON'T wait on success URL; hit /subscription/me immediately after webhook | Plan=pro via webhook state, not URL landing | | |
| 19.10 | Webhook signature (§57) | POST forged webhook body without valid signature | 400 rejected | | |
| 19.11 | Idempotency (§57) | Replay same `checkout.session.completed` | No duplicate history rows / subscription changes | | |
| 19.12 | Cancel at period end (§64) | Cancel via portal while active | status CANCELED + cancelAtPeriodEnd=true; /subscription/me still grants access; shows exact access-end date | | |
| 19.13 | Expired removal | Simulate periodEnd in past | entitlements revert to free; premium endpoints 402 | | |
| 19.14 | Downgrade keeps data (§63) | User with 5 resumes downgrades | All 5 viewable; 6th creation blocked with clear message — **nothing deleted** | | |
| 19.15 | Usage meter (§65) | /subscription page meters | AI credits "18 / 20 used" style; interview quota; resets monthly | | |
| 19.16 | Template gating | Free user requests modern-professional template | Silently saved as ats-classic (or upgrade prompt); Pro user saves freely | | |
| 19.17 | Manual-activation guard | With STRIPE_SECRET_KEY set → POST /api/subscription/activate-manual | 403 refused — webhook remains authoritative | | |

## Stripe sandbox config (§55)

`.env` (never commit real values):
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_HALF_YEAR=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
```
Test with card `4242 4242 4242 4242`; never a real charge.
