import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveAssignmentLectures } from '../../shared/assignmentScope.js';

/**
 * Phase 6: the checklist on the deadline.
 *
 * The end of the chain. A deadline resolves to a set of lectures (phase 1), its
 * sessions each take a share (phase 2), a focus session opens the ones it
 * covers (3 and 4), and finishing one marks them reviewed (5). Until this
 * component the app knew exactly which four of nine lectures were still
 * untouched and had nowhere to say so.
 */

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
const LIST = read('../../src/components/CoverageChecklist.jsx');
const PLANNER = read('../../src/pages/StudyPlanner.jsx');
const CLASS = read('../../src/pages/ClassDetail.jsx');

test('covered means the row every other screen reads', () => {
  // Not a new column, not a count of completed sessions, not a fifth meaning of
  // the word. knowledge_coverage.last_reviewed_date is what the freshness
  // badges and the proficiency ring already read, so the tick here and the
  // badge on the lecture itself cannot disagree.
  assert.match(LIST, /last_reviewed_date/);
  assert.match(LIST, /from '@\/lib\/conceptDecay'/, 'freshness is recomputed instead of reused');
  assert.doesNotMatch(LIST, /status === 'completed'/,
    'a completed session is not evidence that its lectures were opened — that is what phase 5 settled');
});

test('the scope comes from the one resolver, not a second copy of the rules', () => {
  assert.match(LIST, /resolveAssignmentLectures/);
  assert.doesNotMatch(LIST, /coverage_scope/,
    'the checklist is re-deciding what a deadline covers instead of asking');
});

test('a reviewed lecture still says how long ago', () => {
  // The tick alone would call a lecture read in August and a lecture read
  // yesterday the same thing, and only one of them is worth walking into an
  // exam on.
  assert.match(LIST, /FreshnessBadge/);
  assert.match(LIST, /getDecayState/);
});

test('both places a deadline appears show it', () => {
  for (const [name, src] of [['StudyPlanner', PLANNER], ['ClassDetail', CLASS]]) {
    assert.match(src, /import CoverageChecklist/, `${name} does not import it`);
    assert.match(src, /<CoverageChecklist/, `${name} does not render it`);
    assert.match(src, /a\.type !== 'project'/,
      `${name} shows it on projects, which are made of roadmap steps rather than lectures`);
  }
});

test('the planner loads what the checklist needs', () => {
  assert.match(PLANNER, /entities\.Lecture\.filter/, 'no lectures, so nothing resolves');
  assert.match(PLANNER, /entities\.KnowledgeCoverage\.filter/, 'no coverage, so nothing ticks');
  // Per class, or one class's lectures would tick another's deadline.
  assert.match(PLANNER, /lectures\.filter\(l => l\.class_id === a\.class_id\)/);
  assert.match(PLANNER, /coverage\.filter\(k => k\.class_id === a\.class_id\)/);
});

test('a deadline with nothing in scope renders nothing at all', () => {
  // A class with no processed lectures resolves to an empty list. An empty
  // checklist reading "0 of 0 covered" is worse than no checklist.
  assert.match(LIST, /if \(scoped\.length === 0\) return null/);
  assert.deepEqual(resolveAssignmentLectures({ due_date: '2026-10-01' }, []), []);
});

test('the resolver still decides the same way it did in phase 1', () => {
  const lectures = [
    { id: 'a', date: '2026-09-01' },
    { id: 'b', date: '2026-09-08' },
    { id: 'c', date: '2026-09-22' },  // after the due date
  ];
  const midterm = { id: 'm', due_date: '2026-09-15', coverage_scope: 'cumulative' };
  assert.deepEqual(
    resolveAssignmentLectures(midterm, lectures).map((l) => l.id),
    ['a', 'b'],
    'a lecture taught after the exam cannot be something the exam covers',
  );
});
