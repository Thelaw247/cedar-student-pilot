# Cedar migration audit

Last verified: 2026-08-27 (America/Edmonton)

## Executive status

The parallel stack is solid enough for authenticated staging, but it is **not
ready for cutover**. Base44 remains untouched. All reviewed migration changes
live on `codex/security-and-api-hardening` in draft PR #1.

| Area | Status | Evidence / remaining work |
| --- | --- | --- |
| Supabase database | Ready for staging | 20 public tables; RLS enabled on every table; grants and policies verified against the live project. Client CRUD is user-scoped, privileged tables are read-only or server-only, and the database readiness probe passes. Every recorded migration is now present in Git. The six historical migrations were reconstructed from the verified catalog and the later ALTER history, then executed in order in a rollback-only verification schema. |
| Supabase Auth | Authenticated staging verified | A real user completed signup, email confirmation, password login, profile onboarding, and initial 20-credit provisioning. Apple/Facebook remain hidden until configured; custom SMTP and production-grade recovery delivery still need verification. |
| Express API | Live and functionally verified for core flows | `cedar-api-staging` auto-deploys the audit branch. `/health/ready` returns HTTP 200 with independent `database: ok` and `storage: ok` checks and is set as the Render health-check path. Groq and Gemini keys are verified live. A Stripe test-mode one-time purchase completed end-to-end: webhook delivered and fulfilled, exactly 100 credits granted once, and the redirect-side confirm path proved idempotent against double-granting. Lecture processing now runs asynchronously (details below) and was verified with a real recording. Email (Resend) and the two paid cron jobs still need functional verification. |
| R2 storage | Round trip verified | The private bucket is reachable from Render with the configured credentials. A real authenticated round trip passed for both flows: avatar signed PUT/confirm/signed GET/replace/remove, and a browser lecture recording uploaded, confirmed, fetched server-side, and transcribed. Getting there surfaced and fixed three real defects: the bucket needed a CORS policy for the Worker origin, the AWS SDK's default checksum broke presigned browser PUTs (`requestChecksumCalculation: 'WHEN_REQUIRED'`), and unsigned `x-amz-meta-*` headers caused signature mismatches (`unhoistableHeaders`). |
| Staging frontend | Live on Cloudflare | The Cloudflare Worker static-assets deployment at https://cedar-student-pilot.dewetluus.workers.dev builds in isolated Supabase/Render mode. `/login`, `/register`, and `/forgot-password` load directly with no application console errors. The landing and auth routes no longer depend on the Base44 Vite plugin in this build. |
| Full staging test | In progress | Signup, confirmation, login, profile onboarding, initial credits, `/me`, Gemini timetable parsing, atomic persistence, and schedule reconciliation have passed with a real staging user, and the saved semester matches Banner (13 logical courses, 22 sections, 73 rules). The complete recording journey has now also passed: browser capture, segmented R2 upload, duration verification from the stored WebM, asynchronous Groq transcription and Gemini analysis, exactly-once billing, and in-page status updates. Remaining journeys: AI study features, subscription lifecycle (checkout/renewal/portal/cancel), a multi-hour segmented recording, and account deletion. |
| Cutover | Not started | No Base44 publish, DNS change, live Stripe webhook switch, or production-domain change has occurred. |

## Phase progress

These percentages measure verified migration work, not lines of code. A phase
does not reach 100% until its external staging checks pass.

| Phase | Progress | Remaining gate |
| --- | ---: | --- |
| 0 — Foundations | 100% | Complete for staging. |
| 1 — Supabase data/auth | 97% | Finish auth email/recovery configuration and the plan-dependent leaked-password setting. |
| 2 — Render API | 97% | Groq, Gemini, and Stripe test mode are functionally verified and the Dashboard health path is set. Remaining: verify Resend once a sender domain is chosen, and explicitly provision the two prepared paid cron jobs. |
| 3 — R2 storage | 100% | Authenticated avatar and recording round trips verified, including transcription of the stored object. |
| 4 — Cloudflare frontend | 99% | Measure Core Web Vitals once Chrome DevTools tracing is connected; authenticated feature regression continues in Phase 5. |
| 5 — Full staging | 65% | Timetable import, one-time credit purchase, avatar storage, and the full recording/transcription journey are verified; AI study features, subscription lifecycle, multi-hour recording, and account deletion journeys remain. |
| 6 — Cutover prep | 20% | A fail-safe cutover/rollback runbook is committed; rehearsal, final mappings, production resources, and owner approval remain. |
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
- Stripe mode is explicit and fail-closed: staging requires
  `STRIPE_EXPECTED_MODE=test`; a live key or live webhook event is rejected
  before checkout or fulfillment.
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
- A 42 KB schema-only live-catalog snapshot captures all 20 tables plus
  constraints, indexes, RLS, policies, grants, functions, and triggers without
  user rows or secrets. The six pre-repository migration files were reconstructed
  from that evidence and the later ALTER history. The complete ordered migration
  set executed successfully under an isolated rollback-only schema, including
  the later course-code and recording-parts additions, and left no verification
  objects behind.
- The Banner reconciliation verified all 13 course codes, 22 registered
  lecture/lab sections, and 73 expanded meeting rules. A page-spanning GE 102
  instructor continuation was corrected. Rule-based schedules no longer let a
  lab's room leak into NO_ROOM lectures; legacy manual classes retain their
  default-room fallback.
- Provider diagnostics now require both a valid session and a database-backed
  admin role, and no longer return API-key fingerprints. The same reusable
  server-side admin middleware protects owner analytics.
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
  default Base44-mode build and the Cloudflare-mode build pass; ESLint and the
  full Cedar-source JavaScript typecheck pass. CI now enforces typechecking and
  high-severity dependency audits for both packages. Generated UI primitives
  are excluded unless imported; every imported primitive remains checked.
  The server suite passes 49/49 tests locally, including a fail-closed inventory
  of all 38 protected API paths. Frontend and server dependency audits report
  zero known vulnerabilities after the pinned React Router 7 upgrade.

- Lecture processing is asynchronous. The processing endpoint performs only
  ownership, replay, and credit checks, atomically claims the lecture with a
  conditional `UPDATE` (double submits cannot start two pipelines; a
  `processing` row untouched for 15 minutes, or never touched at all, is
  treated as abandoned and reclaimable), answers `202 Accepted`, and runs the
  transcribe/analyze/bill pipeline in the background. Failures release the
  lecture back to `pending`, the lecture page polls while processing and
  offers a "Process recording" retry for any pending recording, so no
  recording can be stranded and no browser request outlives a long lecture.
- Browser recordings are streamed WebM with no header Duration element, so
  billing duration is measured server-side by a small EBML reader over the
  stored object's cluster/block timestamps (accurate to ~21 ms against ffmpeg
  fixtures; empty or non-WebM input fails closed).
- Every outbound provider call — Groq, Gemini (both call sites), Stripe,
  Resend, R2 object fetches, and the Supabase auth check — carries an explicit
  `AbortSignal.timeout`, because Node's `fetch` never times out on its own and
  a hung provider socket previously stranded a recording invisibly.
- Deployment is fully automatic from a push to the deployment branch: Render
  auto-deploys the API, and a GitHub Actions workflow
  (`.github/workflows/deploy-frontend.yml`) builds the Cloudflare-mode bundle
  and publishes the Worker using repository-secret Cloudflare credentials.

## Known gaps and risks

### Blocking full staging verification

1. The corrected timetable import is complete and reconciled against Banner.
   Perform an authenticated visual check of Today and weekly-calendar behavior
   on representative irregular dates.
2. In Supabase Auth, verify the staging site URL and allowed redirects include
   the Cloudflare origin and `/reset-password`. Verify signup/recovery email
   delivery and templates. Enable leaked-password protection if the project is
   on Supabase Pro or above; Supabase does not offer it on the Free plan.
3. Gemini, Groq, and the Stripe test-mode keys/webhook secret are now
   functionally verified live. Still to verify: `RESEND_API_KEY` with a
   verified sender (deliberately deferred until the owner picks a domain) and
   the cron trigger tokens once the cron jobs are provisioned.
4. Done: a real recording completed the full R2 signed PUT, confirmation,
   server-side fetch, transcription, and analysis cycle through the
   authenticated app, and the avatar flow passed upload/replace/remove.
5. Done: Render's service health-check path is `/health/ready`.
6. The verified recording run produced zero auto-generated flashcards despite
   extracted concepts; the failure was swallowed by a silent catch, which now
   logs. Watch the next recording's logs; on-demand generation from the
   Practice tab is the fallback either way.

### Before production

- Recordings now auto-split into ordered 90-minute/24 MB segments (see
  `recording_parts` on `lectures`) so a single recording session can run up to
  a 6-hour absolute ceiling without the student manually starting a new lecture
  section. The MediaRecorder segment-rotation logic (client-side) has not yet
  been exercised in a real browser — a live multi-hour staging test is needed
  before trusting it for a production-length lecture.
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
- Add integration/E2E coverage against the real staging services. Current
  automated tests cover unit and HTTP boundaries plus builds, not the complete
  browser journey.
- A validated `render.yaml` now documents the existing staging web service,
  `/health/ready`, build filters, complete secret inventory, and both prepared
  cron services. It is not connected or synced, so it has not changed live
  infrastructure or incurred cron charges. Official Render CLI schema validation
  remains unavailable in this workspace; YAML parsing and secret-policy checks pass.
- The shared initial frontend chunk remains about 528 KB minified (155 KB
  gzip), slightly above Vite's generic 500 KB warning but less than half its
  prior transfer size. Further vendor splitting is optional performance work,
  not a staging blocker.
- The React Router 6 advisories are closed by the pinned React Router 7 upgrade.
  Existing declarative `react-router-dom` imports remain supported, both builds
  pass, public direct-load and protected redirect routes pass in the deployed
  browser, and `npm audit` now reports zero vulnerabilities.

## Cutover preparation

- `docs/CUTOVER_RUNBOOK.md` now defines same-SHA entry gates, preservation
  snapshots, ordered traffic switching, blocking smoke tests, abort criteria,
  data-aware rollback, and the stability/decommission window. Every production
  action remains unchecked and requires explicit owner approval.

## Live staging inventory

- Supabase project: `dyowooyijuxghwnwuxcr`
- Cloudflare frontend: https://cedar-student-pilot.dewetluus.workers.dev
- Render workspace: `My Workspace` (`tea-da3jhu3ncjis73cmsas0`)
- Isolated Render API: `cedar-api-staging`
  (`srv-da4h7arbc2fs73b96pjg`), Virginia, free plan, auto-deploying
  `codex/security-and-api-hardening`
- API readiness: https://cedar-api-staging.onrender.com/health/ready
- Deployment source: the head of `codex/security-and-api-hardening` (draft PR #1)
- Frontend deploys: GitHub Actions `Deploy frontend` workflow on every push to
  the deployment branch (Cloudflare credentials held as repository secrets)
- Older API: `cedar-server` (`srv-da451eek1f9s73ampaug`), still deploying
  `main`; it is not the isolated migration target.

## Safety boundary

The live Base44 app, production DNS, and live Stripe webhook have not been
changed. Keep that boundary until the isolated stack passes the complete
new-user staging journey and rollback has been rehearsed.

## Verification pass — Aug 28, 2026 (post-UI-redesign)

Automated checks run against the live staging stack:

**Server health (Render, srv-da4h7arbc2fs73b96pjg)** — clean. No error-level
logs and no `[recording] flashcard generation failed` lines since Aug 27.
All redesign deploys (757477b → 5dde2d5) built and went live; health check
`/health/ready` is configured and passing. The free instance spun down and
cold-started at 13:00 UTC — expected on the free plan, and the reason the
cutover checklist upgrades the instance before launch.

**Supabase advisors (dyowooyijuxghwnwuxcr)** —
- WARN: leaked-password protection is disabled. One toggle in the dashboard
  (Auth → Passwords → "Prevent use of leaked passwords"). Recommended before
  launch; cannot be flipped via SQL/API from here. → OWNER ACTION
- INFO: `system_state` has RLS enabled with no policies. Intentional — the
  table is service-role-only, and no-policy RLS is deny-all for clients.
- INFO: five unused indexes (classes_user_idx etc.). Kept deliberately: the
  database is near-empty and these are the exact indexes production query
  patterns will use.

**Stripe (test mode, acct_1ToUnnRecX8K7mfK)** — active catalog matches
src/lib/tiers.js exactly: Student $9.99/$31.99, Scholar $16.99/$54.99,
Unlimited $29.99/$95.99 CAD (semester = 4-month interval), packs 100/$6.99,
250/$14.99, 500/$27.99; superseded prices archived with metadata. Webhook
endpoint enabled at cedar-api-staging.onrender.com/stripe/webhook with the
full event set (checkout completed/async, invoice paid/succeeded/failed,
subscription updated/deleted).

**Frontend (Cloudflare Worker)** — serving the app shell with correct title
and icons at cedar-student-pilot.dewetluus.workers.dev.

### Remaining items that need a human
1. Subscription lifecycle: FULLY VERIFIED Aug 28 with real traffic.
   Checkout -> webhook grant -> persistence across sessions -> billing
   portal (after the fixes below) -> cancel scheduled at period end ->
   subscription.deleted fired via API -> server downgraded within seconds:
   tier student->free, subscription_credits zeroed, purchased credits
   (100) preserved untouched, stripe_subscription_id cleared. The
   no-clawback rule held. Portal settings were saved in TEST mode by the
   owner; the same save is still required in LIVE mode at cutover. De Wet
   subscribed to Student (test mode) and it persisted across sessions;
   cross-checked Stripe <-> Supabase: active sub with user_id metadata,
   matching stripe_subscription_id/customer_id on the credit row, tier
   'student', 200/mo grant + 100-credit pack both landed, checkout-session
   anchors recorded (idempotent). STILL OPEN: billing portal -> cancel ->
   webhook downgrade to free at period end (deliberately not exercised
   against his live test subscription without his go-ahead).
   UPDATE (later Aug 28): "Manage billing" was actually broken for all
   subscribers — two independent causes, one fixed, one owner action:
   (a) FIXED (commit df863ea): billing-portal sessions accept no metadata
   parameter; the Base44-era 'metadata[base44_app_id]' made Stripe 400
   every request. Client error copy no longer masks server errors.
   (b) OWNER ACTION: the Stripe TEST-mode account has no saved customer
   portal configuration, so portal sessions are refused until one exists.
   One click: dashboard.stripe.com/test/settings/billing/portal -> Save.
   (The MCP key lacks permission to create it via API.) Must be REPEATED
   IN LIVE MODE at cutover — added to the cutover list.
2. Env-group duplicate cleanup: Render's API does not expose env-var reads;
   verify in the dashboard that the service and env group don't define the
   same keys twice. Functionally harmless today (the service boots and runs).
3. Leaked-password protection toggle (above).
4. Long-recording field test (>90 min, segment rotation) during a real class.
5. Account deletion end-to-end on a throwaway account (never the admin one).
6. Cutover: paid Render instance, Stripe live keys + live webhook, LIVE-mode
   customer portal settings saved (see item 1b), domain + Resend (pending
   SEO research), the two cron jobs (approval pending), and the rehearsal
   itself.
7. Phase D decisions: paywall analytics events; RevenueCat + Apple IAP
   timing (launch-blocking for the iOS build).

## Phase D progress — Aug 28, 2026 (evening)

Paywall funnel analytics SHIPPED, first-party only: `product_events` table
(deny-all RLS, service-role writes — the advisors' "RLS enabled no policy"
INFO on it is intentional, same as system_state), `trackEvent` route with a
server-side event whitelist and scalar-only meta sanitizer, fire-and-forget
`lib/analytics.js` on the client (telemetry can never block or break UI),
and instrumentation across the funnel: onboarding paywall viewed → exit
offer shown → exit-Scholar clicked / continue-free, upgrade sheet opened
(source + feature), checkout started (tier/period/source), feature lock
taps. ownerAnalytics now returns `paywall_funnel` (30-day counts + unique
users per event) for the owner dashboard.

Phase D remaining: RevenueCat + Apple IAP — a decision + accounts, blocking
only the iOS App Store build (web launch proceeds without it).

## Recording failures — Sep 1, 2026 (first real lectures)

Two real lectures on the first day of use failed to process, and the failures were more instructive than any staging test. What happened, in order, and what changed:

| Symptom | Actual cause | Fix |
|---|---|---|
| "Couldn't save the recording — Failed to fetch" on a 90-minute lecture | R2 bucket CORS only allowed the Worker origin, so the browser's direct PUT to the presigned URL was blocked. Render request logs are not captured on this service, so "no requests in the logs" was never evidence of anything. | Bucket CORS updated by hand to include `https://praelecta.ca`. |
| A 44-minute lecture saved as 3 h 14 min and rejected by Groq three times with "seconds of audio per hour (ASPH): Limit 7200" | The laptop slept mid-lecture. MediaRecorder stamps clusters from the wall clock, so the stored WebM *decoded* as 11,644 s with a hole in it; the server measured that honestly and billed on it, and Groq counted the decoded seconds against its hourly quota, so the file could never go through on the on-demand tier. "Try again" then spent more of that quota. | `closeWebmTimestampGaps` (server/lib/webmDuration.js) closes holes > 2 s in place before measuring or transcribing. Client clock now pauses while the mic track is muted/ended and the saved duration is bounded by bytes actually captured. |
| The only exit was "Try again", which blocked the next lecture | The island had one failure state and no way to free the session while keeping the upload. | `shared/saveErrors.js` classifies the failure (rate limit / credits / too large / network / unknown). Rate limit and credits lead with **Process later**, which frees the session and deletes nothing; the lecture stays `pending` with its audio and is marked "Not processed yet" in lists, with the retry on its detail page. |
| Background failures all read "Processing didn't finish" | The pipeline runs after a 202 and only `status` was polled; the reason never left the server log. | New `lectures.processing_error` column (migration `20260901200000`, applied live). `releaseLecture` writes a student-readable reason, `claimLecture` clears it, the island classifies on it and the lecture page shows "Last attempt: …". |
| Discard deleted a 90-minute recording with no confirmation | — | Two-step confirmation naming the duration and what will be deleted. |
| `flashcard generation failed: null value in column "back"` on both complete lectures | Gemini returned a card without a back; the schema did not mark the fields required and one bad card aborted the batch. | `required: ['front','back']` in both flashcard schemas; `usableFlashcards` drops incomplete cards instead of failing the batch. |
| `Gemini 503 … high demand` failed a whole lecture at 16:00 UTC | No retry at all on a provider-side overload. | `invokeLLM` retries a 503/429 on the same model (2 s, 5 s) and then falls through to the next model in the chain for that call only. |

Tests: `server/test/save-errors.test.js`, `llm-resilience.test.js`, `webmDuration.test.js` (gap cases). The schema snapshot (`supabase/schema_snapshot.sql`) predates `recording_parts` and `processing_error`; regenerate it before relying on it for anything but the status constraint.
