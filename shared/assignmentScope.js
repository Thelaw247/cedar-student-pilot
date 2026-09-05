// Which lectures does this deadline actually cover?
//
// One answer, in one place. Before this the question was answered in exactly
// one spot -- eleven lines inside generateClassHandbook -- and every other
// feature that needed it either guessed or ignored it: the scheduler booked
// "Midterm - Session 1..10" against no lectures at all, and exam prediction
// scored every lecture in the class including ones taught after the exam.
//
// The rules follow coverage_scope, which is a CHECK-constrained column with
// three legal values:
//
//   cumulative  Everything taught up to the due date. The default, and what
//               every deadline in the database is until someone says
//               otherwise.
//   since_last  Everything since the previous exam or quiz. Note "exam or
//               quiz" -- the original filtered on nothing but the date, so a
//               weekly assignment due last Tuesday would reset the window and
//               a midterm would think it covered four days of material.
//   custom      An explicit list, from assignments.lecture_ids.
//
// Derived, never stored, for cumulative and since_last: a stored list goes
// stale the moment another lecture is recorded, and a student recording
// today's lecture would not expect their midterm's scope to silently freeze.
//
// Pure and I/O-free on purpose. The caller loads the rows; this decides. That
// is what makes every rule above testable without a database, which is
// exactly what the version living inside a route handler never was.

/** The values assignments.coverage_scope is allowed to hold. */
export const COVERAGE_SCOPES = ['cumulative', 'since_last', 'custom'];

/**
 * A date column as a YYYY-MM-DD string.
 *
 * The server's pg client is configured to hand DATE back as the raw string
 * (server/lib/db.js), and PostgREST sends strings too, so the Date branch is
 * defensive rather than expected. A pg DATE that did arrive as a Date is
 * midnight UTC, so toISOString is the reading that does not shift a day.
 */
function day(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  return typeof value === 'string' ? value.slice(0, 10) : null;
}

/**
 * The lectures a deadline covers, in teaching order (earliest first).
 *
 * @param assignment       the exam / quiz / assignment / project
 * @param lectures         the class's lectures (any order; filtered, never mutated)
 * @param priorAssignments other deadlines in the same class -- only read for
 *                         'since_last', and safe to pass empty otherwise
 *
 * An assignment with no due date covers everything, because there is no
 * window to cut. A 'custom' scope with an empty list falls back to
 * cumulative rather than returning nothing: an empty list means "nobody has
 * picked yet", not "this exam covers no material".
 */
export function resolveAssignmentLectures(assignment, lectures, priorAssignments = []) {
  const inTeachingOrder = (Array.isArray(lectures) ? lectures : [])
    .filter((l) => l && day(l.date))
    .sort((a, b) => day(a.date).localeCompare(day(b.date)));

  const due = day(assignment?.due_date);
  if (!due) return inTeachingOrder;

  const scope = assignment?.coverage_scope || 'cumulative';

  if (scope === 'custom') {
    const wanted = new Set(assignment?.lecture_ids || []);
    if (wanted.size > 0) return inTeachingOrder.filter((l) => wanted.has(l.id));
    // Nothing picked yet — fall through to cumulative.
  }

  const upToDue = inTeachingOrder.filter((l) => day(l.date) <= due);

  if (scope === 'since_last') {
    const previous = (Array.isArray(priorAssignments) ? priorAssignments : [])
      .filter((a) => a && a.id !== assignment?.id
        && (a.type === 'exam' || a.type === 'quiz')
        && day(a.due_date) && day(a.due_date) < due)
      .sort((a, b) => day(b.due_date).localeCompare(day(a.due_date)))[0];
    // No earlier exam means there is no "since" to measure from, so the
    // window is the whole course so far — which is what a first midterm
    // covers anyway.
    if (previous) return upToDue.filter((l) => day(l.date) >= day(previous.due_date));
  }

  return upToDue;
}

/** How a scope reads to a student, for a label or a dropdown. */
export const COVERAGE_SCOPE_LABEL = {
  cumulative: 'Everything so far',
  since_last: 'Since the last exam or quiz',
  custom: 'Specific lectures',
};
