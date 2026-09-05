-- One knowledge_coverage row per lecture, per student.
--
-- The two writers that exist today (InLectureQuiz, HandbookReader) both do
-- read-then-write from the browser: filter by lecture_id, then update the row
-- they found or create one. Two tabs, or one tab and a slow network, and both
-- take the "create" branch. The live database already contains a pair of rows
-- for the same lecture, one a strict subset of the other -- the race has
-- happened, on a real account.
--
-- Phase 5 makes every completed study session write coverage, which turns an
-- occasional race into a routine one, so the duplicate has to stop being
-- possible before the traffic arrives rather than after.
--
-- MERGE, NOT DELETE. Duplicates are repeat writes of the same events, not
-- independent histories, so the surviving row takes:
--   concepts_seen / concepts_mastered  the union -- a superset of every copy,
--                                      so no concept a student earned is lost
--   last_reviewed_date                 the latest
--   sessions_reviewed                  the max, not the sum: the copies double
--                                      counted the same sittings
--   proficiency                        recomputed from the merged arrays,
--                                      which is what every writer stores
-- Only then are the now-redundant copies removed.

with dupes as (
  select user_id,
         lecture_id,
         -- Postgres has no min(uuid); ordering the aggregate is the
         -- deterministic equivalent, and which copy survives does not matter
         -- because every column on it is overwritten below.
         (array_agg(id order by id::text))[1] as keep_id,
         max(last_reviewed_date) as reviewed,
         max(sessions_reviewed) as sessions
  from public.knowledge_coverage
  where lecture_id is not null
  group by user_id, lecture_id
  having count(*) > 1
), merged as (
  -- Correlated rather than array_agg(concepts_seen): aggregating arrays of
  -- different lengths raises "cannot accumulate arrays of different
  -- dimensionality", and different lengths is exactly what a duplicate is.
  select d.keep_id,
         d.reviewed,
         d.sessions,
         coalesce((select array_agg(distinct c)
                   from public.knowledge_coverage k, unnest(k.concepts_seen) c
                   where k.user_id = d.user_id and k.lecture_id = d.lecture_id), '{}') as seen,
         coalesce((select array_agg(distinct c)
                   from public.knowledge_coverage k, unnest(k.concepts_mastered) c
                   where k.user_id = d.user_id and k.lecture_id = d.lecture_id), '{}') as mastered
  from dupes d
)
update public.knowledge_coverage kc
set concepts_seen = m.seen,
    concepts_mastered = m.mastered,
    last_reviewed_date = m.reviewed,
    sessions_reviewed = m.sessions,
    proficiency = case
      when cardinality(m.seen) = 0 then 0
      else round((cardinality(m.mastered)::numeric / cardinality(m.seen)) * 100)
    end
from merged m
where kc.id = m.keep_id;

delete from public.knowledge_coverage kc
using (
  select user_id, lecture_id, (array_agg(id order by id::text))[1] as keep_id
  from public.knowledge_coverage
  where lecture_id is not null
  group by user_id, lecture_id
  having count(*) > 1
) g
where kc.user_id = g.user_id
  and kc.lecture_id = g.lecture_id
  and kc.id <> g.keep_id;

-- The key the upsert conflicts on. Partial, because a coverage row with no
-- lecture_id is class-level and there is nothing to deduplicate it against.
create unique index if not exists knowledge_coverage_user_lecture_key
  on public.knowledge_coverage (user_id, lecture_id)
  where lecture_id is not null;

comment on index public.knowledge_coverage_user_lecture_key is
  'One coverage row per student per lecture. The conflict target for server/lib/knowledgeCoverage.js.';
