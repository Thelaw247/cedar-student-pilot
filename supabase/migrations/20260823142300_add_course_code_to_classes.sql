-- Stable course identity for timetable consolidation. Nullable keeps every
-- existing/manual class backward-compatible when no catalog code is known.
alter table public.classes
  add column if not exists course_code text;

comment on column public.classes.course_code is
  'University catalog code used to consolidate repeated timetable schedule rows into one logical course.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'classes_course_code_length'
      and conrelid = 'public.classes'::regclass
  ) then
    alter table public.classes
      add constraint classes_course_code_length
      check (course_code is null or char_length(course_code) <= 40);
  end if;
end $$;
