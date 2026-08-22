# Cedar migration audit

Last verified: 2026-08-22 (America/Edmonton)

## Executive status

The parallel stack has a strong security and compatibility foundation, but it
is **not ready for cutover**. Base44 remains untouched. All reviewed changes
live on `codex/security-and-api-hardening` in draft PR #1; Render's API service
still deploys `main`.

| Area | Status | Evidence / remaining work |
| --- | --- | --- |
| Supabase database | Strong, usable for staging | 20 public tables, RLS enabled; client grants split by operation; server-only tables locked down; FK indexes added; Base44 lifecycle timestamps restored. Eight exact post-audit migrations are committed. Six older migrations still need a schema-only export. |
| Supabase Auth | Code complete, dashboard setup pending | Password, signup OTP, recovery, OAuth adapter, profile provisioning and session refresh are implemented. Redirect URLs, email template/provider settings, Apple/Facebook providers, and leaked-password protection need dashboard verification. |
| Express API | Hardened staging service is live | `cedar-api-staging` deploys the audit branch independently. Health, exact-origin CORS, hostile-origin rejection, and unauthenticated rejection are verified. Database, R2, AI, and Stripe secrets are not configured on this new service yet. The older `main` API is untouched. |
| R2 storage | Code complete, infrastructure pending | Private presigned recording/avatar upload, confirmation, playback, ownership validation, and lifecycle deletion are implemented. Bucket, CORS, least-privilege token, and Render secrets do not exist yet. |
| Staging frontend | Built and deployed | `cedar-staging` builds the audit branch in Supabase mode at https://cedar-staging-jeu6.onrender.com and now targets the isolated hardened API. A Cloudflare Pages `_redirects` fallback is committed; the temporary Render site still needs its Dashboard rewrite. |
| Full staging test | Blocked | Requires hardened API deployment, R2, provider secrets, Auth redirect/email configuration, and a test user. |
| Cutover | Not started | No Base44 publish, DNS change, live Stripe webhook switch, or production-domain change has occurred. |

## Verified controls

- Supabase security advisor has no RLS-disabled or public security-definer
  findings. The remaining `system_state` notice is intentional (RLS with no
  policies makes it server-only).
- Supabase performance advisor has no missing-FK-index or RLS init-plan
  warnings. Current unused-index notices are expected on an empty database.
- Browser CRUD uses the caller's Supabase session and Postgres RLS. Privileged
  tables (`credit_balances`, `usage_events`, `handbooks`, Stripe ledger, and
  `system_state`) cannot be written by the browser.
- Render function calls require verified Supabase sessions and queries include
  explicit ownership predicates.
- CORS uses exact origins; production has no wildcard or permissive fallback.
- Stripe fulfillment keeps durable idempotency state in the same transaction as
  credit changes. Monthly grants use an advisory lock and per-user idempotency.
- Timetable parsing accepts only bounded inline PDF/image data. Arbitrary URL
  fetching was removed to close SSRF access to internal/metadata endpoints.
- Private R2 references never expose permanent public object URLs. Uploads use
  short-lived signed PUTs, server-confirmed metadata, user-scoped opaque keys,
  and signed GETs.
- Lecture, class, avatar, and account deletion clean up owned objects. Account
  relational deletion is transactional.
- The prior `processSessionReview` alias bug is fixed: completed reviews are
  now ownership-checked, scored deterministically, and persisted atomically.
- The live frontend/database contract now includes review study sessions,
  lecture-linked reviews, and validated recurring calendar series without a
  fake date.
- A generated `supabase/database.types.ts` snapshot makes remote schema drift
  reviewable in Git even before the six historical DDL exports are recovered.
- CI checks all frontend function names against Express mounts. This caught and
  fixed the acronym route mapping for `academicAIChat`.
- Both Base44-mode and Supabase-mode frontend builds pass. ESLint has no errors.
  Server tests currently cover HTTP/CORS, Stripe signatures, R2 validation,
  timetable input/SSRF, and review scoring.

## Known gaps and risks

### Blocking staging

1. Add the server-only `DATABASE_URL` and required test provider secrets to
   `cedar-api-staging`. It currently proves startup/security behavior but
   database-backed feature requests intentionally cannot succeed without them.
2. Create a private R2 bucket and a token limited to object read/write/list for
   that bucket. Configure bucket CORS for the staging origin and add the four
   `R2_*` variables to Render.
3. Configure `cedar-api-staging`'s health-check path as `/health` in the Render
   Dashboard. Its build already uses `npm ci --prefix server`.
4. Add the staging URL and `/reset-password` to Supabase Auth redirect URLs,
   verify signup/recovery email templates, and enable leaked-password
   protection. Configure OAuth providers only if Apple/Facebook buttons remain.
5. Add/verify required provider secrets: `DATABASE_URL`, `SUPABASE_URL`,
   `SUPABASE_ANON_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, Stripe test keys, and
   the applicable trigger tokens.
6. Add a Render static-site rewrite from `/*` to `/index.html` so direct links
   into the React SPA do not 404.

### Before production

- Recording upload currently permits 200 MB, while the single-request Groq
  transcription path rejects files above 24 MB. Implement audio chunking (or
  lower the accepted upload limit with a clear recording-duration policy)
  before calling the recording pipeline production-ready.
- `sendStudyReminders` and transcript email mode intentionally fail closed
  until an email provider/relay is configured.
- `academicAIChat` remains disabled by its feature flag, matching its withdrawn
  Base44 state.
- Create and verify the monthly-credit Render Cron Job with a generated trigger
  token; it has not been provisioned.
- Complete a Stripe test-mode subscription/renewal/portal/webhook run. Do not
  add the live webhook until cutover preparation.
- Export the six historical Supabase migrations so a new project can be
  bootstrapped reproducibly from the repository.
- Add integration/E2E coverage against real staging services. Current automated
  tests are unit/HTTP-boundary tests and builds, not a full browser journey.
- The repository-wide `npm run typecheck` is not clean. The raw Base44 export
  has extensive pre-existing JS/JSDoc and SDK-union typing errors; lint and both
  production builds pass, and the generated Supabase type file validates in
  isolation, but type checking is not yet a trustworthy CI gate.
- The frontend bundle is about 1.56 MB minified (about 416 KB gzip). It works,
  but route-level code splitting should be a performance follow-up.

## Render inventory

- Workspace: `My Workspace` (`tea-da3jhu3ncjis73cmsas0`)
- API: `cedar-server` (`srv-da451eek1f9s73ampaug`), Virginia, free plan,
  auto-deploying `main`, current live commit `78bd96f...`
- Isolated API: `cedar-api-staging` (`srv-da4h7arbc2fs73b96pjg`), Virginia,
  free plan, auto-deploying `codex/security-and-api-hardening`, health URL
  https://cedar-api-staging.onrender.com/health
- Staging frontend: `cedar-staging` (`srv-da4h138n74is73dk42o0`), auto-deploying
  `codex/security-and-api-hardening`
- Isolated API exact allowed browser origin:
  `https://cedar-staging-jeu6.onrender.com`

## Safety boundary

The live Base44 app, production DNS, and live Stripe webhook have not been
changed. Keep that boundary until the isolated stack passes the complete
new-user staging journey.
