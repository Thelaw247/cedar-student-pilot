-- A deadline Praelecta hears in a lecture becomes a question, not a fact.
--
-- Until now, processLectureRecording found an explicit due-dated item in a
-- transcript and created the assignment outright -- then booked a full set of
-- study sessions for it, free, on any plan. Three things were wrong with that:
--
--  1. Nobody was asked. A professor saying "the essay is due the 14th" while
--     talking about a course the student is not taking, or a date that moved,
--     or a title the model heard as something else, all landed on the
--     calendar as real work.
--  2. It did not behave like an assignment the student typed in. A manual one
--     books nothing on Student (study_schedule is a Scholar feature); an
--     auto-detected one booked a full set. The same deadline behaved
--     differently depending on how it got there, which made the manual case
--     read as broken.
--  3. It could not be undone. The notice that announced it had one button,
--     and that button dismissed the notice, not the assignment.
--
-- The candidates live here instead, on the lecture they came from, and become
-- assignments only through the form a student would have used themselves --
-- coverage confirmed, plan checked, sessions booked or explained. Each entry
-- is { title, type, due_date, decision, assignment_id }, where decision is
-- null while it is still being asked, and 'added' or 'dismissed' once it has
-- been answered. Answered entries are kept: a lecture that gets reprocessed
-- must not resurrect a question the student already said no to.
--
-- Additive, defaulted, and read by nothing that exists today, so no lecture
-- changes and the assignments already created this way are untouched -- they
-- are real assignments with real sessions and stay exactly as they are.

alter table public.lectures
  add column if not exists detected_deadlines jsonb not null default '[]'::jsonb;

comment on column public.lectures.detected_deadlines is
  'Due-dated deliverables heard in this lecture, awaiting the student''s yes or no. [{ title, type, due_date, decision: null|added|dismissed, assignment_id }]. Written by processLectureRecording.js, answered by src/components/DetectedDeadlines.jsx.';
