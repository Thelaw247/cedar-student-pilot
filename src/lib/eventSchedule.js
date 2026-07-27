/**
 * eventSchedule — expand CalendarEvents into concrete day occurrences.
 *
 * An event is either:
 *   - one-time: recurrence 'none' (or unset), lives on its single `date`, or
 *   - weekly: recurrence 'weekly', repeats on recurrence_days between
 *     recurrence_start_date and recurrence_end_date.
 *
 * Views render a week (or a day) by asking for occurrences in a date range,
 * so recurring events are stored once and expanded here at read time — no
 * duplicate rows in the data, and editing/deleting the series touches one record.
 */

const JS_DAY_TO_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Parse 'YYYY-MM-DD' as a LOCAL date (avoids UTC off-by-one from new Date(str)).
export function parseLocalDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function dayLabelFor(dateStr) {
  const d = parseLocalDate(dateStr);
  return d ? JS_DAY_TO_LABEL[d.getDay()] : null;
}

/**
 * Return the concrete occurrences of an event that fall within [startStr, endStr]
 * (inclusive). Each occurrence is a shallow copy of the event with a concrete
 * `date` set, plus `_recurring` / `_seriesId` markers so the UI can show that
 * it's part of a series and edit the underlying record.
 */
export function expandEventInRange(event, startStr, endStr) {
  if (!event) return [];
  const rangeStart = parseLocalDate(startStr);
  const rangeEnd = parseLocalDate(endStr);
  if (!rangeStart || !rangeEnd) return [];

  // One-time events: include if their single date is in range.
  if (event.recurrence !== 'weekly') {
    if (event.date && event.date >= startStr && event.date <= endStr) {
      return [{ ...event, date: event.date, _recurring: false, _seriesId: event.id }];
    }
    return [];
  }

  // Weekly recurrence: walk each day in range, emit on matching weekdays that
  // also fall inside the series' own start/end window.
  const days = event.recurrence_days || [];
  if (days.length === 0) return [];
  const seriesStart = event.recurrence_start_date || startStr;
  const seriesEnd = event.recurrence_end_date || endStr;

  const out = [];
  const cursor = new Date(rangeStart);
  while (cursor <= rangeEnd) {
    const ds = toDateStr(cursor);
    const label = JS_DAY_TO_LABEL[cursor.getDay()];
    if (days.includes(label) && ds >= seriesStart && ds <= seriesEnd) {
      out.push({ ...event, date: ds, _recurring: true, _seriesId: event.id });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/** Expand a list of events into all occurrences within [startStr, endStr]. */
export function expandEventsInRange(events, startStr, endStr) {
  return (events || []).flatMap(e => expandEventInRange(e, startStr, endStr));
}

/** Occurrences of all events on a single date. */
export function eventsOnDate(events, dateStr) {
  return expandEventsInRange(events, dateStr, dateStr);
}

/**
 * Monday-based start of the week containing `date`, as 'YYYY-MM-DD'.
 * offsetWeeks shifts by whole weeks (for week paging).
 */
export function weekStart(date = new Date(), offsetWeeks = 0) {
  const d = new Date(date);
  const dow = d.getDay(); // 0=Sun..6=Sat
  const diffToMonday = (dow === 0 ? -6 : 1 - dow);
  d.setDate(d.getDate() + diffToMonday + offsetWeeks * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** The 7 date strings (Mon..Sun) for the week containing `date`. */
export function weekDates(date = new Date(), offsetWeeks = 0) {
  const start = weekStart(date, offsetWeeks);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(toDateStr(d));
  }
  return out;
}

export { toDateStr };
