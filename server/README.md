# Cedar API

The Express API is deployed independently from the frontend. It must never
receive a Supabase service-role key in browser-facing code.

## Runtime

- Node version: see the repository's `.node-version`.
- Install: `npm ci --prefix server`
- Start: `npm start --prefix server`
- Test: `npm test --prefix server`
- Liveness check: `GET /health`
- Deployment readiness check: `GET /health/ready` (database and R2 included).

## Required environment variables

- `DATABASE_URL`: Supabase Postgres connection string used only by Render.
- `SUPABASE_URL`: Supabase project URL.
- `SUPABASE_ANON_KEY`: publishable/anon key used to validate user sessions.
- `ALLOWED_ORIGINS`: comma-separated exact frontend origins. Production has
  no permissive default.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and
  `R2_BUCKET_NAME`: least-privilege R2 object credentials and private bucket.

Feature routes additionally fail closed when their provider-specific variables
are absent, including Stripe, LLM, email, cron, and recording-host settings.
Copy those values through the Render Dashboard; do not commit them.

Complete runtime inventory (some are feature-specific):

- AI: `GEMINI_API_KEY`, `GROQ_API_KEY`, `ACADEMIC_CHAT_ENABLED`.
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CEDAR_APP_ID`, and
  mandatory `STRIPE_EXPECTED_MODE` (`test` on staging, `live` only at cutover).
- Scheduled jobs: `GRANT_TRIGGER_TOKEN`, `REMINDERS_TRIGGER_TOKEN`.
- Email/origins: `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `APP_ORIGIN`, and
  `REMINDERS_TIME_ZONE` (defaults to `America/Regina` for the staging pilot).
- Legacy recording compatibility only: `TRUSTED_RECORDING_HOST`. New R2
recordings use stable private `r2://` references and do not need this value.

## Render cron commands

Both jobs call the isolated API over HTTPS and exit non-zero on failure. Give
each cron `CEDAR_API_URL=https://cedar-api-staging.onrender.com` plus only its
matching trigger token (prefer the same linked environment group as the API):

- Monthly-credit recovery sweep: `npm run cron:monthly-credits --prefix server`
  on `15 6 * * *` (daily; per-account period keys make grants idempotent).
- Study reminders: `npm run cron:study-reminders --prefix server` on
  `*/15 * * * *`. `REMINDERS_TIME_ZONE` controls the schedule interpretation.

## Deployment safety

Configure Render's health-check path as `/health/ready`. Keep staging and production
origins explicit in `ALLOWED_ORIGINS`. Cross-origin requests from any other
browser origin receive HTTP 403.
