import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveAssignmentLectures, COVERAGE_SCOPES, COVERAGE_SCOPE_LABEL } from '../../shared/assignmentScope.js';

/**
 * Phase 1: one answer to "which lectures does this deadline cover?"
 *
 * The question had exactly one implementation — eleven lines inside
 * generateClassHandbook — and every other feature that needed it guessed or
 * ignored it. Those eleven lines also got 'since_last' wrong: they took the
 * previous assignment of ANY type, so a weekly problem set due last Tuesday
 * reset the window and a midterm thought it covered four days of material.
 *
 * Pure and I/O-free, which is what makes every rule below testable at all —
 * the version living inside a route handler never was.
 */

const L = (id, date) => ({ id, date });
const LECTURES = [
  L('a', '2026-09-01'), L('b', '2026-09-08'), L('c', '2026-09-15'),
  L('d', '2026-09-22'), L('e', '2026-09-29'), L('f', '2026-10-06'),
];
const ids = (rows) => rows.map((r) => r.id);

test('cumulative stops at the due date', () => {
  // An exam cannot cover material taught after it. The handbook used to sweep
  // in every lecture in the class, including ones recorded weeks later.
  const exam = { id: 'x', due_date: '2026-09-22', coverage_scope: 'cumulative' };
  assert.deepEqual(ids(resolveAssignmentLectures(exam, LECTURES)), ['a', 'b', 'c', 'd']);
});

test('the result is in teaching order, whatever order it arrived in', () => {
  // Callers load lectures 'order by date desc' as often as ascending, and
  // every consumer downstream — sessions, chapters, review questions — means
  // "earliest material first".
  const exam = { id: 'x', due_date: '2026-10-31', coverage_scope: 'cumulative' };
  assert.deepEqual(ids(resolveAssignmentLectures(exam, [...LECTURES].reverse())), ['a', 'b', 'c', 'd', 'e', 'f']);
});

test('since_last measures from the previous exam or quiz, not the previous anything', () => {
  const priors = [
    { id: 'p1', type: 'quiz', due_date: '2026-09-08' },
    { id: 'p2', type: 'assignment', due_date: '2026-09-20' }, // must be ignored
  ];
  const midterm = { id: 'x', due_date: '2026-09-29', coverage_scope: 'since_last' };
  assert.deepEqual(ids(resolveAssignmentLectures(midterm, LECTURES, priors)), ['b', 'c', 'd', 'e']);
  // The old rule would have started at the 20th and covered one lecture.
  assert.notDeepEqual(ids(resolveAssignmentLectures(midterm, LECTURES, priors)), ['e']);
});

test('since_last with no earlier exam covers the course so far', () => {
  // Which is what a first midterm covers anyway — returning nothing would be
  // an empty handbook and zero booked sessions.
  const first = { id: 'x', due_date: '2026-09-22', coverage_scope: 'since_last' };
  assert.deepEqual(ids(resolveAssignmentLectures(first, LECTURES, [])), ['a', 'b', 'c', 'd']);
  assert.deepEqual(ids(resolveAssignmentLectures(first, LECTURES, [{ id: 'p', type: 'assignment', due_date: '2026-09-10' }])), ['a', 'b', 'c', 'd']);
});

test('an exam never counts itself as its own previous exam', () => {
  const exam = { id: 'x', due_date: '2026-09-22', coverage_scope: 'since_last' };
  assert.deepEqual(ids(resolveAssignmentLectures(exam, LECTURES, [exam])), ['a', 'b', 'c', 'd']);
});

test('custom uses the stored list', () => {
  const exam = { id: 'x', due_date: '2026-10-31', coverage_scope: 'custom', lecture_ids: ['b', 'e'] };
  assert.deepEqual(ids(resolveAssignmentLectures(exam, LECTURES)), ['b', 'e']);
});

test('custom with nothing picked means nobody has picked yet', () => {
  // Not "this exam covers no material". Every deadline created before the
  // picker existed is in exactly this state.
  const exam = { id: 'x', due_date: '2026-09-15', coverage_scope: 'custom', lecture_ids: [] };
  assert.deepEqual(ids(resolveAssignmentLectures(exam, LECTURES)), ['a', 'b', 'c']);
});

test('a deadline with no due date covers everything, and nothing crashes on junk', () => {
  assert.equal(resolveAssignmentLectures({ coverage_scope: 'cumulative' }, LECTURES).length, 6);
  assert.deepEqual(resolveAssignmentLectures(null, null), []);
  assert.deepEqual(resolveAssignmentLectures({ due_date: '2026-09-22' }, [null, { id: 'z' }]), []);
  // An unknown scope behaves as cumulative rather than returning nothing.
  const odd = { id: 'x', due_date: '2026-09-15', coverage_scope: 'nonsense' };
  assert.deepEqual(ids(resolveAssignmentLectures(odd, LECTURES)), ['a', 'b', 'c']);
});

test('dates survive arriving as Date objects', () => {
  // The server hands DATE back as a string, but a caller that did not go
  // through that parser must not silently return everything.
  const exam = { id: 'x', due_date: new Date('2026-09-15T00:00:00Z'), coverage_scope: 'cumulative' };
  const asDates = LECTURES.map((l) => ({ ...l, date: new Date(`${l.date}T00:00:00Z`) }));
  assert.deepEqual(ids(resolveAssignmentLectures(exam, asDates)), ['a', 'b', 'c']);
});

test('the scope list matches what the database allows', () => {
  // A fourth value here without the CHECK constraint to match would be
  // rejected at write time, after the student filled the form in.
  assert.deepEqual(COVERAGE_SCOPES, ['cumulative', 'since_last', 'custom']);
  assert.deepEqual(Object.keys(COVERAGE_SCOPE_LABEL), COVERAGE_SCOPES);
  const migration = fs.readFileSync(
    new URL('../../supabase/migrations/20260821191705_core_academic_entities.sql', import.meta.url), 'utf8');
  for (const scope of COVERAGE_SCOPES) assert.match(migration, new RegExp(`'${scope}'`));
});

test('the handbook uses the resolver instead of its own copy', () => {
  const route = fs.readFileSync(new URL('../routes/generateClassHandbook.js', import.meta.url), 'utf8');
  assert.match(route, /import \{ resolveAssignmentLectures \} from '\.\.\/\.\.\/shared\/assignmentScope\.js'/);
  assert.match(route, /lectures = resolveAssignmentLectures\(asgn, lectures, priors\)/);
  // The eleven lines it replaces, gone rather than left beside it.
  assert.doesNotMatch(route, /coverage_scope === 'since_last'/);
  assert.doesNotMatch(route, /lastExamDate/);
});

test('both forms can now say what a deadline covers, and store it', () => {
  const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
  for (const [name, src] of [
    ['ClassDetail', read('../../src/pages/ClassDetail.jsx')],
    ['AddExamOrStudyModal', read('../../src/components/AddExamOrStudyModal.jsx')],
  ]) {
    // Options come from the shared map, so a form cannot offer a scope the
    // resolver does not implement.
    assert.match(src, /Object\.entries\(COVERAGE_SCOPE_LABEL\)\.map/, `${name}: hand-written options`);
    // 'Specific lectures' actually picks lectures now.
    assert.match(src, /<LectureScopePicker/, `${name}: custom has no picker`);
    assert.match(src, /lecture_ids: form\.coverage_scope === 'custom' \? explicitScopeIds\(scopeIds, lectures\) : \[\]/, `${name}: the picked lectures are not stored`);
  }
});

test('"select all" is stored as real ids, and "none" as empty', () => {
  const src = fs.readFileSync(new URL('../../src/components/LectureScopePicker.jsx', import.meta.url), 'utf8');
  assert.match(src, /export function explicitScopeIds/);
  // The picker's own shorthand — [] means whole class — cannot be stored as
  // is, because an empty column means "not picked yet" to the resolver.
  assert.match(src, /if \(resolved\.length === 0\) return lectures\.map\(l => l\.id\)/);
  assert.match(src, /if \(resolved === null\) return \[\]/);
});
