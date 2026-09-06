/**
 * What the study shelf can actually offer right now.
 *
 * Split out of the component so the reasons can be tested rather than
 * trusted. The whole value of a greyed-out tile is that the sentence on it is
 * the true one — "nothing selected" and "nothing to select" are different
 * problems with different fixes, and a student who is told the wrong one goes
 * looking in the wrong place.
 */

/** Why a scoped tool cannot run, or null if it can. */
export function scopeBlockReason({ classId, lectureCount = 0, lectureIds = [], hasClasses = true }) {
  // "Pick a class first" is a lie on a brand-new account: there is nothing to
  // pick from, and the student would go hunting for a control that is empty.
  if (!classId) return hasClasses ? 'Pick a class first' : 'Add a class first';
  if (lectureCount === 0) return 'This class has no lectures yet';
  if (lectureIds.length === 0) return 'Select at least one lecture above';
  return null;
}

/**
 * Why today's / this week's review cannot run, or null if it can.
 *
 * `lectures` null means the caller does not know — an unknown window stays
 * live, because greying a working button is a worse bug than the one being
 * fixed. The date range is inclusive at both ends, matching the server's
 * `date between (today - 7 days) and today`; a narrower window here would
 * grey out a review the runner would have happily produced.
 */
export function windowBlockReason(lectures, from, to, label) {
  if (!Array.isArray(lectures)) return null;
  const inWindow = lectures.filter((l) => l && l.date && l.date >= from && l.date <= to);
  if (inWindow.length === 0) return `No lectures ${label}`;
  // Lectures exist but none of them has anything to build questions from —
  // still a wall, and a different one, so it says which.
  const ready = inWindow.filter((l) => l.transcript || l.ai_summary || (l.ai_concepts || []).length > 0);
  if (ready.length === 0) {
    return `${inWindow.length} lecture${inWindow.length === 1 ? '' : 's'} ${label}, still processing`;
  }
  return null;
}
