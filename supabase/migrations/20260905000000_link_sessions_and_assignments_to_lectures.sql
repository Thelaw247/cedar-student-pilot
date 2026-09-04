-- Let a study session and a deadline say which lectures they are about.
--
-- Everything needed to connect a deadline to its lectures, its sessions and
-- the coverage ledger already existed; almost none of it was joined up. Three
-- gaps, all in the schema:
--
--   1. A session could name ONE lecture (`lecture_id`), and only the
--      auto-generated post-lecture review ever set it. Every assignment prep
--      session -- "Midterm - Session 1..10" -- was booked with no lecture at
--      all, so nothing downstream could say what a session was for.
--   2. A deadline could not name its lectures either. `coverage_scope` has a
--      'custom' value that nothing could act on, because the columns it would
--      have used (lecture_range_start / lecture_range_end) are text, were
--      never written by anything, and were never read by anything.
--   3. Nothing recorded what a student ACTUALLY opened during a session, so
--      "mark the lectures you covered as reviewed" had nowhere to read from.
--
-- Two arrays per session rather than a join table: the codebase already
-- carries lecture and concept sets as uuid[]/text[] (knowledge_coverage,
-- study_session_reviews.lecture_ids, lectures.ai_concepts), and a join table
-- would add a policy, grants, an entity mapping and export/delete wiring for
-- no extra expressiveness.
--
--   lecture_ids         -- what this session is FOR (the plan)
--   opened_lecture_ids  -- what the student actually opened (the record)
--
-- Deliberately NOT constrained as a subset. A student in an unscoped focus
-- session picks lectures freely, so "opened" can legitimately contain
-- material the plan never mentioned, and a CHECK would reject an honest
-- write.
--
-- Additive throughout: new columns default to empty, no column changes
-- meaning, and nothing is dropped. `lecture_id` keeps being written alongside
-- lecture_ids for one release so anything still reading it is unaffected.

alter table public.study_sessions
  add column if not exists lecture_ids uuid[] default '{}'::uuid[] not null,
  add column if not exists opened_lecture_ids uuid[] default '{}'::uuid[] not null;

alter table public.assignments
  add column if not exists lecture_ids uuid[] default '{}'::uuid[] not null;

-- Carry the single-lecture rows forward so the new column is complete from
-- the moment it exists, and the double-booking guard can read it alone.
update public.study_sessions
   set lecture_ids = array[lecture_id]
 where lecture_id is not null
   and cardinality(lecture_ids) = 0;

-- processLectureRecording checks "has this lecture already been booked a
-- review?" on every recording it processes. That lookup moves from the
-- btree on lecture_id to a containment test on lecture_ids.
create index if not exists study_sessions_lecture_ids_idx
  on public.study_sessions using gin (lecture_ids);

comment on column public.study_sessions.lecture_ids is
  'Lectures this session is scheduled to cover. Empty means unscoped (an ad-hoc study block, or a session booked before scoping existed).';
comment on column public.study_sessions.opened_lecture_ids is
  'Lectures the student actually opened during this session. Drives what gets marked reviewed on completion, so it is a subset of lecture_ids in practice but not by constraint -- an unscoped session can open anything.';
comment on column public.assignments.lecture_ids is
  'Explicit lecture list, used only when coverage_scope = ''custom''. For ''cumulative'' and ''since_last'' the covered lectures are derived from dates, so a stored list would go stale the moment another lecture is recorded.';
