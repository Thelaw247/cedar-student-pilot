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
//      rather than stacked. Counted across EVERYTHING already on the day,
//      not just the sessions this run places: three lectures recorded on a
//      Thursday used to book three reviews into that one evening, because
//      each booking call only knew about its own placements.
//   3. Every session is 30-90 minutes, sized to the gap it lands in.
//   4. A BUFFER_MINUTES cushion surrounds every busy block — a class, a
//      calendar event, or an already-placed session — so nothing is booked
//      back-to-back with zero travel time.
//   5. Sessions only land inside the student's preferred windows (Settings >
//      Review Schedule, profiles.preferred_study_times). No preference set →
//      a sane default window, so nothing breaks for a student who hasn't
//      configured one yet. Overlapping windows are merged first, so two
//      preferred times an hour apart describe one continuous window rather
//      than two that each think they own the same minutes.
//   6. A caller placing several sessions in one go must pass every placement
//      it has not yet written back as `reserved`. Placements live in memory
//      until the caller inserts them, so a second search would otherwise
//      re-read the database, see nothing, and hand back a slot it already
//      gave away — which is exactly how every exam booked its final review
//      on top of one of its own study sessions.

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
  return mergeWindows(times
    .map((t) => { const m = toMin(t); return { start: Math.max(0, m - WINDOW_RADIUS_MINUTES), end: Math.min(24 * 60, m + WINDOW_RADIUS_MINUTES) }; }));
}

/**
 * Collapse overlapping or touching windows into one.
 *
 * Two preferred times 60 minutes apart open two 180-minute windows that
 * share most of their minutes. Left separate, freeSpansForDay walks each one
 * and returns a free span from both, so the same minutes are offered twice
 * and the day's "earliest span" is whichever duplicate sorts first. Merging
 * makes the windows describe the day once.
 */
export function mergeWindows(windows) {
  const sorted = [...windows].sort((a, b) => a.start - b.start);
  const merged = [];
  for (const w of sorted) {
    const last = merged[merged.length - 1];
    if (last && w.start <= last.end) last.end = Math.max(last.end, w.end);
    else merged.push({ ...w });
  }
  return merged;
}

/**
 * The day-by-day picture a placement search works against: `busy` holds the
 * buffered blocks, `sessions` counts how many study sessions each day already
 * holds. The count is what enforces rule 2 across separate booking runs —
 * busy blocks alone only push a new session later in the same evening, which
 * is how a student ended up with four of them between 4pm and 8pm.
 *
 * classId narrows to one class's meetings; omit it to pull every class (used
 * when booking isn't tied to a single course).
 */
async function getDayPicture(userId, startDate, endDate, classId = null) {
  const busy = {};
  const sessionCounts = {};
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
      if (sDate === ds) {
        sessionCounts[ds] = (sessionCounts[ds] || 0) + 1;
        if (s.scheduled_time) {
          const start = toMin(s.scheduled_time);
          add(ds, start, start + (Number(s.duration_minutes) || 60));
        }
      }
    }
  }
  return { busy, sessionCounts };
}

/**
 * Fold placements the caller is holding but has not written yet into a day
 * picture, so the next search sees them. Same shape a search returns, so a
 * caller can hand its own output straight back in as `reserved`.
 */
function reserve(picture, placements) {
  for (const p of placements || []) {
    if (!p?.date) continue;
    picture.sessionCounts[p.date] = (picture.sessionCounts[p.date] || 0) + 1;
    if (!p.time) continue;
    const start = toMin(p.time);
    if (start == null) continue;
    if (!picture.busy[p.date]) picture.busy[p.date] = [];
    picture.busy[p.date].push({
      start: Math.max(0, start - BUFFER_MINUTES),
      end: Math.min(24 * 60, start + (Number(p.duration_minutes) || 60) + BUFFER_MINUTES),
    });
  }
  return picture;
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
 * The placement loop itself, with no database in it: walk the days from
 * `fromDate` to `endDate` and take the earliest span that fits, at most
 * `maxPerDay` sessions per day. Stops when `count` sessions are placed or
 * `totalMinutes` of study time has been, whichever the caller asked for.
 *
 * Pure on purpose — every rule that decides where a session lands is
 * testable here without a database, which is what the overlap bug needed and
 * did not have.
 */
export function placeSessions({
  picture, windows, fromDate, endDate,
  count = Infinity, totalMinutes = Infinity,
  minMinutes = MIN_SESSION_MINUTES, maxMinutes = MAX_SESSION_MINUTES, maxPerDay = 1,
}) {
  const placements = [];
  let remaining = totalMinutes;
  let cursor = fromDate;

  while (placements.length < count && remaining > 0 && cursor <= endDate) {
    if ((picture.sessionCounts[cursor] || 0) < maxPerDay) {
      // Prefer the earliest window of the day that fits — keeps sessions
      // anchored near the student's stated preference rather than drifting
      // to whichever window happens to be least full.
      const [span] = freeSpansForDay(picture.busy[cursor], windows);
      if (span) {
        const room = span.end - span.start;
        const duration = Math.min(maxMinutes, Math.max(minMinutes, Math.min(room, remaining)));
        const placement = { date: cursor, time: toTime(span.start), duration_minutes: duration };
        placements.push(placement);
        reserve(picture, [placement]);
        remaining -= duration;
      }
    }
    cursor = addDaysStr(cursor, 1);
  }
  return placements;
}

async function search(opts, limits) {
  const start = opts.fromDate || dateStr(new Date());
  const endDate = opts.horizonDate || addDaysStr(start, SEARCH_HORIZON_DAYS);
  const windows = await getPreferredWindows(opts.userId);
  const picture = reserve(await getDayPicture(opts.userId, start, endDate, opts.classId ?? null), opts.reserved);
  return placeSessions({
    picture, windows, fromDate: start, endDate,
    minMinutes: opts.minMinutes ?? MIN_SESSION_MINUTES,
    maxMinutes: opts.maxMinutes ?? MAX_SESSION_MINUTES,
    maxPerDay: opts.maxPerDay ?? 1,
    ...limits,
  });
}

/**
 * Place up to `count` sessions, one per calendar day, starting from
 * `fromDate` (default today) through `horizonDate` (default +60 days). Each
 * placement is sized between minMinutes and maxMinutes to fit the gap it
 * lands in. Returns the placements — this does NOT insert rows; callers
 * decide what row shape to write (a lecture review, a project step, a study
 * session), since the fields differ per caller.
 *
 * Pass `reserved` if you are still holding placements from an earlier call
 * that have not been inserted yet (rule 6).
 */
export async function scheduleAsap(opts) {
  return search(opts, { count: opts.count ?? 1 });
}

/**
 * Place sessions one per day until `totalMinutes` of study time has been
 * placed (or the horizon runs out) — for "I need N more minutes before this
 * is due" rather than "book me N sessions". Same rules as scheduleAsap
 * (buffer, preferred windows, one a day, 30-90 min per session).
 *
 * The total lands on or just above the ask, never below it: a session is
 * never shorter than MIN_SESSION_MINUTES, so a 200-minute request becomes
 * 90 + 90 + 30. fitProjectTime treats anything short of the ask as "your
 * calendar is too full" and offers things to bump, so rounding the last
 * session up is what keeps that answer truthful.
 */
export async function scheduleMinutesAsap(opts) {
  return search(opts, { totalMinutes: opts.totalMinutes });
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

  // Book once. Both callers create the assignment and immediately book for
  // it, so a second run means a retry or a duplicate detection, not a
  // request for a second set — and a second set is a whole extra column of
  // sessions the student never asked for. Same guard scheduleLectureReview
  // uses for a re-processed lecture.
  const already = await pool.query(
    "select 1 from study_sessions where assignment_id = $1 and user_id = $2 and status != 'skipped' limit 1",
    [assignment.id, userId],
  );
  if (already.rows.length > 0) return 0;

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
  // `placements` are still in memory — nothing above has been inserted yet —
  // so this second search has to be told about them. Without `reserved` it
  // re-read the database, saw the day before the exam as empty, and handed
  // back the slot it had just given Session N. For anything due inside ten
  // days that day always holds a session, so every exam and quiz booked its
  // own final review directly on top of one.
  if (assignment.type === 'exam' || assignment.type === 'quiz') {
    const reviewFrom = addDaysStr(dueDateStr, -1);
    const [reviewPlacement] = await scheduleAsap({
      userId, classId: assignment.class_id, count: 1, fromDate: reviewFrom, horizonDate: dueDateStr,
      minMinutes: 30, maxMinutes: 45, reserved: placements,
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
