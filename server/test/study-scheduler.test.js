import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { placeSessions, mergeWindows, addDaysStr, MIN_SESSION_MINUTES, MAX_SESSION_MINUTES } from '../lib/studyScheduler.js';

/**
 * Sessions were landing on top of each other. Two causes, both from the same
 * blind spot: a placement search only knew what was already in the database.
 *
 *  1. bookAssignmentSessions places the study sessions, then searches AGAIN
 *     for the exam's final review — before inserting any of them. The second
 *     search re-read the database, saw the day before the exam as free, and
 *     handed back the slot it had just given the last study session. For
 *     anything due within ten days that day always holds one, so every exam
 *     and quiz booked its final review directly on top of its own session.
 *  2. Rule 2 ("one session per calendar day") was only ever true within a
 *     single call. Three lectures recorded on one Thursday booked three
 *     reviews into that Thursday evening, each call politely placing itself
 *     after the last one's buffer. Live data showed four sessions between
 *     16:00 and 20:00 on 4 Sep for one student.
 *
 * The placement loop is pure now, so both are testable without a database.
 */

const WINDOW = [{ start: 16 * 60, end: 21 * 60 }]; // the 4pm-9pm default
const empty = () => ({ busy: {}, sessionCounts: {} });
const at = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

function occupied(date, time, minutes) {
  const start = at(time);
  return {
    busy: { [date]: [{ start: start - 30, end: start + minutes + 30 }] },
    sessionCounts: { [date]: 1 },
  };
}

// Do two placements share a minute?
const clash = (a, b) => a.date === b.date
  && at(a.time) < at(b.time) + b.duration_minutes
  && at(b.time) < at(a.time) + a.duration_minutes;

test('nothing a run places overlaps anything else it places', () => {
  const out = placeSessions({ picture: empty(), windows: WINDOW, fromDate: '2026-09-04', endDate: '2026-09-20', count: 10 });
  assert.equal(out.length, 10);
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) assert.equal(clash(out[i], out[j]), false, `${out[i].date} ${out[i].time} clashes`);
  }
});

test('a placement is reserved the moment it is made, not when it is written', () => {
  // This is the exam bug in miniature: search once, then search the same day
  // again while still holding the first result. The second search must see it.
  const picture = empty();
  const [first] = placeSessions({ picture, windows: WINDOW, fromDate: '2026-09-10', endDate: '2026-09-10', count: 1 });
  assert.ok(first, 'the day was free, something should have been placed');
  const second = placeSessions({ picture, windows: WINDOW, fromDate: '2026-09-10', endDate: '2026-09-10', count: 1 });
  assert.deepEqual(second, [], 'the day already holds this run’s own session');
});

test('the exam booker hands its unwritten placements to the final-review search', () => {
  // The fix is one argument. Without it the second scheduleAsap re-reads the
  // database, which does not yet contain the sessions above it.
  const LIB = fs.readFileSync(new URL('../lib/studyScheduler.js', import.meta.url), 'utf8');
  const finalReview = LIB.slice(LIB.indexOf("if (assignment.type === 'exam'"), LIB.indexOf('// Exams and quizzes') + 4000);
  assert.match(finalReview, /reserved: placements/, 'the final review is searched blind again');
  // And the engine must actually honour it.
  const picture = empty();
  const held = [{ date: '2026-09-12', time: '16:00', duration_minutes: 90 }];
  const out = placeSessions({
    picture: { busy: {}, sessionCounts: {}, ...reserveInto(picture, held) },
    windows: WINDOW, fromDate: '2026-09-12', endDate: '2026-09-12', count: 1,
  });
  assert.deepEqual(out, [], 'a held placement did not block its own day');
});

// The module reserves internally; this mirrors it for the assertion above.
function reserveInto(picture, placements) {
  for (const p of placements) {
    picture.sessionCounts[p.date] = (picture.sessionCounts[p.date] || 0) + 1;
    (picture.busy[p.date] ||= []).push({ start: at(p.time) - 30, end: at(p.time) + p.duration_minutes + 30 });
  }
  return picture;
}

test('one session per day counts what the day already holds', () => {
  // Not "one per call". A day with an existing session is skipped entirely,
  // rather than having a second session tucked in after its buffer — which
  // is how one evening ended up holding four.
  const picture = occupied('2026-09-04', '16:00', 20);
  const [placement] = placeSessions({ picture, windows: WINDOW, fromDate: '2026-09-04', endDate: '2026-09-08', count: 1 });
  assert.equal(placement.date, '2026-09-05', 'a second session was stacked onto a day that already had one');
});

test('a busy block that is not a session still only moves the session, not the day', () => {
  // A class or a calendar event is not a study session: it buffers the slot
  // but must not cost the student the whole day.
  const picture = { busy: { '2026-09-04': [{ start: at('15:30'), end: at('17:00') }] }, sessionCounts: {} };
  const [placement] = placeSessions({ picture, windows: WINDOW, fromDate: '2026-09-04', endDate: '2026-09-04', count: 1 });
  assert.equal(placement.date, '2026-09-04');
  assert.equal(placement.time, '17:00');
});

test('every placement keeps the 30-minute cushion around what is already booked', () => {
  const picture = { busy: { '2026-09-04': [{ start: at('16:00') - 30, end: at('17:00') + 30 }] }, sessionCounts: {} };
  const [placement] = placeSessions({ picture, windows: WINDOW, fromDate: '2026-09-04', endDate: '2026-09-04', count: 1 });
  assert.equal(placement.time, '17:30');
});

test('sessions stay inside the preferred window and inside the length bounds', () => {
  const out = placeSessions({ picture: empty(), windows: WINDOW, fromDate: '2026-09-04', endDate: '2026-09-09', count: 5 });
  for (const p of out) {
    assert.ok(at(p.time) >= WINDOW[0].start, `${p.time} is before the window opens`);
    assert.ok(at(p.time) + p.duration_minutes <= WINDOW[0].end, `${p.time} runs past the window`);
    assert.ok(p.duration_minutes >= MIN_SESSION_MINUTES && p.duration_minutes <= MAX_SESSION_MINUTES);
  }
});

test('a minutes budget is met, and met one day at a time', () => {
  // 200 minutes is 90 + 90 + 30: the remainder rounds up to the minimum
  // session rather than booking a 20-minute stub. fitProjectTime reads
  // anything below the ask as "no room, here's what you could bump", so
  // undershooting would put a false answer in front of the student.
  const out = placeSessions({ picture: empty(), windows: WINDOW, fromDate: '2026-09-04', endDate: '2026-09-30', totalMinutes: 200 });
  const total = out.reduce((n, p) => n + p.duration_minutes, 0);
  assert.ok(total >= 200, 'the ask was not met');
  assert.ok(total - 200 < MIN_SESSION_MINUTES, `overshot by ${total - 200} minutes`);
  assert.equal(new Set(out.map((p) => p.date)).size, out.length, 'the budget was spent by stacking one day');
});

test('a full calendar returns nothing rather than looping or double-booking', () => {
  const picture = empty();
  for (let i = 0; i < 5; i++) picture.sessionCounts[addDaysStr('2026-09-04', i)] = 1;
  assert.deepEqual(placeSessions({ picture, windows: WINDOW, fromDate: '2026-09-04', endDate: '2026-09-08', count: 3 }), []);
});

test('overlapping preferred windows describe the day once', () => {
  // "19:00" and "20:00" open 17:30-20:30 and 18:30-21:30. Left separate,
  // freeSpansForDay walks both and offers the same minutes twice.
  assert.deepEqual(mergeWindows([{ start: 1050, end: 1230 }, { start: 1110, end: 1290 }]), [{ start: 1050, end: 1290 }]);
  // Distinct windows are left alone.
  assert.equal(mergeWindows([{ start: 480, end: 600 }, { start: 960, end: 1260 }]).length, 2);
  // Touching windows join rather than leaving a zero-width seam.
  assert.deepEqual(mergeWindows([{ start: 0, end: 60 }, { start: 60, end: 120 }]), [{ start: 0, end: 120 }]);
});

test('an assignment is only booked once', () => {
  const LIB = fs.readFileSync(new URL('../lib/studyScheduler.js', import.meta.url), 'utf8');
  const fn = LIB.slice(LIB.indexOf('export async function bookAssignmentSessions'));
  assert.match(fn, /select 1 from study_sessions where assignment_id = \$1/);
  assert.ok(fn.indexOf('already.rows.length > 0') < fn.indexOf('const placements'), 'the guard must run before anything is placed');
});

test('a lecture review has room to fall to a later day', () => {
  // With one session per day enforced, a day holding three lectures can only
  // take one review. The other two need somewhere to go or they vanish.
  const ROUTE = fs.readFileSync(new URL('../routes/processLectureRecording.js', import.meta.url), 'utf8');
  assert.match(ROUTE, /horizonDate: addDaysStr\(lectureDate, 3\)/);
  assert.match(ROUTE, /select 1 from study_sessions where lecture_id = \$1/, 'a reprocessed lecture must not book a second review');
});

/**
 * And the last way two sessions can appear to overlap without overlapping:
 * the day view draws a short block taller than it is, so it reaches into the
 * next one. At 56px an hour the 28px floor is worth half an hour — a
 * 20-minute lecture review drawn at the floor covers 16:00 to 16:30 even
 * though it ends at 16:20.
 */
test('a short block never draws over the block after it', () => {
  const TIMELINE = fs.readFileSync(new URL('../../src/components/Timeline.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(TIMELINE, /const height = Math\.max\(28,/, 'the floor is applied without looking at what follows');
  assert.match(TIMELINE, /const room = nextTop == null \? Infinity : Math\.max\(0, nextTop - top - 2\)/);
  assert.match(TIMELINE, /Math\.max\(Math\.min\(MIN_BLOCK_HEIGHT, room\), Math\.min\(trueHeight, room\)\)/);
  // The floor still applies when there is room for it.
  assert.match(TIMELINE, /const MIN_BLOCK_HEIGHT = 28;/);
});
