import { pool } from './db.js';
import { getClassMeetingsForDate } from '../../src/lib/classSchedule.js';

// One shared placement engine for every route that books a study_sessions
// row (3 Sep 2026 rework). Before this there were four separate copies of
// "find a free slot" — generateStudySchedule.js (LLM-guessed times, silently
// overridden if busy), fitProjectTime.js (its own gap-finder),
// rebookStudySession.js (LLM-guessed, loosely validated), and
// scheduleLectureReview in processLectureRecording.js — each with different
// rules and none of them aware of a travel buffer or the student's preferred
// study times. This module is the one place those rules live now.
//
// The rules, in one place so they can't drift apart again:
//   1. ASAP — start looking from today (or an explicit fromDate), not next week.
//   2. At most one session per calendar day, so sessions land "every day"
//      rather than stacked.
//   3. Every session is 30-90 minutes, sized to the gap it lands in.
//   4. A BUFFER_MINUTES cushion surrounds every busy block — a class, a
//      calendar event, or an already-placed session — so nothing is booked
//      back-to-back with zero travel time.
//   5. Sessions only land inside the student's preferred windows (Settings >
//      Review Schedule, profiles.preferred_study_times). No preference set →
//      a sane default window, so nothing breaks for a student who hasn't
//      configured one yet.

export const MIN_SESSION_MINUTES = 30;
export const MAX_SESSION_MINUTES = 90;
const BUFFER_MINUTES = 30;
// A configured time is a single point (e.g. "19:00"); it opens a window this
// many minutes on either side, so "restricted to those times" still leaves
// enough room to actually fit a 30-90 minute session near it.
const WINDOW_RADIUS_MINUTES = 90;
const DEFAULT_WINDOWS = [{ start: 16 * 60, end: 21 * 60 }]; // 4pm-9pm
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SEARCH_HORIZON_DAYS = 60; // don't search forever against a fully-booked calendar

const toMin = (t) => { if (!t || typeof t !== 'string' || !t.includes(':')) return null; const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
const toTime = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const dateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDaysStr = (ds, n) => { const d = new Date(`${ds}T00:00:00`); d.setDate(d.getDate() + n); return dateStr(d); };
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** The student's preferred study/review windows, or the default if none are set. */
export async function getPreferredWindows(userId) {
  const { rows } = await pool.query('select preferred_study_times from profiles where id = $1', [userId]);
  const raw = rows[0]?.preferred_study_times;
  const times = (Array.isArray(raw) ? raw : []).filter((t) => TIME_RE.test(t));
  if (times.length === 0) return DEFAULT_WINDOWS;
  return times
    .map((t) => { const m = toMin(t); return { start: Math.max(0, m - WINDOW_RADIUS_MINUTES), end: Math.min(24 * 60, m + WINDOW_RADIUS_MINUTES) }; })
    .sort((a, b) => a.start - b.start);
}

/**
 * Busy blocks per day across [startDate, endDate], each already expanded by
 * BUFFER_MINUTES. classId narrows to one class's meetings; omit it to pull
 * every class (used when booking isn't tied to a single course).
 */
async function getBusyBlocksForRange(userId, startDate, endDate, classId = null) {
  const busy = {};
  const add = (ds, start, end) => {
    if (start == null) return;
    const safeEnd = end == null ? start + 60 : end;
    if (!busy[ds]) busy[ds] = [];
    busy[ds].push({ start: Math.max(0, start - BUFFER_MINUTES), end: Math.min(24 * 60, safeEnd + BUFFER_MINUTES) });
  };

  const classes = classId
    ? (await pool.query('select * from classes where id = $1 and user_id = $2', [classId, userId])).rows
    : (await pool.query('select * from classes where user_id = $1', [userId])).rows;

  const events = (await pool.query(
    "select * from calendar_events where user_id = $1 and (date between $2 and $3 or recurrence = 'weekly')",
    [userId, startDate, endDate],
  )).rows;

  const sessions = (await pool.query(
    "select scheduled_date, scheduled_time, duration_minutes from study_sessions where user_id = $1 and scheduled_date between $2 and $3 and status != 'skipped'",
    [userId, startDate, endDate],
  )).rows;

  for (let d = new Date(`${startDate}T00:00:00`); d <= new Date(`${endDate}T00:00:00`); d.setDate(d.getDate() + 1)) {
    const ds = dateStr(d);
    const dayLabel = DAY_LABELS[d.getDay()];

    for (const c of classes) {
      for (const meeting of getClassMeetingsForDate(c, ds)) {
        add(ds, toMin(meeting.start_time || c.start_time), toMin(meeting.end_time || c.end_time));
      }
    }
    for (const e of events) {
      if (!e.start_time) continue;
      const eDate = e.date instanceof Date ? dateStr(e.date) : e.date;
      const hits = e.recurrence === 'weekly'
        ? (e.recurrence_days || []).includes(dayLabel) && (!e.recurrence_start_date || ds >= e.recurrence_start_date) && (!e.recurrence_end_date || ds <= e.recurrence_end_date)
        : eDate === ds;
      if (hits) add(ds, toMin(e.start_time), toMin(e.end_time));
    }
    for (const s of sessions) {
      const sDate = s.scheduled_date instanceof Date ? dateStr(s.scheduled_date) : s.scheduled_date;
      if (sDate === ds && s.scheduled_time) {
        const start = toMin(s.scheduled_time);
        add(ds, start, start + (Number(s.duration_minutes) || 60));
      }
    }
  }
  return busy;
}

/** Free spans for one day, already clipped to the preferred windows and buffered busy blocks. */
function freeSpansForDay(busyBlocks, windows) {
  const spans = [];
  for (const w of windows) {
    const relevant = (busyBlocks || []).filter((b) => b.start < w.end && b.end > w.start).sort((a, b) => a.start - b.start);
    let cursor = w.start;
    for (const b of relevant) {
      const bStart = Math.max(b.start, w.start);
      const bEnd = Math.min(b.end, w.end);
      if (bStart > cursor) spans.push({ start: cursor, end: bStart });
      cursor = Math.max(cursor, bEnd);
    }
    if (cursor < w.end) spans.push({ start: cursor, end: w.end });
  }
  return spans.filter((s) => s.end - s.start >= MIN_SESSION_MINUTES).sort((a, b) => a.start - b.start);
}

/**
 * Place up to `count` sessions, one per calendar day, starting from
 * `fromDate` (default today) through `horizonDate` (default +60 days). Each
 * placement is sized between minMinutes and maxMinutes to fit the gap it
 * lands in. Returns the placements — this does NOT insert rows; callers
 * decide what row shape to write (a lecture review, a project step, a study
 * session), since the fields differ per caller.
 */
export async function scheduleAsap({
  userId, classId = null, count = 1, fromDate = null, horizonDate = null,
  minMinutes = MIN_SESSION_MINUTES, maxMinutes = MAX_SESSION_MINUTES,
}) {
  const start = fromDate || dateStr(new Date());
  const endDate = horizonDate || addDaysStr(start, SEARCH_HORIZON_DAYS);
  const windows = await getPreferredWindows(userId);
  const busyByDay = await getBusyBlocksForRange(userId, start, endDate, classId);

  const placements = [];
  let cursor = start;
  while (placements.length < count && cursor <= endDate) {
    const spans = freeSpansForDay(busyByDay[cursor], windows);
    if (spans.length > 0) {
      // Prefer the earliest window of the day that fits — keeps sessions
      // anchored near the student's stated preference rather than drifting
      // to whichever window happens to be least full.
      const span = spans[0];
      const duration = Math.min(maxMinutes, Math.max(minMinutes, span.end - span.start));
      placements.push({ date: cursor, time: toTime(span.start), duration_minutes: duration });
      if (!busyByDay[cursor]) busyByDay[cursor] = [];
      busyByDay[cursor].push({ start: Math.max(0, span.start - BUFFER_MINUTES), end: Math.min(24 * 60, span.start + duration + BUFFER_MINUTES) });
    }
    cursor = addDaysStr(cursor, 1);
  }
  return placements;
}

/**
 * Place sessions one per day until `totalMinutes` of study time has been
 * placed (or the horizon runs out) — for "I need N more minutes before this
 * is due" rather than "book me N sessions". Same rules as scheduleAsap
 * (buffer, preferred windows, 30-90 min per session); the last session is
 * trimmed so the total doesn't overshoot what was asked for.
 */
export async function scheduleMinutesAsap({
  userId, classId = null, totalMinutes, fromDate = null, horizonDate = null,
  minMinutes = MIN_SESSION_MINUTES, maxMinutes = MAX_SESSION_MINUTES,
}) {
  const start = fromDate || dateStr(new Date());
  const endDate = horizonDate || addDaysStr(start, SEARCH_HORIZON_DAYS);
  const windows = await getPreferredWindows(userId);
  const busyByDay = await getBusyBlocksForRange(userId, start, endDate, classId);

  const placements = [];
  let remaining = totalMinutes;
  let cursor = start;
  while (remaining > 0 && cursor <= endDate) {
    const spans = freeSpansForDay(busyByDay[cursor], windows);
    if (spans.length > 0) {
      const span = spans[0];
      const duration = Math.min(maxMinutes, Math.max(minMinutes, Math.min(span.end - span.start, remaining)));
      placements.push({ date: cursor, time: toTime(span.start), duration_minutes: duration });
      if (!busyByDay[cursor]) busyByDay[cursor] = [];
      busyByDay[cursor].push({ start: Math.max(0, span.start - BUFFER_MINUTES), end: Math.min(24 * 60, span.start + duration + BUFFER_MINUTES) });
      remaining -= duration;
    }
    cursor = addDaysStr(cursor, 1);
  }
  return placements;
}

/**
 * Book the standard set of prep sessions for an assignment/exam/quiz/project
 * — the one place this happens now. Used by the generateStudySchedule route
 * (student explicitly asks for it) AND by processLectureRecording.js's
 * auto-detection pipeline (Phase 4, 3 Sep 2026): a lecture that explicitly
 * names a due-dated deliverable books its own sessions immediately, through
 * this exact function, so an auto-created assignment is scheduled no
 * differently than one the student typed in by hand. Inserts rows directly;
 * returns how many were created. A due date already in the past books
 * nothing — there's nothing sensible to prep for.
 */
export async function bookAssignmentSessions({ userId, assignment }) {
  const today = dateStr(new Date());
  const dueDateStr = assignment.due_date instanceof Date ? dateStr(assignment.due_date) : assignment.due_date;
  if (!dueDateStr || dueDateStr < today) return 0;

  const daysUntil = Math.max(1, Math.ceil((new Date(`${dueDateStr}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000));
  const sessionCount = Math.min(Math.max(daysUntil, 3), 10);

  const placements = await scheduleAsap({
    userId, classId: assignment.class_id, count: sessionCount, fromDate: today, horizonDate: dueDateStr,
    minMinutes: MIN_SESSION_MINUTES, maxMinutes: MAX_SESSION_MINUTES,
  });

  const rows = placements.map((p, i) => ({
    assignment_id: assignment.id, user_id: userId, class_id: assignment.class_id,
    title: `${assignment.title} — Session ${i + 1}`,
    scheduled_date: p.date, scheduled_time: p.time, duration_minutes: p.duration_minutes,
    priority: i === placements.length - 1 ? 'high' : 'medium', status: 'scheduled', notes: null,
  }));

  // Exams and quizzes also get one dedicated final-review pass the day
  // before the due date (or the due date itself if the day-before is full).
  if (assignment.type === 'exam' || assignment.type === 'quiz') {
    const reviewFrom = addDaysStr(dueDateStr, -1);
    const [reviewPlacement] = await scheduleAsap({
      userId, classId: assignment.class_id, count: 1, fromDate: reviewFrom, horizonDate: dueDateStr, minMinutes: 30, maxMinutes: 45,
    });
    if (reviewPlacement) {
      rows.push({
        assignment_id: assignment.id, user_id: userId, class_id: assignment.class_id,
        title: `${assignment.title} — Final review`, scheduled_date: reviewPlacement.date, scheduled_time: reviewPlacement.time,
        duration_minutes: reviewPlacement.duration_minutes, priority: 'high', status: 'scheduled',
        notes: "Light review session — skim key concepts, don't go in depth.",
      });
    }
  }

  for (const row of rows) {
    await pool.query(
      `insert into study_sessions (assignment_id, user_id, class_id, title, scheduled_date, scheduled_time, duration_minutes, priority, status, notes)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [row.assignment_id, row.user_id, row.class_id, row.title, row.scheduled_date, row.scheduled_time, row.duration_minutes, row.priority, row.status, row.notes]);
  }
  return rows.length;
}
