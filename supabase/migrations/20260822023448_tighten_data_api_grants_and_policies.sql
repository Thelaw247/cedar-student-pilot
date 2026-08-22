-- Remove broad default API grants and make every client policy explicit.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'assignments',
    'calendar_events',
    'class_attendance',
    'classes',
    'custom_tracks',
    'flashcards',
    'knowledge_coverage',
    'lectures',
    'notes',
    'practice_questions',
    'semesters',
    'study_records',
    'study_session_reviews',
    'study_sessions'
  ]
  loop
    execute format('revoke all privileges on table public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    execute format('drop policy if exists "owner all" on public.%I', table_name);
    execute format(
      'create policy "select own rows" on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      table_name
    );
    execute format(
      'create policy "insert own rows" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      table_name
    );
    execute format(
      'create policy "update own rows" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      table_name
    );
    execute format(
      'create policy "delete own rows" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      table_name
    );
  end loop;

  foreach table_name in array array[
    'credit_balances',
    'handbooks',
    'processed_stripe_events',
    'usage_events'
  ]
  loop
    execute format('revoke all privileges on table public.%I from anon, authenticated', table_name);
    execute format('grant select on table public.%I to authenticated', table_name);
  end loop;
end
$$;

drop policy if exists "select own balance" on public.credit_balances;
create policy "select own balance"
on public.credit_balances for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "select own handbooks" on public.handbooks;
create policy "select own handbooks"
on public.handbooks for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "select own events" on public.processed_stripe_events;
create policy "select own events"
on public.processed_stripe_events for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "select own usage" on public.usage_events;
create policy "select own usage"
on public.usage_events for select to authenticated
using ((select auth.uid()) = user_id);
