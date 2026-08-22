-- Profiles remain readable by their owner, but client updates are restricted
-- to non-privileged presentation fields. Operational state is server-only.

alter table public.system_state enable row level security;
revoke all privileges on table public.system_state from anon, authenticated;

revoke all privileges on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name, avatar_url) on table public.profiles to authenticated;

drop policy if exists "select own profile" on public.profiles;
drop policy if exists "update own profile" on public.profiles;

create policy "select own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "update own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.profiles (id, role)
  values (new.id, 'user');

  insert into public.credit_balances (
    user_id, tier, subscription_credits, purchased_credits,
    lifetime_granted, period_key, last_grant_date
  )
  values (
    new.id, 'free', 20, 0, 20,
    pg_catalog.to_char(pg_catalog.now(), 'YYYY-MM'), pg_catalog.current_date
  );

  return new;
end;
$function$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;
