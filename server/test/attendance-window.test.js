import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { findPastUnconfirmedSessions, sessionEndedAfterClassAdded } from '../../src/lib/attendance.js';

/**
 * 13 September 2026, 19:38: a first-year engineering student imported his
 * timetable on a Sunday evening and, before he had seen the Today page once,
 * was asked whether he had attended four classes — two on Thursday, two on
 * Friday. The app had not existed for him when they met. Across the live
 * data, 11 of the 25 attendance answers were to that question.
 *
 * The rule now: a session is askable only if it ended after the class was
 * added. The fixture below is his real schedule (course codes, rules and the
 * import timestamp as stored), trimmed to the courses that met that week.
 */

// Sunday 13 Sep 2026, 19:38 local — the moment "Confirm & Create Semester" returned.
const IMPORTED_AT = new Date(2026, 8, 13, 19, 38).toISOString();

const rule = (day, start_time, end_time, start_date, end_date) => ({ day, start_time, end_time, start_date, end_date, component: 'Lecture' });
const once = (day, start_time, end_time, specific_date) => ({ day, start_time, end_time, specific_date, component: 'Lecture' });

const classes = [
  { id: 'biol102', name: 'BIOL 102', created_at: IMPORTED_AT, meetings: [
    rule('Tue', '13:00', '14:20', '2026-09-08', '2026-09-24'), rule('Thu', '13:00', '14:20', '2026-09-08', '2026-09-24') ] },
  { id: 'ge102', name: 'GE 102', created_at: IMPORTED_AT, meetings: [
    rule('Tue', '11:30', '12:50', '2026-09-01', '2026-09-22'), rule('Thu', '11:30', '12:50', '2026-09-03', '2026-09-17'),
    once('Thu', '10:00', '11:20', '2026-09-10') ] },
  { id: 'ge140', name: 'GE 140', created_at: IMPORTED_AT, meetings: [
    rule('Fri', '11:00', '12:20', '2026-09-04', '2026-10-02'), once('Mon', '13:30', '16:20', '2026-09-14') ] },
  { id: 'math133', name: 'MATH 133', created_at: IMPORTED_AT, meetings: [
    rule('Fri', '09:30', '10:50', '2026-09-04', '2026-11-27'), rule('Mon', '09:30', '10:50', '2026-09-14', '2026-10-05') ] },
];

const ids = (sessions) => sessions.map((s) => `${s.classObj.id}@${s.date}`).sort();

test('nothing is asked the moment a timetable is imported', () => {
  // Sunday evening, right after the import. Thursday's and Friday's classes
  // are inside the three-day window and have no lecture or answer — and the
  // app did not exist for this student when they met.
  const sunday = new Date(2026, 8, 13, 19, 40);
  assert.deepEqual(findPastUnconfirmedSessions(classes, [], [], sunday), []);
});

test('the same schedule without the timestamp guard asks about four sessions', () => {
  // Proof the fixture would have prompted: with no created_at on the rows, the
  // pre-fix behaviour is preserved (a row that carries no timestamp is treated
  // as always tracked), and it is the four prompts the student actually saw.
  const untracked = classes.map(({ created_at, ...cls }) => cls);
  const sunday = new Date(2026, 8, 13, 19, 40);
  assert.deepEqual(ids(findPastUnconfirmedSessions(untracked, [], [], sunday)), [
    'biol102@2026-09-10', 'ge102@2026-09-10', 'ge140@2026-09-11', 'math133@2026-09-11',
  ]);
});

test('classes that met after the import are asked about, and only those', () => {
  // Monday 17:00: Friday is still inside the window but predates the import;
  // Monday's GE 140 (ended 16:20) and MATH 133 (ended 10:50) are askable.
  const monday = new Date(2026, 8, 14, 17, 0);
  assert.deepEqual(ids(findPastUnconfirmedSessions(classes, [], [], monday)), ['ge140@2026-09-14', 'math133@2026-09-14']);
});

test('today is only asked once the class has ended', () => {
  // Monday 15:00: MATH 133 ended at 10:50; GE 140 runs until 16:20.
  const monday = new Date(2026, 8, 14, 15, 0);
  assert.deepEqual(ids(findPastUnconfirmedSessions(classes, [], [], monday)), ['math133@2026-09-14']);
});

test('a lecture or an answer settles a session', () => {
  const monday = new Date(2026, 8, 14, 17, 0);
  const lectures = [{ class_id: 'math133', date: '2026-09-14' }];
  const attendance = [{ class_id: 'ge140', date: '2026-09-14', attended: false }];
  assert.deepEqual(findPastUnconfirmedSessions(classes, lectures, attendance, monday), []);
});

test('the window is still three days, newest first', () => {
  // Thursday 17 Sep evening: Mon 14 (GE 140, MATH 133), Tue 15 (BIOL 102,
  // GE 102), Wed 16 (nothing), Thu 17 today (BIOL 102, GE 102 both ended).
  // Sunday and earlier are out of the window regardless of the guard.
  const thursday = new Date(2026, 8, 17, 20, 0);
  const found = findPastUnconfirmedSessions(classes, [], [], thursday);
  assert.deepEqual(found.map((s) => s.date), [
    '2026-09-17', '2026-09-17', '2026-09-15', '2026-09-15', '2026-09-14', '2026-09-14',
  ]);
  assert.equal(found.some((s) => s.date < '2026-09-14'), false);
});

test('a session on the import day that ended earlier that day is not asked', () => {
  // Imported at 19:38; a class that ran 09:30–10:50 the same day predates it.
  const cls = { id: 'x', name: 'X', created_at: IMPORTED_AT, meetings: [once('Sun', '09:30', '10:50', '2026-09-13')] };
  assert.equal(sessionEndedAfterClassAdded(cls, '2026-09-13', '10:50'), false);
  assert.equal(sessionEndedAfterClassAdded(cls, '2026-09-13', '20:00'), true);
  // No end time is read generously — end of day — so it can only ever mean "ask".
  assert.equal(sessionEndedAfterClassAdded(cls, '2026-09-13', ''), true);
  assert.equal(sessionEndedAfterClassAdded(cls, '2026-09-12', ''), false);
});

test('the compatibility client timestamp name works too', () => {
  const cls = { id: 'y', name: 'Y', created_date: IMPORTED_AT, meetings: [once('Sat', '09:00', '10:00', '2026-09-12')] };
  assert.equal(sessionEndedAfterClassAdded(cls, '2026-09-12', '10:00'), false);
});

test('the prompt reads its sessions from the tested module', () => {
  // The component must not grow its own copy of the walk again: the guard
  // lives in one place, and that place is under test.
  const PROMPT = fs.readFileSync(new URL('../../src/components/AttendancePrompt.jsx', import.meta.url), 'utf8');
  assert.match(PROMPT, /import \{ findPastUnconfirmedSessions \} from '@\/lib\/attendance';/);
  assert.doesNotMatch(PROMPT, /function findPastUnconfirmedSessions/);
  assert.doesNotMatch(PROMPT, /getClassMeetingsForDate/);
});
