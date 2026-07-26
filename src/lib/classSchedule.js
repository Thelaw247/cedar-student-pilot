/**
 * classSchedule — one place that understands both ways a class can be scheduled.
 *
 * A class is either:
 *   - per-day: has a meetings[] list of { day, start_time, end_time }, or
 *   - legacy/same-time: has days_of_week[] plus a single start_time/end_time.
 *
 * Every view (weekly grid, today's list, etc.) should read schedule through
 * these helpers instead of touching start_time/days_of_week directly, so both
 * styles render identically and old classes keep working with no migration.
 */

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Map JS Date.getDay() (0=Sun..6=Sat) to our short day labels.
const JS_DAY_TO_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function dayLabelFromDate(date = new Date()) {
  return JS_DAY_TO_LABEL[date.getDay()];
}

/**
 * Normalize a class into a list of meeting occurrences:
 *   [{ day, start_time, end_time }, ...]
 * Uses meetings[] when present, otherwise expands the legacy single time
 * across days_of_week. Entries are sorted in Mon..Sun order.
 */
export function getClassMeetings(cls) {
  if (!cls) return [];
  if (Array.isArray(cls.meetings) && cls.meetings.length > 0) {
    return [...cls.meetings]
      .filter(m => m && m.day)
      .sort((a, b) => ALL_DAYS.indexOf(a.day) - ALL_DAYS.indexOf(b.day));
  }
  const days = cls.days_of_week || [];
  return days
    .slice()
    .sort((a, b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b))
    .map(day => ({ day, start_time: cls.start_time || '', end_time: cls.end_time || '' }));
}

/** All day labels a class meets on (works for both schedule styles). */
export function getClassDays(cls) {
  return getClassMeetings(cls).map(m => m.day);
}

/** Does this class meet on the given day label ('Mon'..'Sun')? */
export function classMeetsOnDay(cls, dayLabel) {
  return getClassMeetings(cls).some(m => m.day === dayLabel);
}

/**
 * The class's times on a specific day, or null if it doesn't meet that day.
 * Returns { start_time, end_time }.
 */
export function getClassTimesForDay(cls, dayLabel) {
  const m = getClassMeetings(cls).find(mm => mm.day === dayLabel);
  return m ? { start_time: m.start_time, end_time: m.end_time } : null;
}

/**
 * Flatten a list of classes into per-day occurrences for a given day label,
 * each carrying the class plus that day's times. Handy for building a day's
 * agenda regardless of which schedule style each class uses.
 */
export function classesOnDay(classes, dayLabel) {
  const out = [];
  for (const cls of classes || []) {
    const t = getClassTimesForDay(cls, dayLabel);
    if (t) out.push({ ...cls, _day: dayLabel, _start: t.start_time, _end: t.end_time });
  }
  return out;
}
