// Which lectures does this deadline actually cover?
//
// One answer, in one place. Before this the question was answered in exactly
// one spot -- eleven lines inside generateClassHandbook -- and every other
// feature that needed it either guessed or ignored it: the scheduler booked
// "Midterm - Session 1..10" against no lectures at all, and exam prediction
// scored every lecture in the class including ones taught after the exam.
//
// The rules follow coverage_scope, which is a CHECK-constrained column with
// five legal values:
//
//   cumulative  Everything taught up to the due date. The default, and what
//               every deadline in the database is until someone says
//               otherwise.
//   since_last  Everything since the previous exam or quiz. Note "exam or
//               quiz" -- the original filtered on nothing but the date, so a
//               weekly assignment due last Tuesday would reset the window and
//               a midterm would think it covered four days of material.
//   custom      An explicit list, from assignments.lecture_ids.
//   all         Every lecture in the class, including any taught after the
//               due date. A midterm does not cover those; a take-home or a
//               comprehensive final scheduled before the last week does, and
//               before this the only way to say so was to tick every box by
//               hand and then re-tick it after every new recording.
//   none        Nothing. This is the default for an assignment or a project
//               now: a problem set is not "everything taught so far", and
//               saying it is put the whole course into its study sessions.
//               Exams and quizzes still default to cumulative.
//
// Derived, never stored, for cumulative and since_last: a stored list goes
// stale the moment another lecture is recorded, and a student recording
// today's lecture would not expect their midterm's scope to silently freeze.
//
// Pure and I/O-free on purpose. The caller loads the rows; this decides. That
// is what makes every rule above testable without a database, which is
// exactly what the version living inside a route handler never was.

/** The values assignments.coverage_scope is allowed to hold. */
export const COVERAGE_SCOPES = ['cumulative', 'since_last', 'custom', 'all', 'none'];

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
 * picked yet", not "this exam covers no material" -- 'none' is how a student
 * says that, and it is checked before the due date is even read, because a
 * deadline that covers nothing covers nothing whether or not it has a date.
 */
export function resolveAssignmentLectures(assignment, lectures, priorAssignments = []) {
  const inTeachingOrder = (Array.isArray(lectures) ? lectures : [])
    .filter((l) => l && day(l.date))
    .sort((a, b) => day(a.date).localeCompare(day(b.date)));

  const scope = assignment?.coverage_scope || 'cumulative';
  // Both of these are answers to "which lectures?" that the due date cannot
  // change, so they are settled before it is consulted.
  if (scope === 'none') return [];
  if (scope === 'all') return inTeachingOrder;

  const due = day(assignment?.due_date);
  if (!due) return inTeachingOrder;

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

/** How a scope reads to a student, with no deadline in front of it. */
export const COVERAGE_SCOPE_LABEL = {
  cumulative: 'Everything up to the due date',
  since_last: 'Since the last exam or quiz',
  custom: 'Specific lectures',
  all: 'Every lecture in this class',
  none: 'No lectures',
};

/** What a deadline of this type is called, for copy that has to name it. */
export function deadlineTypeLabel(type) {
  return type === 'exam' ? 'exam'
    : type === 'quiz' ? 'quiz'
      : type === 'project' ? 'project'
        : 'assignment';
}

/**
 * The same label, but naming the deadline the student is actually looking at.
 * "Everything up to the due date" is correct and forgettable; "Everything up
 * to the exam" is the sentence they would have said themselves.
 */
export function coverageScopeLabel(scope, type) {
  if (scope === 'cumulative') return `Everything up to the ${deadlineTypeLabel(type)}`;
  return COVERAGE_SCOPE_LABEL[scope] || COVERAGE_SCOPE_LABEL.cumulative;
}

/**
 * What a NEW deadline of this type covers before anyone touches the control.
 *
 * An exam is a claim about material, so it starts as everything taught up to
 * it. An assignment or a project is a piece of work: it may draw on lectures
 * and usually does not, and defaulting it to the whole course meant every
 * problem set silently dragged the entire term into its study sessions and
 * its handbook. Existing rows are untouched -- this only decides what a
 * freshly created deadline is born with.
 */
export function defaultCoverageScope(type) {
  return type === 'exam' || type === 'quiz' ? 'cumulative' : 'none';
}

/**
 * The scopes worth offering for this type, in the order they should appear.
 * The first is always the default, so the control opens on the chosen one.
 *
 * 'since_last' only means something next to other exams, so it is not offered
 * on an assignment. 'custom' is never listed: it is not a button, it is what
 * the picker becomes the moment a student ticks a lecture themselves.
 */
export function coveragePresetsFor(type) {
  return type === 'exam' || type === 'quiz'
    ? ['cumulative', 'since_last', 'all']
    : ['none', 'cumulative', 'all'];
}
