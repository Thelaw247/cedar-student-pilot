# Cedar migration audit

Last verified: 2026-08-22 (America/Edmonton)

## Executive status

The parallel stack is solid enough for authenticated staging, but it is **not
ready for cutover**. Base44 remains untouched. All reviewed migration changes
live on `codex/security-and-api-hardening` in draft PR #1.

| Area | Status | Evidence / remaining work |
| --- | --- | --- |
| Supabase database | Ready for staging | 20 public tables; RLS enabled on every table; grants and policies verified against the live project. Client CRUD is user-scoped, privileged tables are read-only or server-only, and the database readiness probe passes. Eight exact post-audit migrations are committed; six older migrations still need a schema-only export. |
| Supabase Auth | Ready for email/password staging | Password login, signup OTP, recovery, profile provisioning, and session refresh are implemented. Apple/Facebook controls are intentionally hidden on the isolated frontend until those providers are configured. Redirect URLs, email delivery/templates, and leaked-password protection still need dashboard verification. |
| Express API | Live and infrastructure-ready | `cedar-api-staging` auto-deploys the audit branch. `/health/ready` returns HTTP 200 with independent `database: ok` and `storage: ok` checks. Exact-origin CORS, hostile-origin rejection, unauthenticated rejection, and server tests are verified. Provider-specific AI, Stripe, email, and cron secrets still need functional verification. |
| R2 storage | Bucket and credentials verified | The private bucket is reachable from Render with the configured credentials. Presigned recording/avatar upload, confirmation, playback, ownership validation, and lifecycle deletion are implemented. A real signed PUT/confirm/GET round trip still needs an authenticated staging session. |
| Staging frontend | Live on Cloudflare | The Cloudflare Worker static-assets deployment at https://cedar-student-pilot.dewetluus.workers.dev builds in isolated Supabase/Render mode. `/login`, `/register`, and `/forgot-password` load directly with no application console errors. The landing and auth routes no longer depend on the Base44 Vite plugin in this build. |
| Full staging test | Next gate | Requires signing in as a staging user, then exercising entity CRUD, R2 upload/playback, AI flows, Stripe test mode, email recovery/relay, and scheduled credits. |
| Cutover | Not started | No Base44 publish, DNS change, live Stripe webhook switch, or production-domain change has occurred. |

## Verified controls

- Supabase security advisor has no RLS-disabled or public security-definer
  findings. The `system_state` notice is intentional: RLS with no client policy
  makes the table server-only. The remaining warning is Auth leaked-password
  protection, which is a dashboard setting.
- Every public table has RLS enabled. `anon` has no access to user tables.
  `authenticated` grants match the intended policy surface, including
  read-only credit, handbook, usage, and Stripe-ledger data.
- Browser CRUD uses the caller's Supabase session and Postgres RLS. Render
  function calls verify the Supabase session and use explicit ownership
  predicates.
- The live readiness endpoint verifies both the Supabase connection and an R2
  `HeadBucket` call. R2 environment values are trimmed before use so copied
  credentials containing trailing whitespace cannot corrupt signed headers.
- CORS uses exact origins; production has no wildcard or permissive fallback.
- Stripe fulfillment keeps durable idempotency state in the same transaction as
  credit changes. Monthly grants use an advisory lock and per-user idempotency.
- Timetable parsing accepts only bounded inline PDF/image data. Arbitrary URL
  fetching was removed to close SSRF access to internal and metadata endpoints.
- Private R2 references never expose permanent public object URLs. Uploads use
  short-lived signed PUTs, server-confirmed metadata, user-scoped opaque keys,
  and signed GETs.
- Lecture, class, avatar, and account deletion clean up owned objects. Account
  relational deletion is transactional.
- The prior `processSessionReview` alias bug is fixed: completed reviews are
  ownership-checked, scored deterministically, and persisted atomically.
- A generated `supabase/database.types.ts` snapshot makes remote schema drift
  reviewable in Git even before the six historical DDL exports are recovered.
- The frontend compatibility client covers entity CRUD, Supabase Auth, all 25
  frontend function names, Render routing, and R2 upload flows. This means the
  remaining frontend work is validation and targeted fixes, not 65 independent
  Base44 rewrites.
- CI checks all 25 frontend function names against Express mounts. Both the
  default Base44-mode build and the Cloudflare-mode build pass; ESLint passes.
  The server suite currently passes 18/18 tests.

## Known gaps and risks

### Blocking full staging verification

1. Sign in to the Cloudflare staging URL with an existing staging account (or
   create one) so authenticated API, RLS, and storage journeys can be tested.
2. In Supabase Auth, verify the staging site URL and allowed redirects include
   the Cloudflare origin and `/reset-password`. Verify signup/recovery email
   delivery and templates, and enable leaked-password protection.
3. Inventory and functionally verify provider secrets on `cedar-api-staging`:
   `GEMINI_API_KEY`, `GROQ_API_KEY`, Stripe **test-mode** keys/webhook secret,
   email relay/provider values, and cron/trigger tokens. Database and R2
   connectivity are already verified without exposing their secret values.
4. Complete a real R2 signed PUT, upload confirmation, signed GET/playback, and
   cleanup cycle through the authenticated staging app.
5. Configure Render's service health-check path as `/health/ready`. The endpoint
   is live and green, but the service currently has no Dashboard health path.

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
- Complete a Stripe test-mode subscription, renewal, portal, cancellation, and
  webhook replay/idempotency run. Do not add the live webhook until cutover
  preparation.
- Export the six historical Supabase migrations so a new project can be
  bootstrapped reproducibly from the repository.
- Add integration/E2E coverage against the real staging services. Current
  automated tests cover unit and HTTP boundaries plus builds, not the complete
  browser journey.
- The repository-wide `npm run typecheck` is not clean. The raw Base44 export
  has extensive pre-existing JS/JSDoc and SDK-union typing errors; lint and both
  production builds pass, and the generated Supabase type file validates in
  isolation, but type checking is not yet a trustworthy CI gate.
- The frontend bundle is about 1.56 MB minified (about 415 KB gzip). It works,
  but route-level code splitting should be a performance follow-up.

## Live staging inventory

- Supabase project: `dyowooyijuxghwnwuxcr`
- Cloudflare frontend: https://cedar-student-pilot.dewetluus.workers.dev
- Render workspace: `My Workspace` (`tea-da3jhu3ncjis73cmsas0`)
- Isolated Render API: `cedar-api-staging`
  (`srv-da4h7arbc2fs73b96pjg`), Virginia, free plan, auto-deploying
  `codex/security-and-api-hardening`
- API readiness: https://cedar-api-staging.onrender.com/health/ready
- Latest verified staging commit: `02870e677a303e06dad630e9599d0d3aa093be9e`
- Older API: `cedar-server` (`srv-da451eek1f9s73ampaug`), still deploying
  `main`; it is not the isolated migration target.

## Safety boundary

The live Base44 app, production DNS, and live Stripe webhook have not been
changed. Keep that boundary until the isolated stack passes the complete
new-user staging journey and rollback has been rehearsed.
