-- Fix signup provisioning after the hardened trigger set an empty search path.
-- CURRENT_DATE is SQL syntax, not a pg_catalog relation that can be qualified.
-- Casting pg_catalog.now() keeps the function explicit and valid with search_path=''.

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
    pg_catalog.to_char(pg_catalog.now(), 'YYYY-MM'),
    pg_catalog.now()::date
  );

  return new;
end;
$function$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;
