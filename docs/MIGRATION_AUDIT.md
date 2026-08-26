# Cedar migration audit

Last verified: 2026-08-26 (America/Edmonton)

## Executive status

The parallel stack is solid enough for authenticated staging, but it is **not
ready for cutover**. Base44 remains untouched. All reviewed migration changes
live on `codex/security-and-api-hardening` in draft PR #1.

| Area | Status | Evidence / remaining work |
| --- | --- | --- |
| Supabase database | Ready for staging | 20 public tables; RLS enabled on every table; grants and policies verified against the live project. Client CRUD is user-scoped, privileged tables are read-only or server-only, and the database readiness probe passes. Eight exact post-audit migrations are committed; six older migrations still need a schema-only export. |
| Supabase Auth | Authenticated staging verified | A real user completed signup, email confirmation, password login, profile onboarding, and initial 20-credit provisioning. Apple/Facebook remain hidden until configured; custom SMTP and production-grade recovery delivery still need verification. |
| Express API | Live and infrastructure-ready | `cedar-api-staging` auto-deploys the audit branch. `/health/ready` returns HTTP 200 with independent `database: ok` and `storage: ok` checks. Timetable parsing is live, and semester/class persistence now runs in one validated Postgres transaction with rollback coverage. Groq, Stripe, email, and cron flows still need functional verification. |
| R2 storage | Bucket and credentials verified | The private bucket is reachable from Render with the configured credentials. Presigned recording/avatar upload, confirmation, playback, ownership validation, and lifecycle deletion are implemented. A real signed PUT/confirm/GET round trip still needs an authenticated staging session. |
| Staging frontend | Live on Cloudflare | The Cloudflare Worker static-assets deployment at https://cedar-student-pilot.dewetluus.workers.dev builds in isolated Supabase/Render mode. `/login`, `/register`, and `/forgot-password` load directly with no application console errors. The landing and auth routes no longer depend on the Base44 Vite plugin in this build. |
| Full staging test | In progress | Signup, confirmation, login, profile onboarding, initial credits, `/me`, and timetable parsing have passed with a real staging user. The duplicate-course/date-range defects are fixed. The user's old test semester (1 semester, 64 classes) was deliberately removed on 2026-08-26 while preserving auth, profile, 20 credits, and usage history so the corrected import can be retested cleanly. |
| Cutover | Not started | No Base44 publish, DNS change, live Stripe webhook switch, or production-domain change has occurred. |

## Phase progress

These percentages measure verified migration work, not lines of code. A phase
does not reach 100% until its external staging checks pass.

| Phase | Progress | Remaining gate |
| --- | ---: | --- |
| 0 — Foundations | 100% | Complete for staging. |
| 1 — Supabase data/auth | 90% | Recover the six historical schema migrations; finish auth email/recovery configuration. |
| 2 — Render API | 88% | Verify all provider-backed routes and provision the two prepared cron jobs. |
| 3 — R2 storage | 85% | Complete an authenticated upload/playback/transcription/deletion round trip. |
| 4 — Cloudflare frontend | 96% | Finish route-by-route staging regression. |
| 5 — Full staging | 38% | Timetable re-import plus recording, handbook, subscription, portal, cancellation, and account deletion journeys. |
| 6 — Cutover prep | 5% | Live-mode webhook and production settings remain deliberately inert/unconfigured. |
| 7 — Cutover | 0% | Intentionally untouched until Phases 1–6 pass. |
| 8 — Post-cutover | 0% | Capacitor, Vanta, and Base44 decommissioning follow the stability window. |

## Verified controls

- Supabase security advisor has no RLS-disabled or public security-definer
  findings. The `system_state` notice is intentional: RLS with no client policy
  makes the table server-only. The remaining warning is Auth leaked-password
  protection, which is a dashboard setting.
- Every public table has RLS enabled. `anon` has no access to user tables.
  `authenticated` grants match the intended policy surface, including
  read-only credit, handbook, usage, and Stripe-ledger data.
- The `auth.users` provisioning trigger has been executed in a rollback-only
  smoke test after its date-expression repair. It created the expected owned
  profile and free-tier balance with 20 initial credits, and the transaction
  left no test user or application rows behind.
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
- Repeated timetable rows are consolidated into logical courses by course code
  (or a conservative normalized-name fallback), while distinct lecture, lab,
  tutorial, date-range, and one-off schedules remain separate `meetings` rules.
  Semester plus class persistence is atomic: validation occurs before writes,
  the active-semester switch and every class insert share one transaction, and
  a simulated insert failure proves the transaction rolls back without commit.
- Private R2 references never expose permanent public object URLs. Uploads use
  short-lived signed PUTs, server-confirmed metadata, user-scoped opaque keys,
  and signed GETs.
- Lecture processing accepts only owned `r2://` references. It does not fetch
  arbitrary HTTPS recording URLs or rely on a configurable trusted host.
- Recording capture requests speech-efficient 32 kbps Opus, stops at 90
  minutes, and enforces the same 24 MB ceiling in the browser, signed-upload
  service, R2 confirmation, and transcription route. This stays below Groq's
  25 MB free-tier attachment limit instead of accepting an unusable 200 MB
  object.
- Transcript exports and study reminders now have a real Resend delivery path.
  Transcript recipients are fixed to the caller's verified auth email, dynamic
  HTML is escaped, provider calls carry idempotency keys, daily quota updates
  are atomic, and reminders are marked sent only after provider acceptance.
- Render-ready cron entrypoints exist for the daily idempotent monthly-credit
  recovery sweep and 15-minute reminder sweep. They require HTTPS plus their
  dedicated trigger token and exit non-zero on failure.
- Lecture, class, avatar, and account deletion clean up owned objects. Account
  relational deletion is transactional.
- The prior `processSessionReview` alias bug is fixed: completed reviews are
  ownership-checked, scored deterministically, and persisted atomically.
- A generated `supabase/database.types.ts` snapshot makes remote schema drift
  reviewable in Git even before the six historical DDL exports are recovered.
- The frontend compatibility client covers entity CRUD, Supabase Auth, all 26
  frontend function names, Render routing, and R2 upload flows. This means the
  remaining frontend work is validation and targeted fixes, not 65 independent
  Base44 rewrites.
- Cloudflare mode aliases the shared client, public-settings helper, and legacy
  MCP consent route at build time. Its generated JavaScript no longer contains
  the Base44 SDK/bootstrap client; the default Base44 build remains unchanged.
- Every public and protected page is route-lazy-loaded with an accessible
  suspense fallback. In the isolated build this reduces the initial JavaScript
  from about 1.44 MB/375 KB gzip to about 528 KB/155 KB gzip; analytics charting
  and each feature page load only when visited.
- CI checks all 26 frontend function names against Express mounts. Both the
  default Base44-mode build and the Cloudflare-mode build pass; ESLint passes.
  The server suite currently passes 40/40 tests locally. The 2026-08-26 GitHub
  Git-data write did not emit a new Actions run, so remote CI evidence remains
  at the prior successful commit even though the equivalent local gates pass.

## Known gaps and risks

### Blocking full staging verification

1. Re-import the same timetable after the atomic-import frontend deploys. Verify
   the expected logical course count, inspect flexible lecture/lab date rules,
   then confirm Today and weekly-calendar behavior on representative dates.
2. In Supabase Auth, verify the staging site URL and allowed redirects include
   the Cloudflare origin and `/reset-password`. Verify signup/recovery email
   delivery and templates. Enable leaked-password protection if the project is
   on Supabase Pro or above; Supabase does not offer it on the Free plan.
3. Functionally verify remaining provider secrets on `cedar-api-staging`:
   `GEMINI_API_KEY`, `GROQ_API_KEY`, Stripe **test-mode** keys/webhook secret,
   `RESEND_API_KEY`/verified sender, and cron/trigger tokens. Database and R2
   connectivity are already verified without exposing their secret values.
4. Complete a real recording R2 signed PUT, upload confirmation, signed
   GET/playback, transcription, and cleanup cycle through the authenticated app.
5. Configure Render's service health-check path as `/health/ready`. The endpoint
   is live and green, but the service currently has no Dashboard health path.

### Before production

- The deliberate 90-minute/24 MB recording policy is production-safe but means
  longer classes must be saved as multiple lecture sections. True seamless
  multi-part recording can be added later without blocking staging.
- `sendStudyReminders` and transcript email mode now use Resend but fail closed
  until a verified sender and `RESEND_API_KEY` are configured.
- `academicAIChat` remains disabled by its feature flag, matching its withdrawn
  Base44 state.
- Provision and verify the two prepared Render Cron Jobs. Render charges a
  $1/month minimum per cron service, so creation remains a dashboard/account
  decision rather than an implicit code deployment.
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
- The shared initial frontend chunk remains about 528 KB minified (155 KB
  gzip), slightly above Vite's generic 500 KB warning but less than half its
  prior transfer size. Further vendor splitting is optional performance work,
  not a staging blocker.
- A non-breaking `npm audit fix` plus removal of the unused legacy
  React Quill/Quill 1 dependency reduces the frontend report from 21 findings
  (12 high) to two moderate React Router 6 advisories. The remaining fix is a
  React Router 7 migration that needs dedicated regression testing rather than
  a blind `--force` update. Current redirect targets are fixed internal routes,
  and the one query-derived post-login target is normalized by `safeReturnTo()`.

## Live staging inventory

- Supabase project: `dyowooyijuxghwnwuxcr`
- Cloudflare frontend: https://cedar-student-pilot.dewetluus.workers.dev
- Render workspace: `My Workspace` (`tea-da3jhu3ncjis73cmsas0`)
- Isolated Render API: `cedar-api-staging`
  (`srv-da4h7arbc2fs73b96pjg`), Virginia, free plan, auto-deploying
  `codex/security-and-api-hardening`
- API readiness: https://cedar-api-staging.onrender.com/health/ready
- Deployment source: the head of `codex/security-and-api-hardening` (draft PR #1)
- Older API: `cedar-server` (`srv-da451eek1f9s73ampaug`), still deploying
  `main`; it is not the isolated migration target.

## Safety boundary

The live Base44 app, production DNS, and live Stripe webhook have not been
changed. Keep that boundary until the isolated stack passes the complete
new-user staging journey and rollback has been rehearsed.
