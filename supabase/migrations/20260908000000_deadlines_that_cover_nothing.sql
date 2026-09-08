-- Two more answers to "which lectures does this deadline cover?".
--
-- The column has carried three since it existed: cumulative (everything up to
-- the due date), since_last (since the previous exam or quiz) and custom (an
-- explicit list). Two real answers had no way to be said.
--
--   none  An assignment or a project usually covers no lectures at all. It
--         is a piece of work, not a claim about material. Until now every one
--         of them was born 'cumulative', which is why a problem set due in
--         November quietly told the scheduler and the handbook that it
--         covered the entire term.
--
--   all   Every lecture in the class, including any taught after the due
--         date -- a take-home, or a comprehensive final sitting before the
--         last week of term. The only way to say this was to tick every box
--         by hand, and that answer went stale the next time the student
--         recorded a lecture.
--
-- Widening a CHECK can never invalidate a row that already exists, so this
-- migration changes no data and nothing already saved behaves differently.
-- Every assignment in the database stays 'cumulative' and keeps resolving to
-- exactly the lectures it resolves to today; the new defaults apply only to
-- deadlines created after this ships.

alter table public.assignments
  drop constraint if exists assignments_coverage_scope_check;

alter table public.assignments
  add constraint assignments_coverage_scope_check
  check (coverage_scope = any (array['cumulative'::text, 'since_last'::text, 'custom'::text, 'all'::text, 'none'::text]));

comment on column public.assignments.coverage_scope is
  'Which lectures this deadline covers. Resolved by shared/assignmentScope.js: cumulative (up to due_date), since_last (since the previous exam or quiz), custom (the explicit lecture_ids list), all (every lecture in the class), none (no lectures -- the default for a new assignment or project).';
