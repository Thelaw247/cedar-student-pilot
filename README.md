# Praelecta

AI lecture-recording study companion — [praelecta.ca](https://praelecta.ca). Record a lecture and it comes back as a transcript, a plain-English summary, verified formulas and definitions, flashcards, an exam-coverage map, a study schedule, and review quizzes. Students show up to class; Praelecta does the rest.

> Formerly built on Base44. The app has since been migrated to its own stack (React + Vite on Cloudflare, an Express API on Render, Supabase for data and auth). The legacy Base44 sources are kept under `base44/` for reference only and are not what runs in production.

## The app, stage by stage

1. **Record** — one tap starts recording (after the student confirms they have permission). Runs up to six hours; a phone dying mid-lecture is recovered on next open.
2. **Transcribe & summarize** — audio is transcribed (Groq, with a Deepgram fallback) and a Gemini pass produces the title, summary, key concepts, formulas and "this is on the exam" mentions.
3. **Study page** — a second enrichment pass builds the structured page: concept cards with transcript anchors, formulas verified against the professor's own uploaded materials, worked examples and to-dos.
4. **Exam-coverage map** — every lecture is mapped to what the exam will cover, so a student studies only what will be on it.
5. **Study schedule & sessions** — give it the exam date and it books review sessions; smart rebooking keeps the plan alive when life happens.
6. **Review** — AI reviews, quick quizzes and practice questions turn the material into recall.

Screenshots of each stage are in [`docs/screenshots/`](docs/screenshots/).

## Stack

| Layer | Technology | Hosted on |
| --- | --- | --- |
| Frontend | React 18 + Vite, Tailwind, Radix UI, React Router, TanStack Query | Cloudflare Worker (`wrangler.jsonc`) |
| API | Node + Express (`server/`) | Render (`render.yaml`) |
| Database & auth | Supabase — Postgres + GoTrue, row-level security | Supabase |
| Object storage | Cloudflare R2 (recordings, professor materials) | Cloudflare |
| Payments | Stripe (subscriptions + credit packs) | Stripe |
| Transcription | Groq (primary) → Deepgram (fallback) | — |
| AI | Google Gemini (analysis, enrichment, extraction) | — |
| Transactional email | Resend | — |
| Scheduled jobs | Render cron (monthly credits, study reminders, stuck-lecture reclaim) | Render |

A recording becomes a study page through the pipeline documented in [`docs/LECTURE_INTELLIGENCE.md`](docs/LECTURE_INTELLIGENCE.md). The credit economy (what each AI action costs and why) is in [`docs/MONETIZATION_KIT.md`](docs/MONETIZATION_KIT.md); `shared/tiers.js` holds the display prices and `server/lib/credits.js` is the enforcing authority.

## Repository layout

```
src/          React frontend (pages, components, hooks, lib)
server/       Express API — routes/, lib/, jobs/ (crons), test/
shared/       Code shared by web + API (tiers/pricing, helpers)
supabase/     Postgres schema snapshot + migrations
docs/         Design system, lecture-intelligence, monetization, runbooks
desktop/      Desktop app packaging
mobile/       Mobile app shell
base44/       Legacy Base44 sources (reference only — not in the build)
wrangler.jsonc, render.yaml   Cloudflare + Render deploy config
```

## Local development

**Frontend**

```bash
npm install
npm run dev          # Vite dev server
```

Create `.env.local` in the project root with the client config:

```bash
VITE_BACKEND_MODE=supabase
VITE_SUPABASE_URL=...            # your Supabase project URL
VITE_SUPABASE_ANON_KEY=...       # Supabase anon/publishable key
VITE_RENDER_API_URL=...          # base URL of the Express API
```

**API**

```bash
cd server
npm install
npm start            # node index.js
```

The API reads its config from the environment (never committed). The main ones:

```
DATABASE_URL           Postgres connection (Supabase)
SUPABASE_URL, SUPABASE_ANON_KEY
GROQ_API_KEY           transcription (primary)
GEMINI_API_KEY         analysis / enrichment / extraction
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
RESEND_API_KEY, EMAIL_FROM_ADDRESS
ALLOWED_ORIGINS, APP_ORIGIN
```

See `.env.example` for the full list. Deepgram (transcription fallback) is configured server-side alongside the above.

## Testing

```bash
cd server
npm test             # node --test
```

The suite is the safety net for the credit economy, auth flows, scheduling and the recording pipeline (currently 567 tests).

## Deployment

Pushing to `main` or `codex/security-and-api-hardening` deploys automatically:

- **Frontend** — `.github/workflows/deploy-frontend.yml` builds the app and publishes the Cloudflare Worker.
- **API + crons** — Render auto-deploys the services in `render.yaml` on each commit.

CI (`.github/workflows/ci.yml`) runs lint, type-check and the test suite on pull requests.

## Docs

- [`docs/LECTURE_INTELLIGENCE.md`](docs/LECTURE_INTELLIGENCE.md) — how a recording becomes the study page.
- [`docs/MONETIZATION_KIT.md`](docs/MONETIZATION_KIT.md) — tiers, credits and the paywall.
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) — UI tokens and components.
- [`docs/MIGRATION_AUDIT.md`](docs/MIGRATION_AUDIT.md), [`docs/CUTOVER_RUNBOOK.md`](docs/CUTOVER_RUNBOOK.md) — the Base44 → current-stack migration.
