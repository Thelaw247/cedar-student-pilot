-- The free grant covers two full lectures of up to 90 minutes each.
--
-- Processing costs 5 credits per started 30 minutes (server/lib/credits.js).
-- At 20 free credits, "two full lectures free" only held for lectures of an
-- hour or less, while the median lecture recorded so far runs 72 minutes:
-- most new students could record one. 30 credits covers two lectures of up
-- to 90 minutes (15 + 15), which is 54 of the first 60 recorded.
--
-- 1. New accounts: handle_new_user() grants 30. Same body as
--    20260823000817_fix_signup_provisioning.sql apart from the amount.
-- 2. Existing free accounts that only ever had the original grant get the
--    missing 10, so the promise holds for them too. Accounts that were ever
--    on a paid plan (lifetime_granted above 20) are left alone; they were
--    granted more than this already.

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
    new.id, 'free', 30, 0, 30,
    pg_catalog.to_char(pg_catalog.now(), 'YYYY-MM'),
    pg_catalog.now()::date
  );

  return new;
end;
$function$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;

update public.credit_balances
   set subscription_credits = subscription_credits + 10,
       lifetime_granted = lifetime_granted + 10
 where tier = 'free'
   and lifetime_granted = 20;
