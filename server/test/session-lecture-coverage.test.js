import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { distributeLectures, describeSession } from '../lib/studyScheduler.js';

/**
 * Phase 2: a booked session says what it is for.
 *
 * bookAssignmentSessions produced ten rows called "Midterm — Session 1…10",
 * each covering nothing in particular, so a student opening one had to decide
 * what to study and Praelecta could not tell them what they had already
 * covered. It now resolves the deadline's lectures (phase 1) and deals them
 * across the sessions it actually placed.
 */

const LIB = fs.readFileSync(new URL('../lib/studyScheduler.js', import.meta.url), 'utf8');
const PLANNER = fs.readFileSync(new URL('../../src/pages/StudyPlanner.jsx', import.meta.url), 'utf8');
const L = (n) => Array.from({ length: n }, (_, i) => `l${i + 1}`);
const flat = (groups) => groups.flat();

test('more lectures than sessions: contiguous, balanced, earliest first', () => {
  // A session should be a block of the course, not a scattering of it.
  const out = distributeLectures(L(9), 4);
  assert.deepEqual(out.map((g) => g.length), [3, 2, 2, 2]);
  assert.deepEqual(flat(out), L(9), 'teaching order was not preserved');
  for (const group of out) {
    const nums = group.map((id) => Number(id.slice(1)));
    assert.deepEqual(nums, nums.slice().sort((a, b) => a - b), 'a chunk is not contiguous');
  }
});

test('every lecture lands somewhere, exactly once', () => {
  for (const [n, sessions] of [[9, 4], [10, 10], [7, 3], [1, 1]]) {
    const out = distributeLectures(L(n), sessions);
    assert.equal(out.length, sessions);
    assert.deepEqual(flat(out).slice().sort(), L(n).slice().sort(), `${n} lectures over ${sessions} sessions`);
  }
});

test('fewer lectures than sessions: they cycle rather than leaving sessions empty', () => {
  // Four empty sessions is what the student had before. Spaced passes over
  // the same material is the reason a week of prep beats one long night.
  const out = distributeLectures(L(3), 7);
  assert.deepEqual(out, [['l1'], ['l2'], ['l3'], ['l1'], ['l2'], ['l3'], ['l1']]);
  for (const group of out) assert.equal(group.length, 1);
});

test('no lectures means no scope, and nothing breaks', () => {
  // A class with nothing processed yet. Every session books exactly as it did
  // before this phase existed.
  assert.deepEqual(distributeLectures([], 3), [[], [], []]);
  assert.deepEqual(distributeLectures(null, 2), [[], []]);
  assert.deepEqual(distributeLectures(L(3), 0), []);
  assert.deepEqual(distributeLectures([null, 'l1', undefined], 1), [['l1']]);
});

test('the lectures are dealt across the sessions actually placed', () => {
  // A full calendar returns fewer placements than requested. Dealing against
  // the requested count would drop the last lectures off the end.
  assert.match(LIB, /distributeLectures\(covered\.map\(\(l\) => l\.id\), placements\.length\)/);
  // sessionCount is what we ASK the scheduler for; placements.length is what
  // it could fit. Only the second one may reach the distribution.
  const call = LIB.slice(LIB.indexOf('const perSession ='), LIB.indexOf('const rows ='));
  assert.doesNotMatch(call, /sessionCount/);
});

test('the scope comes from the shared resolver, not a second copy', () => {
  assert.match(LIB, /import \{ resolveAssignmentLectures \} from '\.\.\/\.\.\/shared\/assignmentScope\.js'/);
  assert.match(LIB, /const covered = resolveAssignmentLectures\(assignment, classLectures, priorAssignments\)/);
  // since_last needs the earlier deadlines to measure from.
  assert.match(LIB, /select id, type, due_date from assignments where class_id = \$1 and user_id = \$2 and due_date < \$3/);
});

test('a session is named after what it covers', () => {
  const one = describeSession('Midterm', [{ id: 'a', ai_title: 'Cellular Respiration' }], 0);
  assert.equal(one.title, 'Midterm — Cellular Respiration');
  assert.equal(one.notes, 'Covers: Cellular Respiration');

  // Several read as the first plus a count: a title listing nine lecture
  // names is not a title. The full list still goes in the note, which the
  // planner already renders under the title.
  const many = describeSession('Midterm', [
    { id: 'a', ai_title: 'Cellular Respiration' },
    { id: 'b', ai_title: 'Enzyme Kinetics' },
    { id: 'c', ai_title: 'Photosynthesis' },
  ], 2);
  assert.equal(many.title, 'Midterm — Cellular Respiration + 2 more');
  assert.equal(many.notes, 'Covers: Cellular Respiration, Enzyme Kinetics, Photosynthesis');
});

test('a lecture with no title is named by its date, not left blank', () => {
  // ai_title is null until a recording is processed, and a session called
  // "Midterm — " helps nobody.
  const unprocessed = describeSession('Midterm', [{ id: 'a', date: '2026-09-15' }], 0);
  assert.equal(unprocessed.title, 'Midterm — Lecture from 2026-09-15');
  const nothing = describeSession('Midterm', [{ id: 'a' }], 0);
  assert.equal(nothing.title, 'Midterm — a lecture');
});

test('a session covering nothing keeps the numbering it always had', () => {
  const empty = describeSession('Midterm', [], 2);
  assert.equal(empty.title, 'Midterm — Session 3');
  assert.equal(empty.notes, null, 'an empty note would badge the session and say nothing');
});

test('a title made of two free-text fields cannot run away', () => {
  const long = describeSession('X'.repeat(200), [{ id: 'a', ai_title: 'Y'.repeat(200) }], 0);
  assert.ok(long.title.length <= 120, `title was ${long.title.length} chars`);
  assert.ok(long.title.endsWith('…'), 'a truncated title should say it was truncated');
});

test('the final review covers the whole scope', () => {
  const finalReview = LIB.slice(LIB.indexOf("title: `${assignment.title} — Final review`"));
  assert.match(finalReview.slice(0, 600), /lecture_ids: covered\.map\(\(l\) => l\.id\)/);
});

test('the insert carries lecture_ids and still balances', () => {
  const start = LIB.indexOf('insert into study_sessions (assignment_id');
  const stmt = LIB.slice(start, LIB.indexOf(');', start));
  assert.match(stmt, /notes, lecture_ids\)/);
  assert.match(stmt, /\$11::uuid\[\]/, 'a uuid[] parameter needs its cast');
  const columns = stmt.slice(stmt.indexOf('(') + 1, stmt.indexOf(')')).split(',').length;
  const valuesClause = stmt.slice(stmt.indexOf('values ('));
  const values = valuesClause.slice(valuesClause.indexOf('(') + 1, valuesClause.lastIndexOf(')')).split(',').length;
  assert.equal(columns, values, `${columns} columns but ${values} values`);
});

test('the planner badge stops calling every described session a Review', () => {
  // It read "has notes", and prep sessions now carry a note describing what
  // they cover. session_type is the column that actually means this.
  assert.match(PLANNER, /\) : s\.session_type === 'review' && \(/);
  assert.doesNotMatch(PLANNER, /\) : sessionDescription\(s\) && \(/);
  // The description itself still renders under the title, which is where the
  // covered lectures show up without a new component.
  assert.match(PLANNER, /\{sessionDescription\(s\) && <p className="text-sm text-muted-foreground mt-1\.5">/);
});
