import test from 'node:test';
import assert from 'node:assert/strict';
import { searchPalette, PALETTE_LIMITS } from '../../src/lib/paletteSearch.js';

// The ⌘K palette shipped unable to match anything: Layout rendered it with no
// props, so classes/lectures/assignments were always []. Typing a real class
// name answered "No results found". These lock the matching rules; the
// component's job is only to supply the data and draw the rows.

const CLASSES = [
  { id: 'c1', name: 'Church', course_code: '', instructor: '' },
  { id: 'c2', name: 'Engineering Mathematics I', course_code: 'MATH 133', instructor: 'Dr. Vance' },
  { id: 'c3', name: 'Design I', course_code: 'GE 140', instructor: '' },
];
const LECTURES = [
  { id: 'l1', class_id: 'c1', ai_title: 'Sunday service', transcript: 'all the kids are going to sing' },
  { id: 'l2', class_id: 'c2', ai_title: 'Limits and continuity', transcript: 'epsilon delta' },
];
const ASSIGNMENTS = [
  { id: 'a1', class_id: 'c2', title: 'Problem set 3' },
  { id: 'a2', class_id: 'c1', title: 'Reading' },
];
const DATA = { classes: CLASSES, lectures: LECTURES, assignments: ASSIGNMENTS };

test('finds a class by name, case-insensitively', () => {
  for (const q of ['church', 'Church', 'CHURCH', ' church ', 'chur']) {
    const { classes } = searchPalette(q, DATA);
    assert.deepEqual(classes.map((c) => c.id), ['c1'], `query ${JSON.stringify(q)}`);
  }
});

test('a class name also surfaces that class\'s lectures and assignments', () => {
  const { lectures, assignments } = searchPalette('church', DATA);
  assert.deepEqual(lectures.map((l) => l.id), ['l1']);
  assert.deepEqual(assignments.map((a) => a.id), ['a2']);
});

test('classes match course code and instructor, like the Classes page', () => {
  assert.deepEqual(searchPalette('MATH 133', DATA).classes.map((c) => c.id), ['c2']);
  assert.deepEqual(searchPalette('vance', DATA).classes.map((c) => c.id), ['c2']);
});

test('lectures match their own title and transcript', () => {
  assert.deepEqual(searchPalette('epsilon', DATA).lectures.map((l) => l.id), ['l2']);
  assert.deepEqual(searchPalette('continuity', DATA).lectures.map((l) => l.id), ['l2']);
});

test('an empty or whitespace query matches nothing', () => {
  for (const q of ['', '   ', null, undefined]) {
    const r = searchPalette(q, DATA);
    assert.deepEqual([r.classes.length, r.lectures.length, r.assignments.length], [0, 0, 0]);
  }
});

test('missing data and missing fields never throw', () => {
  assert.doesNotThrow(() => searchPalette('church', undefined));
  assert.doesNotThrow(() => searchPalette('church', {}));
  assert.doesNotThrow(() => searchPalette('x', { classes: [{ id: 'c' }], lectures: [{ id: 'l' }], assignments: [{ id: 'a' }] }));
});

test('results stay bounded so one query cannot flood the list', () => {
  const many = Array.from({ length: 40 }, (_, i) => ({ id: `c${i}`, name: `Church ${i}` }));
  const lots = Array.from({ length: 40 }, (_, i) => ({ id: `l${i}`, class_id: 'c0', ai_title: 'Church talk' }));
  const r = searchPalette('church', { classes: many, lectures: lots, assignments: [] });
  assert.equal(r.classes.length, PALETTE_LIMITS.classes);
  assert.equal(r.lectures.length, PALETTE_LIMITS.lectures);
});

// The defect was wiring, not matching: Layout rendered <CommandPalette /> with
// no props while the component defaulted all three data props to []. Neither a
// unit test of the rules nor a render test would have caught a search that
// simply had nothing to search. Guard the wiring itself.
test('the palette sources its own data instead of defaulting to empty arrays', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../../src/components/CommandPalette.jsx', import.meta.url), 'utf8');
  assert.ok(src.includes('useTodaySchedule'), 'palette must read the semester class list');
  assert.ok(src.includes('fetchWithCache'), 'palette must load lectures and assignments');
  assert.ok(src.includes('searchPalette'), 'palette must use the tested matching rules');
  for (const prop of ['classes', 'lectures', 'assignments']) {
    assert.ok(
      !new RegExp(`${prop}\\s*=\\s*\\[\\]`).test(src),
      `${prop} must not default to [] — that is the bug that shipped`,
    );
  }
});
