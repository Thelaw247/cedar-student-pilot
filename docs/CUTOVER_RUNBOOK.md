# Cedar Cutover Runbook

The launch-day sequence for moving Cedar Student Pilot from staging to
production. Written Aug 28, 2026, against the verified staging stack
(Supabase dyowooyijuxghwnwuxcr · Render srv-da4h7arbc2fs73b96pjg ·
Cloudflare worker cedar-student-pilot · Stripe acct_1ToUnnRecX8K7mfK).
Everything in here assumes docs/MIGRATION_AUDIT.md's verification pass —
recording pipeline, billing lifecycle, auth, deletion flow — stays green.

Estimated hands-on time: ~2 hours, done in order. Steps are grouped so a
failure at any point leaves the app fully working on the previous step.

## Phase 0 — the week before

- [ ] Field tests done: one full-length (>90 min) recorded lecture
      (exercises segment rotation), account deletion on a throwaway
      account (never the admin account).
- [ ] Supabase: Auth → Passwords → enable leaked-password protection.
- [ ] Render dashboard: confirm env group vs service env vars define no
      duplicate keys.
- [ ] Decide the two cron jobs (grantMonthlyCredits, sendStudyReminders —
      $1/mo each on Render). Both are idempotent; monthly grants can also
      be run manually until they exist.
- [ ] Domain purchased + Resend domain verified (pending SEO research).
      NOT launch-blocking for web: the workers.dev URL functions; email
      sending is the only feature that hard-requires Resend.

## Phase 1 — infrastructure hardening (no user-visible change)

1. Render: upgrade cedar-api-staging from Free to Starter (or rename /
   create cedar-api-prod). Free-tier spin-down adds ~50s cold starts —
   unacceptable for webhooks and recording saves in production.
2. Verify /health/ready returns 200 from the paid instance; watch one
   deploy complete end-to-end.
3. Supabase: confirm project is on a paid plan if launch traffic is
   expected (free-tier pausing after inactivity would take the API down).
4. Cloudflare: if using a custom domain, add the route/custom domain to
   the worker; keep workers.dev as a fallback origin. Update
   VITE_/allowed-origin env (server CORS + Stripe return URLs read the
   app origin — grep APP_ORIGIN/appOrigin in server env before and after).

## Phase 2 — Stripe goes live (the point of no return is step 6, not here)

1. Stripe dashboard → complete live-mode activation (business details,
   bank account for CAD payouts).
2. Recreate the catalogue in LIVE mode exactly as test mode: 6 recurring
   prices (student/scholar/unlimited × monthly/semester — semester =
   4-month interval) + 3 credit packs, with the same metadata keys
   (cedar_tier, cedar_period, cedar_pack, cedar_credits). The server
   resolves prices by metadata, so metadata parity is what matters.
3. LIVE customer portal settings: dashboard.stripe.com/settings/billing/portal
   → configure (cancel at period end, payment method update, invoice
   history) → Save. (Test mode needed this too — it will silently 400
   portal sessions in live if skipped.)
4. Create the LIVE webhook endpoint → https://<prod-api>/stripe/webhook
   with the same event set as test (checkout.session.completed + async
   variants, invoice.paid, invoice.payment_succeeded/failed,
   customer.subscription.updated/deleted).
5. Render env: set the live STRIPE_SECRET_KEY and the new live
   STRIPE_WEBHOOK_SECRET. Redeploy. (The server picks test vs live
   catalogue from the key automatically.)
6. Smoke test with a REAL card for $9.99 CAD: subscribe → credits
   granted → portal opens → cancel at period end → refund yourself from
   the Stripe dashboard. This is the only step that costs money (~$0.59
   in non-refundable Stripe fees) and it is worth it.

## Phase 3 — cutover

1. Announce/being ready: the Base44 original stays untouched as the
   rollback target (do not delete it until 30 days post-launch).
2. Point the production domain at the Cloudflare worker (or bless the
   workers.dev URL as launch URL).
3. Watch, in order, within the first hour: Render logs (error-level),
   Stripe webhook deliveries (should be 200s), Supabase auth signups,
   one end-to-end recording on production by the owner.
4. Onboarding check: fresh signup lands on /welcome, questionnaire →
   paywall → X → recommendation → Continue with Free all work, and the
   free account gets exactly 20 credits.

## Phase 4 — first week

- [ ] Provision the two cron jobs (or calendar-remind to run grants
      manually on the 1st).
- [ ] Daily: Render error logs + Stripe webhook delivery failures +
      Supabase advisors.
- [ ] Watch the flashcard-generation log line ([recording] flashcard
      generation failed) — it was silent once; it logs now.
- [ ] iOS build track: RevenueCat + Apple IAP are launch-blocking for
      the App Store build only (Canada = IAP required; Stripe stays for
      web). Decide timing separately — the web launch does not wait.

## Rollback

Any failure in Phase 3: repoint the domain to Base44 (or stop announcing
the new URL). The Supabase database is the source of truth either way;
nothing in cutover migrates data, so rollback is DNS-fast and lossless.
Stripe live subscriptions created during a failed window can be refunded
and cancelled from the dashboard; the webhook's idempotency anchors mean
re-delivery after recovery can never double-grant.

## Post-launch invariants (do not regress)

- Grandfather rule: features never move UP the tier ladder for existing
  subscribers; bought credits never expire or get clawed back.
- No dark patterns: the X always works, Continue-with-Free always
  visible on the exit screen, cancel stays one portal away, billed
  totals always shown beside per-month framing.
- The hook stays free: recording, transcripts, summaries, flashcards.
