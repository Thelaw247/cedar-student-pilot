-- Reconstructed from the verified 2026-08-26 catalog snapshot.
create table public.credit_balances (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id) on delete cascade,
  tier text not null default 'free' check (tier in ('free','student','scholar','unlimited')),
  subscription_credits numeric not null default 0, purchased_credits numeric not null default 0,
  lifetime_granted numeric not null default 0, period_key text, last_grant_date date,
  fair_use_flagged boolean not null default false, applied_credit_operations text[] not null default '{}',
  fulfilled_stripe_anchors text[] not null default '{}', stripe_customer_id text, stripe_subscription_id text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index credit_balances_stripe_customer_idx on public.credit_balances (stripe_customer_id) where stripe_customer_id is not null;
create table public.processed_stripe_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  anchor_id text not null unique,
  kind text not null check (kind in ('subscription_initial','pack','subscription_renewal','tier_sync','downgrade','monthly_grant')),
  stripe_event_id text, stripe_session_id text, credits_granted numeric not null default 0,
  status text check (status in ('complete','failed')), attempt_count integer not null default 0,
  last_error text, completed_at timestamptz, processed_at timestamptz not null default now()
);
create index processed_stripe_events_user_idx on public.processed_stripe_events (user_id);
alter table public.credit_balances enable row level security;
alter table public.processed_stripe_events enable row level security;
create policy "select own balance" on public.credit_balances for select to authenticated using ((select auth.uid()) = user_id);
create policy "select own events" on public.processed_stripe_events for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.credit_balances, public.processed_stripe_events to authenticated;
grant all on public.credit_balances, public.processed_stripe_events to service_role;
