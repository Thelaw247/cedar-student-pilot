-- The post-recording spaced-review flow writes session_type = 'review'.
-- Preserve the existing study/project values while matching that live client
-- contract explicitly.

alter table public.study_sessions
  drop constraint if exists study_sessions_session_type_check;

alter table public.study_sessions
  add constraint study_sessions_session_type_check
  check (session_type in ('study', 'project', 'review'));
