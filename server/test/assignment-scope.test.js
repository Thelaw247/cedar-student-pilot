import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  resolveAssignmentLectures, COVERAGE_SCOPES, COVERAGE_SCOPE_LABEL,
  coverageScopeLabel, defaultCoverageScope, coveragePresetsFor,
} from '../../shared/assignmentScope.js';

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
  // A sixth value here without the CHECK constraint to match would be
  // rejected at write time, after the student filled the form in.
  assert.deepEqual(COVERAGE_SCOPES, ['cumulative', 'since_last', 'custom', 'all', 'none']);
  assert.deepEqual(Object.keys(COVERAGE_SCOPE_LABEL).sort(), [...COVERAGE_SCOPES].sort());
  const original = fs.readFileSync(
    new URL('../../supabase/migrations/20260821191705_core_academic_entities.sql', import.meta.url), 'utf8');
  const widened = fs.readFileSync(
    new URL('../../supabase/migrations/20260908000000_deadlines_that_cover_nothing.sql', import.meta.url), 'utf8');
  for (const scope of ['cumulative', 'since_last', 'custom']) assert.match(original, new RegExp(`'${scope}'`));
  // The widening migration has to name every value, not only the new two —
  // it replaces the constraint rather than adding to it.
  for (const scope of COVERAGE_SCOPES) assert.match(widened, new RegExp(`'${scope}'::text`));
});

test('none covers nothing, whatever the due date says', () => {
  // The reason this is checked before the due date: a deadline that covers
  // no lectures covers none of them whether or not it is dated, and the
  // no-due-date branch above returns everything.
  assert.deepEqual(resolveAssignmentLectures({ due_date: '2026-09-15', coverage_scope: 'none' }, LECTURES), []);
  assert.deepEqual(resolveAssignmentLectures({ coverage_scope: 'none' }, LECTURES), []);
});

test('all covers lectures taught after the due date too', () => {
  // Which is the whole difference from cumulative, and the reason a student
  // ticking every box by hand was not the same answer: their list froze, and
  // this one does not.
  const takeHome = { id: 'x', due_date: '2026-09-15', coverage_scope: 'all' };
  assert.deepEqual(ids(resolveAssignmentLectures(takeHome, LECTURES)), ['a', 'b', 'c', 'd', 'e', 'f']);
  assert.deepEqual(ids(resolveAssignmentLectures({ ...takeHome, coverage_scope: 'cumulative' }, LECTURES)), ['a', 'b', 'c']);
});

test('a new assignment covers nothing and a new exam covers everything up to it', () => {
  assert.equal(defaultCoverageScope('assignment'), 'none');
  assert.equal(defaultCoverageScope('project'), 'none');
  assert.equal(defaultCoverageScope('exam'), 'cumulative');
  assert.equal(defaultCoverageScope('quiz'), 'cumulative');
  // Every preset a form can offer has to be a scope the resolver implements.
  for (const type of ['exam', 'quiz', 'assignment', 'project']) {
    for (const preset of coveragePresetsFor(type)) assert.ok(COVERAGE_SCOPES.includes(preset), `${type}: ${preset}`);
  }
  // "Since the last exam or quiz" means nothing next to a problem set.
  assert.ok(!coveragePresetsFor('assignment').includes('since_last'));
  assert.ok(coveragePresetsFor('exam').includes('since_last'));
  // The control opens on the choice it is about to save, so the first preset
  // and the default have to be the same answer.
  for (const type of ['exam', 'quiz', 'assignment', 'project']) {
    assert.equal(coveragePresetsFor(type)[0], defaultCoverageScope(type), type);
  }
});

test('the label names the deadline the student is looking at', () => {
  assert.equal(coverageScopeLabel('cumulative', 'exam'), 'Everything up to the exam');
  assert.equal(coverageScopeLabel('cumulative', 'project'), 'Everything up to the project');
  assert.equal(coverageScopeLabel('all', 'exam'), 'Every lecture in this class');
  // An unknown scope must still produce a sentence rather than "undefined".
  assert.equal(coverageScopeLabel('nonsense', 'exam'), COVERAGE_SCOPE_LABEL.cumulative);
});

test('an empty scope is explained by the deadline, not blamed on the student', () => {
  // A project that covers no lectures is not a class with no recordings, and
  // "record and process lectures first" reads as a bug on a fully recorded
  // class.
  const route = fs.readFileSync(new URL('../routes/generateClassHandbook.js', import.meta.url), 'utf8');
  assert.match(route, /scopedToNothing = lectures\.length === 0 && allForClass\.length > 0/);
  assert.match(route, /isn't set to cover any lectures/);
});

test('the handbook uses the resolver instead of its own copy', () => {
  const route = fs.readFileSync(new URL('../routes/generateClassHandbook.js', import.meta.url), 'utf8');
  assert.match(route, /import \{ resolveAssignmentLectures \} from '\.\.\/\.\.\/shared\/assignmentScope\.js'/);
  assert.match(route, /lectures = resolveAssignmentLectures\(asgn, lectures, priors\)/);
  // The eleven lines it replaces, gone rather than left beside it.
  assert.doesNotMatch(route, /coverage_scope === 'since_last'/);
  assert.doesNotMatch(route, /lastExamDate/);
});

test('every surface asks what a deadline covers through the same control', () => {
  const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
  const FORM = read('../../src/components/DeadlineForm.jsx');
  const EDIT = read('../../src/components/AssignmentEditModal.jsx');
  for (const [name, src] of [['DeadlineForm', FORM], ['AssignmentEditModal', EDIT]]) {
    assert.match(src, /<DeadlineCoverage/, `${name}: has its own coverage control again`);
    // The dropdown-plus-hidden-picker it replaces, gone rather than left
    // beside it — two controls for one question is how they drifted apart.
    assert.doesNotMatch(src, /Object\.entries\(COVERAGE_SCOPE_LABEL\)\.map/, `${name}: the old dropdown is back`);
    assert.doesNotMatch(src, /<LectureScopePicker/, `${name}: picks lectures without the scope around it`);
  }
  // The picked list is stored only for 'custom' — a derived scope with a
  // frozen list beside it is two answers to one question.
  assert.match(FORM, /lecture_ids: form\.coverage_scope === 'custom' \? form\.lecture_ids : \[\]/);
  assert.match(EDIT, /coverage_scope: scope, lecture_ids: scope === 'custom' \? lectureIds : \[\]/);
  // And the two add surfaces are shells around the form, not copies of it.
  for (const [name, src] of [
    ['ClassDetail', read('../../src/pages/ClassDetail.jsx')],
    ['AddExamOrStudyModal', read('../../src/components/AddExamOrStudyModal.jsx')],
  ]) {
    assert.match(src, /<DeadlineForm/, `${name}: no longer uses the shared form`);
    assert.doesNotMatch(src, /coverage_scope:/, `${name}: decides coverage on its own again`);
  }
});

test('an exam confirms its lectures before it is written, an assignment does not', () => {
  // An exam's scope is derived — the student never typed it — and it decides
  // what the sessions and the handbook are built from. An assignment covers
  // nothing by default, and there is nothing to confirm about nothing.
  const src = fs.readFileSync(new URL('../../src/components/DeadlineForm.jsx', import.meta.url), 'utf8');
  assert.match(src, /const confirmsCoverage = form\.type === 'exam' \|\| form\.type === 'quiz'/);
  assert.match(src, /if \(confirmsCoverage\) \{ setStep\('coverage'\); return; \}/, 'submit skips the confirm step');
  assert.match(src, /Does this look right\?/, 'the step does not ask anything');
  // Changing the type re-defaults the coverage rather than carrying an
  // exam's scope onto a problem set.
  assert.match(src, /coverage_scope: defaultCoverageScope\(type\), lecture_ids: \[\]/);
});

test('the preview resolves scope the way the server will', () => {
  // A preview computed any other way is a promise the booking breaks.
  const src = fs.readFileSync(new URL('../../src/components/DeadlineCoverage.jsx', import.meta.url), 'utf8');
  assert.match(src, /resolveAssignmentLectures\(/);
  assert.match(src, /coveragePresetsFor\(type\)/);
  // The two ends of a manual selection are named scopes, not a frozen list:
  // 'all' keeps tracking a class that grows, and 'none' is not the empty
  // custom list the resolver reads as "nobody picked yet".
  assert.match(src, /if \(explicit\.length === 0\) return onChange\(\{ scope: 'none', lectureIds: \[\] \}\)/);
  assert.match(src, /return onChange\(\{ scope: 'all', lectureIds: \[\] \}\);/);
  // Except when the scope in force already covers all of them: that press is
  // a student undoing one untick, and silently turning their exam's
  // 'cumulative' into 'all' widens it to lectures taught after the exam.
  assert.match(src, /if \(coveredIds\.length === dated\.length\) return;/);
  // Any scope that is not one of this type's chips still has to read as
  // selected — 'custom', and the scopes the old dropdown let every type save.
  assert.match(src, /\{!presets\.includes\(scope\) && \(/);
  // The picker and the resolver have to be shown the same rows, or "select
  // all" comes back reading "5 of 6".
  assert.match(src, /const dated = lectures\.filter\(\(l\) => l && l\.date\)/);
  assert.doesNotMatch(src, /lectures=\{lectures\}/, 'the picker is handed rows the resolver will drop');
});

test('a project no longer claims to cover the whole term', () => {
  // It never said so — it just left coverage_scope unset and inherited the
  // column default, which is 'cumulative'.
  const src = fs.readFileSync(new URL('../../src/components/ProjectAssignmentModal.jsx', import.meta.url), 'utf8');
  assert.match(src, /coverage_scope: defaultCoverageScope\('project'\)/);
});

test('"select all" is stored as real ids, and "none" as empty', () => {
  const src = fs.readFileSync(new URL('../../src/components/LectureScopePicker.jsx', import.meta.url), 'utf8');
  assert.match(src, /export function explicitScopeIds/);
  // The picker's own shorthand — [] means whole class — cannot be stored as
  // is, because an empty column means "not picked yet" to the resolver.
  assert.match(src, /if \(resolved\.length === 0\) return lectures\.map\(l => l\.id\)/);
  assert.match(src, /if \(resolved === null\) return \[\]/);
});
