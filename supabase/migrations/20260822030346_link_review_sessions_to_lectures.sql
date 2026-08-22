-- Auto-scheduled post-recording reviews retain the lecture they belong to.

alter table public.study_sessions
  add column if not exists lecture_id uuid
  references public.lectures(id) on delete cascade;

create index if not exists study_sessions_lecture_idx
  on public.study_sessions (lecture_id);
