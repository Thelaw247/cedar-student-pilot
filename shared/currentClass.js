/**
 * Pure "what class is happening right now" logic, extracted from UpNextCard so
 * a second, slightly-different copy doesn't drift into ClassStatusBar. No
 * React, no fetching — just time math over classes already loaded.
 */

function parseTime(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** Today's classes with parsed start/end minutes, filtered to ones with times. */
export function withMinutes(classes) {
  return (classes || [])
    .filter((c) => c.start_time && c.end_time)
    .map((c) => ({ ...c, startMin: parseTime(c.start_time), endMin: parseTime(c.end_time) }));
}

/** The class happening at `now`, or null. */
export function getCurrentClass(classes, now = new Date()) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return withMinutes(classes).find((c) => nowMin >= c.startMin && nowMin < c.endMin) || null;
}

/** The next class today after `now`, or null. */
export function getNextClass(classes, now = new Date()) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return withMinutes(classes)
    .filter((c) => c.startMin > nowMin)
    .sort((a, b) => a.startMin - b.startMin)[0] || null;
}
