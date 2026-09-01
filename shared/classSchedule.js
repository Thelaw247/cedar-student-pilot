/**
 * classSchedule — one place that understands both ways a class can be scheduled.
 *
 * A class is either:
 *   - rule-based: has meetings[] entries with day/time and optional date range,
 *     specific_date, component, room/instructor overrides, and exclusions, or
 *   - legacy/same-time: has days_of_week[] plus a single start_time/end_time.
 *
 * Every view (weekly grid, today's list, etc.) should read schedule through
 * these helpers instead of touching start_time/days_of_week directly, so both
 * styles render identically and old classes keep working with no migration.
 */

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Map JS Date.getDay() (0=Sun..6=Sat) to our short day labels.
const JS_DAY_TO_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** @param {Date|string} date */
export function dayLabelFromDate(date = new Date()) {
  const parsed = typeof date === 'string' ? new Date(`${date.slice(0, 10)}T00:00:00`) : date;
  return JS_DAY_TO_LABEL[parsed.getDay()];
}

/** @param {Date|string} value */
export function localDateString(value = new Date()) {
  if (typeof value === 'string') return value.slice(0, 10);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function dateDayLabel(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return JS_DAY_TO_LABEL[new Date(year, month - 1, day).getDay()];
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

function meetingAppliesOnDate(cls, meeting, dateStr) {
  if (!meeting) return false;
  if (meeting.specific_date) return meeting.specific_date === dateStr;
  if (Array.isArray(meeting.specific_dates) && meeting.specific_dates.length > 0) {
    return meeting.specific_dates.includes(dateStr);
  }
  if (Array.isArray(meeting.excluded_dates) && meeting.excluded_dates.includes(dateStr)) return false;
  const rangeStart = meeting.start_date || cls.class_start_date;
  const rangeEnd = meeting.end_date || cls.class_end_date;
  if (rangeStart && dateStr < rangeStart) return false;
  if (rangeEnd && dateStr > rangeEnd) return false;
  return meeting.day === dateDayLabel(dateStr);
}

function componentKey(meeting) {
  return `${(meeting.component || '').trim().toLowerCase()}|${(meeting.section || '').trim().toLowerCase()}`;
}

/** Return every actual occurrence for one class on one concrete date. */
/** @param {any} cls @param {Date|string} date */
export function getClassMeetingsForDate(cls, date = new Date()) {
  const dateStr = localDateString(date);
  const applicable = getClassMeetings(cls).filter((meeting) => meetingAppliesOnDate(cls, meeting, dateStr));
  const replacementKeys = new Set(
    applicable
      .filter((meeting) => meeting.specific_date && meeting.replaces_regular_time === true)
      .map(componentKey),
  );
  return applicable
    .filter((meeting) => meeting.specific_date || !replacementKeys.has(componentKey(meeting)))
    .sort((a, b) => (a.start_time || '99:99').localeCompare(b.start_time || '99:99'));
}

export function classMeetsOnDate(cls, date = new Date()) {
  return getClassMeetingsForDate(cls, date).length > 0;
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
 * Resolve a meeting location without leaking one component's room into the
 * others. In a rule-based schedule, an omitted room is meaningful (for
 * example, Banner's NO_ROOM lecture beside a roomed lab), so only that rule's
 * room may be displayed. Legacy classes still use their class-level room.
 */
export function getMeetingRoom(cls, meeting) {
  const hasMeetingRules = Array.isArray(cls?.meetings) && cls.meetings.length > 0;
  return meeting?.room || (hasMeetingRules ? '' : cls?.room || '');
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

/**
 * Flatten classes into concrete meeting occurrences on a specific date.
 * @param {any[]} classes
 * @param {Date|string} date
 */
export function classesOnDate(classes, date = new Date()) {
  const dateStr = localDateString(date);
  const out = [];
  for (const cls of classes || []) {
    getClassMeetingsForDate(cls, dateStr).forEach((meeting, index) => {
      out.push({
        ...cls,
        start_time: meeting.start_time || cls.start_time,
        end_time: meeting.end_time || cls.end_time,
        room: getMeetingRoom(cls, meeting),
        instructor: meeting.instructor || cls.instructor,
        component: meeting.component || '',
        _meeting: meeting,
        _occurrence_key: `${cls.id || 'class'}-${dateStr}-${index}-${meeting.start_time || ''}`,
      });
    });
  }
  return out.sort((a, b) => (a.start_time || '99:99').localeCompare(b.start_time || '99:99'));
}
