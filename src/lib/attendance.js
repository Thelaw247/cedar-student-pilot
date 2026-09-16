import { getClassMeetingsForDate, localDateString } from './classSchedule.js';

/**
 * attendance — which past class sessions the app may ask about.
 *
 * Lifted out of AttendancePrompt.jsx (unchanged in shape) so it can be tested
 * from server/test the way classSchedule.js and eventSchedule.js are. One rule
 * was added while lifting it, and it is the whole reason this file exists:
 *
 *   A session is only askable if it ENDED AFTER THE CLASS WAS ADDED.
 *
 * Until 16 Sep 2026 the prompt walked the last three days with no idea when
 * the class had come into existence, so a student who imported a timetable on
 * Sunday evening was immediately asked whether they had attended Thursday's
 * and Friday's classes — sessions the app could not have tracked, because it
 * did not exist for that student yet. On the live data 11 of the 25 attendance
 * rows were answers to exactly that question. Every class row carries
 * `created_at` (the compatibility client also exposes it as `created_date`),
 * and that timestamp is the earliest moment the app could have known the
 * class met.
 */

const LOOKBACK_DAYS = 3;

/** ISO timestamp the class row was written; null when the row has neither field. */
function classAddedAt(cls) {
  const raw = cls?.created_at || cls?.created_date;
  if (!raw) return null;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * The instant a meeting on `dateStr` ends, as local time. A meeting with no
 * end time is taken to end at the end of that day — the most generous reading,
 * which only ever means "ask", never "skip".
 */
function sessionEndMs(dateStr, endTime) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [h, m] = /^\d{1,2}:\d{2}$/.test(endTime || '') ? endTime.split(':').map(Number) : [23, 59];
  return new Date(year, month - 1, day, h, m).getTime();
}

/**
 * True when the app was already tracking this class by the time the session
 * ended. A class row with no timestamp is treated as always tracked, which is
 * exactly how the prompt behaved before this guard existed.
 */
export function sessionEndedAfterClassAdded(cls, dateStr, endTime) {
  const addedAt = classAddedAt(cls);
  if (addedAt === null) return true;
  return sessionEndMs(dateStr, endTime) > addedAt;
}

/**
 * Find recent past class session dates (up to 3 days back, plus today once
 * the class has ended) where the class was scheduled, the app was tracking
 * the class at the time, and the student has neither a lecture nor an
 * attendance answer for it. Returns [{ classObj, date }], newest first.
 *
 * `now` is injectable for tests; the component passes nothing.
 */
export function findPastUnconfirmedSessions(classes, lectures, attendance, now = new Date()) {
  const results = [];

  // Build lookup sets
  const lectureKeys = new Set();
  for (const l of lectures || []) {
    if (l.class_id && l.date) {
      lectureKeys.add(`${l.class_id}|${l.date}`);
    }
  }
  const attendanceKeys = new Set();
  for (const a of attendance || []) {
    if (a.class_id && a.date) {
      attendanceKeys.add(`${a.class_id}|${a.date}`);
    }
  }

  // Check the last 3 days (today is handled separately, once its class time has passed)
  for (let i = 1; i <= LOOKBACK_DAYS; i++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = localDateString(checkDate);

    for (const cls of classes || []) {
      const meetings = getClassMeetingsForDate(cls, dateStr);
      if (meetings.length === 0) continue;

      // For yesterday and earlier, the class has definitely ended — but only
      // ask if the app was tracking the class when it did.
      const latestEnd = meetings.map(m => m.end_time || cls.end_time || '').sort().at(-1);
      if (!sessionEndedAfterClassAdded(cls, dateStr, latestEnd)) continue;

      const key = `${cls.id}|${dateStr}`;
      if (!lectureKeys.has(key) && !attendanceKeys.has(key)) {
        results.push({ classObj: { ...cls, start_time: meetings[0].start_time || cls.start_time }, date: dateStr });
      }
    }
  }

  // Also check today if class end time has passed
  const todayStr = localDateString(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (const cls of classes || []) {
    const meetings = getClassMeetingsForDate(cls, todayStr);
    if (meetings.length === 0) continue;

    const latestEnd = meetings.map(m => m.end_time || cls.end_time || '').sort().at(-1);
    if (latestEnd) {
      const [h, m] = latestEnd.split(':').map(Number);
      if (nowMinutes <= h * 60 + m) continue;
    }
    if (!sessionEndedAfterClassAdded(cls, todayStr, latestEnd)) continue;

    const key = `${cls.id}|${todayStr}`;
    if (!lectureKeys.has(key) && !attendanceKeys.has(key)) {
      results.push({ classObj: { ...cls, start_time: meetings[0].start_time || cls.start_time }, date: todayStr });
    }
  }

  // Sort newest first
  results.sort((a, b) => b.date.localeCompare(a.date));
  return results;
}
