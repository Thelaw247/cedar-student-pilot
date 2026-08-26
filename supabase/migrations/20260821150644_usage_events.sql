-- Reconstructed provider-cost and credit-usage audit ledger.
create table public.usage_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null, provider text, model text, call_count numeric not null default 0,
  base44_credits numeric not null default 0, input_tokens numeric not null default 0, output_tokens numeric not null default 0,
  cedar_credits_charged numeric not null default 0, credit_operation_id text, cost_cad numeric not null default 0,
  tier_at_time text, latency_ms numeric not null default 0, lecture_id uuid, audio_seconds numeric not null default 0,
  success boolean not null default true, occurred_at timestamptz not null default now()
);
create index usage_events_user_idx on public.usage_events (user_id);
create index usage_events_occurred_idx on public.usage_events (occurred_at);
alter table public.usage_events enable row level security;
create policy "select own usage" on public.usage_events for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.usage_events to authenticated;
grant all on public.usage_events to service_role;
