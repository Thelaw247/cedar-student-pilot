-- First-party paywall/funnel analytics (MON-04 Phase D, Aug 2026).
-- Event names + tiny structured meta only — no content, no free text from
-- users. Service-role only: RLS enabled with no policies (deny-all for
-- clients), same pattern as system_state; the API writes via trackEvent
-- with a server-side whitelist and reads via ownerAnalytics (admin).

create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists product_events_event_time_idx
  on public.product_events (event, created_at desc);
create index if not exists product_events_user_idx
  on public.product_events (user_id);

alter table public.product_events enable row level security;

comment on table public.product_events is
  'Paywall/funnel telemetry: whitelisted event names + minimal meta. Deny-all RLS; service-role access only.';
