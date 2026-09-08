/**
 * Deadlines waiting for a plan the student's tier did not include yet.
 *
 * A student on Student adds a midterm, is told no study sessions were booked
 * and why, taps "See plans", and upgrades. Before this, that was the end of
 * it: the upgrade went through, and the midterm they had just added still had
 * nothing booked against it. The one thing they upgraded FOR did not happen.
 *
 * So the id is remembered on the way out to checkout and booked on the way
 * back. localStorage rather than a column, deliberately: checkout returns to
 * the same browser it left, this is a handoff across one redirect and not a
 * fact about the deadline, and a column would need a migration, a writer, a
 * reader and a rule for when to clear it. If the handoff is lost — a
 * different device, cleared storage, an abandoned checkout finished from
 * Settings a week later — nothing breaks: PendingSchedules simply finds
 * nothing, and the "Plan study sessions" button on the deadline itself is the
 * durable way in.
 *
 * Every read and write is wrapped: Safari in private mode throws on
 * localStorage rather than returning null, and a student adding an exam is
 * not the moment to find that out.
 */

const KEY = 'cedar-pending-schedule';
const MAX = 20;

export function pendingScheduleIds() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((id) => typeof id === 'string' && id) : [];
  } catch { return []; }
}

/** Remember one. No-op on a falsy id, so callers need no guard of their own. */
export function rememberPendingSchedule(assignmentId) {
  if (!assignmentId) return;
  try {
    const next = [...new Set([...pendingScheduleIds(), assignmentId])].slice(-MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* the button on the deadline is still there */ }
}

/** Forget one, whatever the outcome — a failed booking must not retry forever. */
export function forgetPendingSchedule(assignmentId) {
  try {
    const next = pendingScheduleIds().filter((id) => id !== assignmentId);
    if (next.length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* nothing to do */ }
}
