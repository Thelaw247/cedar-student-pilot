/**
 * What a study session is, derived rather than asked.
 *
 * FocusSessionWizard asked three questions before the clock started: which
 * class, what for (review / exam sprint / deep), and in the app or on paper.
 * The first is now the scope picker on the study page. The other two only ever
 * set two things — the timer's interval lengths, which the running UI already
 * exposes, and the `study_mode` / `study_type` labels on the saved record.
 *
 * So the questions go and the labels are derived from what the app already
 * knows or from what the student actually did. Where nothing says, nothing is
 * written: `study_mode` is nullable and Analytics already renders a record
 * without one. A guessed label is worse than an absent one — it looks like
 * data.
 */

export const DEFAULT_GOAL_MINUTES = 60;
export const DEFAULT_STUDY_MINUTES = 25;
export const DEFAULT_BREAK_MINUTES = 5;

// A booked session carries the length it was scheduled for. Anything outside
// this range is a bad row, not a goal — five minutes is not a session and
// eight hours is not a sitting.
const MIN_GOAL = 5;
const MAX_GOAL = 480;

/**
 * How long this sitting is aiming for.
 *
 * The wizard's presets (90 / 45 / 30) were a proxy for this, chosen by
 * answering what kind of session it was. A booked session already says: it was
 * scheduled for `duration_minutes`, and the planner has shown that number on
 * the card since the day it was created.
 */
export function goalMinutesFor(session) {
  const n = Number(session?.duration_minutes);
  if (!Number.isFinite(n) || n < MIN_GOAL || n > MAX_GOAL) return DEFAULT_GOAL_MINUTES;
  return Math.round(n);
}

/**
 * The record's `study_mode`, from the session rather than from a question.
 *
 * Returns null when nothing in the data says — an ad-hoc sitting started from
 * the study page is not evidence of a deep session, a sprint or a review, and
 * writing one of those anyway would put a guess in a column Analytics reads
 * as a fact.
 */
export function deriveStudyMode(session, assignment) {
  const type = assignment?.type;
  if (type === 'exam' || type === 'quiz') return 'sprint';
  if (!session) return null;
  if (session.session_type === 'review') return 'review';
  if (session.session_type === 'study') return 'deep';
  return null;
}

/**
 * The record's `study_type`, from what was opened rather than from a plan.
 *
 * The wizard asked up front and believed the answer; a student who said "on
 * paper" and then read the handbook was recorded as having studied on paper.
 * The column is NOT NULL with a 'manual' default, and manual is the honest
 * reading of a timer that ran with nothing opened in the app.
 */
export function deriveStudyType(usedInApp) {
  return usedInApp ? 'in_app' : 'manual';
}

/** mm:ss, for the ring and the nav clock. */
export function formatClockSeconds(s) {
  const total = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
