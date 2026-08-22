# Cedar API

The Express API is deployed independently from the frontend. It must never
receive a Supabase service-role key in browser-facing code.

## Runtime

- Node version: see the repository's `.node-version`.
- Install: `npm ci --prefix server`
- Start: `npm start --prefix server`
- Test: `npm test --prefix server`
- Health check: `GET /health`

## Required environment variables

- `DATABASE_URL`: Supabase Postgres connection string used only by Render.
- `SUPABASE_URL`: Supabase project URL.
- `SUPABASE_ANON_KEY`: publishable/anon key used to validate user sessions.
- `ALLOWED_ORIGINS`: comma-separated exact frontend origins. Production has
  no permissive default.

Feature routes additionally fail closed when their provider-specific variables
are absent, including Stripe, LLM, email, cron, and recording-host settings.
Copy those values through the Render Dashboard; do not commit them.

## Deployment safety

Configure Render's health-check path as `/health`. Keep staging and production
origins explicit in `ALLOWED_ORIGINS`. Cross-origin requests from any other
browser origin receive HTTP 403.
