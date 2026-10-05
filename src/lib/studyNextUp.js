import { resolveAssignmentLectures } from '../../shared/assignmentScope.js';

/**
 * What is next for one class, read off rows the study page already holds.
 *
 * The study page knew the student's next exam, how many of its lectures had
 * been reviewed, and when they had booked themselves to study, and showed
 * none of it on the tab where they actually study: those facts sat on the
 * Schedule tab, one tap and one scroll away from the tools. So a student
 * picked lectures and pressed Quiz me with no idea whether this was the right
 * three to pick, or that their own plan said 5:30 today.
 *
 * Pure and I/O-free: the planner loads the rows (one request per table, for
 * every class), the panel passes them in, this decides. Which is what makes
 * every rule testable without a database.
 *
 * "Reviewed" means exactly what it means on the deadline's coverage checklist
 * and on the lecture's freshness badge: knowledge_coverage has a
 * last_reviewed_date for that lecture. A fourth private meaning of the word
 * is how two parts of one screen come to disagree.
 *
 * Returns null when there is nothing honest to say: no upcoming deadline and
 * no booked sitting for this class. The card then simply is not there; it
 * never invents urgency.
 *
 * @param classId    the class on screen
 * @param deadlines  the semester's assignments (any class), or null while
 *                   they are still loading
 * @param sessions   the semester's study sessions (any class), or null
 * @param lectures   THIS class's lectures
 * @param coverage   knowledge_coverage rows (any class), or null while
 *                   unknown. Unknown means no progress bar rather than an
 *                   empty one: "0 of 4 reviewed" about rows that have not
 *                   arrived would be a lie for a second and a half.
 * @param today      the student's local day, 'YYYY-MM-DD'
 */
export function nextUpFor({ classId, deadlines = null, sessions = null, lectures = [], coverage = null, today }) {
  if (!classId || !today) return null;

  const classDeadlines = (Array.isArray(deadlines) ? deadlines : [])
    .filter((a) => a && a.class_id === classId);
  const upcoming = classDeadlines
    .filter((a) => (a.status || 'active') === 'active' && typeof a.due_date === 'string' && a.due_date >= today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const deadline = upcoming[0] || null;

  // A project has a roadmap of steps and its own progress; lectures are not
  // what it is made of, so it gets the date and nothing to tick.
  let progress = null;
  if (deadline && deadline.type !== 'project' && Array.isArray(coverage)) {
    const scoped = resolveAssignmentLectures(deadline, lectures, classDeadlines);
    if (scoped.length > 0) {
      const reviewed = reviewedOn(coverage);
      const notReviewedIds = scoped.filter((l) => !reviewed.has(l.id)).map((l) => l.id);
      progress = { total: scoped.length, done: scoped.length - notReviewedIds.length, notReviewedIds };
    }
  }

  // The next sitting the student booked for this class. A project session
  // opens on its own screen, so it is not offered here.
  const session = (Array.isArray(sessions) ? sessions : [])
    .filter((s) => s && s.class_id === classId && s.status === 'scheduled' && s.session_type !== 'project'
      && typeof s.scheduled_date === 'string' && s.scheduled_date >= today)
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date)
      || String(a.scheduled_time || '').localeCompare(String(b.scheduled_time || '')))[0] || null;

  if (!deadline && !session) return null;
  return {
    deadline,
    daysLeft: deadline ? daysBetween(today, deadline.due_date) : null,
    progress,
    session,
  };
}

/** lecture_id -> last_reviewed_date, for every row that has one. */
export function reviewedOn(coverage) {
  const map = new Map();
  for (const row of Array.isArray(coverage) ? coverage : []) {
    if (row && row.lecture_id && row.last_reviewed_date) map.set(row.lecture_id, row.last_reviewed_date);
  }
  return map;
}

/** Whole days from one 'YYYY-MM-DD' to another, both read as local midnight. */
export function daysBetween(from, to) {
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** "today", "tomorrow", "in 3 days", "in 2 weeks" (16 days reads as "in 16 days"; from 21 it is weeks). */
export function daysLeftLabel(days) {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 21) return `in ${days} days`;
  const weeks = Math.round(days / 7);
  return `in ${weeks} week${weeks === 1 ? '' : 's'}`;
}

/** "today", "tomorrow", or a weekday for anything later this week; the date beyond that. */
export function sittingDayLabel(date, today, formatShortDate) {
  const days = daysBetween(today, date);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return formatShortDate(date, { weekday: true });
}
