-- Base44 supplied created_date/updated_date on every entity automatically.
-- The Supabase compatibility client maps those names to created_at/updated_at,
-- so user-owned CRUD tables need the same lifecycle metadata.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'semesters', 'classes', 'lectures', 'assignments', 'notes',
    'study_sessions', 'study_records', 'calendar_events', 'class_attendance',
    'knowledge_coverage', 'flashcards', 'practice_questions',
    'study_session_reviews', 'custom_tracks'
  ]
  loop
    execute format(
      'alter table public.%I add column if not exists created_at timestamptz not null default now(), add column if not exists updated_at timestamptz not null default now()',
      table_name
    );
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name
    );
  end loop;
end;
$$;
