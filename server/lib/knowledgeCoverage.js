// The one place knowledge_coverage is written.
//
// Four screens read this table -- the Analytics rings, the per-class
// breakdown, the freshness badges on a lecture, and the concept chips -- and
// until now two components in the browser wrote it, each with its own copy of
// the merge. They raced (the live database held a duplicate pair for one
// lecture, one a strict subset of the other), they cost two round trips per
// lecture, and neither could be tested.
//
// So: one upsert, server side, on the unique key added in
// 20260906000000_one_coverage_row_per_lecture.sql.
//
// TWO KINDS OF EVIDENCE, ONE ROW
//
//   Reviewing a lecture   moves last_reviewed_date and increments
//                         sessions_reviewed. That is what a finished study
//                         session proves: you sat with this material.
//   Answering questions   additionally unions concepts into concepts_seen and
//                         concepts_mastered, and recomputes proficiency.
//
// Reviewing is not mastery, so a session with no quiz never touches the
// concept arrays. A lecture can be freshly reviewed and still show no
// mastery -- that is the honest reading of having read something without
// being tested on it, and the freshness badges say so on their own.
//
// WHAT sessions_reviewed COUNTS
//
// Marks, not sittings. One study session can mark the same lecture more than
// once -- read the chapter, take its quiz, finish the session, fill in the
// post-session review -- and each of those is a separate call here. The three
// columns that are read today are unaffected: the date is the same day either
// way, and the concept arrays are a union. Nothing in the app reads this
// counter yet, and anything that starts to should either define a sitting
// first or read last_reviewed_date instead.

/** Today in the caller's own terms; DATE columns here are plain YYYY-MM-DD. */
export function today() {
  return new Date().toISOString().slice(0, 10);
}

function cleanConcepts(values) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(values) ? values : []) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function union(existing, incoming) {
  const out = [...(existing || [])];
  const seen = new Set(out);
  for (const value of incoming) {
    if (!seen.has(value)) { seen.add(value); out.push(value); }
  }
  return out;
}

/** What every writer has always stored: mastered / seen as a percentage. */
export function proficiencyOf(seen, mastered) {
  return seen.length > 0 ? Math.round((mastered.length / seen.length) * 100) : 0;
}

/**
 * Record that these lectures were studied.
 *
 * @param client      a pg client already inside a transaction -- coverage is
 *                    always written alongside something else (a completed
 *                    session, a saved review), and half of that landing is
 *                    worse than neither.
 * @param userId      the owner. Every statement carries it; the unique key is
 *                    (user_id, lecture_id), so one student's row can never be
 *                    the conflict target for another's.
 * @param classId     the class the lectures belong to. Validated by the caller.
 * @param lectureIds  which lectures. Duplicates and blanks are dropped, so a
 *                    lecture opened by two tools in one session counts once.
 * @param conceptsSeen / conceptsMastered
 *                    optional. Absent means "reviewed, not tested" and the
 *                    concept arrays are left exactly as they were.
 * @param date        the review date, defaulting to today.
 * @returns the lecture ids actually written.
 *
 * SELECT ... FOR UPDATE before the upsert, so two sessions finishing at once
 * serialise on the row rather than interleaving their unions. The unique key
 * makes the insert branch safe on its own; the lock makes the merge safe too.
 */
export async function markLecturesReviewed(client, {
  userId,
  classId,
  lectureIds,
  conceptsSeen = null,
  conceptsMastered = null,
  date = null,
}) {
  const ids = [...new Set((Array.isArray(lectureIds) ? lectureIds : []).filter(Boolean))];
  if (ids.length === 0) return [];

  const reviewedOn = date || today();
  const incomingSeen = cleanConcepts(conceptsSeen);
  // A concept can't be mastered without having been seen; the two writers this
  // replaces both derived mastered from the same question set, so anything
  // that isn't in seen is a caller bug rather than new information.
  const incomingMastered = cleanConcepts(conceptsMastered).filter((c) => incomingSeen.includes(c));

  const existing = new Map();
  for (const row of (await client.query(
    `select lecture_id, concepts_seen, concepts_mastered
       from knowledge_coverage
      where user_id = $1 and lecture_id = any($2::uuid[])
      for update`,
    [userId, ids],
  )).rows) {
    existing.set(row.lecture_id, row);
  }

  for (const lectureId of ids) {
    const prior = existing.get(lectureId);
    const seen = union(prior?.concepts_seen, incomingSeen);
    const mastered = union(prior?.concepts_mastered, incomingMastered);
    await client.query(
      `insert into knowledge_coverage
         (user_id, class_id, lecture_id, concepts_seen, concepts_mastered,
          proficiency, sessions_reviewed, last_reviewed_date)
       values ($1, $2, $3, $4::text[], $5::text[], $6, 1, $7::date)
       on conflict (user_id, lecture_id) where lecture_id is not null
       do update set
         class_id = excluded.class_id,
         concepts_seen = excluded.concepts_seen,
         concepts_mastered = excluded.concepts_mastered,
         proficiency = excluded.proficiency,
         sessions_reviewed = knowledge_coverage.sessions_reviewed + 1,
         -- greatest(), not excluded: re-reading an old lecture today moves the
         -- date forward, but a backdated write must never move it back.
         last_reviewed_date = greatest(knowledge_coverage.last_reviewed_date, excluded.last_reviewed_date)`,
      [userId, classId, lectureId, seen, mastered, proficiencyOf(seen, mastered), reviewedOn],
    );
  }

  return ids;
}

/**
 * The lectures of this class that the caller actually owns.
 *
 * Coverage is written for ids that arrive from the browser, so they are
 * filtered against the database rather than trusted. Silently dropping the
 * strangers rather than failing the whole call is deliberate: a stale tab
 * sending one deleted lecture should not cost a student the coverage for the
 * four they really did study.
 */
export async function ownedLectureIds(client, { userId, classId, lectureIds }) {
  const ids = [...new Set((Array.isArray(lectureIds) ? lectureIds : []).filter(Boolean))];
  if (ids.length === 0) return [];
  return (await client.query(
    'select id from lectures where id = any($1::uuid[]) and class_id = $2 and user_id = $3',
    [ids, classId, userId],
  )).rows.map((row) => row.id);
}
