import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  cleanAnalysis, cleanTitle, cleanSummary, cleanList, cleanDefinitions,
  collapseRepetition, MAX_TITLE_CHARS,
} from '../lib/analysisSanity.js';

// The incident this guards: a lecture processed on 3 Sep came back with a
// 252,075-character ai_title. The stitched-summary call looped and repeated
// the same clause hundreds of times, and the pipeline wrote it straight to the
// column, so the lecture page rendered four pages of one repeating sentence as
// a heading. Real titles in the same account are 60-90 characters.

const REAL_LOOP_PREFIX = 'Study Strategies and Artificial Intelligence Ethics in Engineering Program Overview And Academic Success Fundamentals In Engineering';

test('the exact 3 Sep failure collapses to one clean title', () => {
  // The observed value: one clause, then the same clause again and again.
  const looped = new Array(400).fill(REAL_LOOP_PREFIX).join(' ');
  assert.ok(looped.length > 50_000, 'the fixture should be pathological');
  const title = cleanTitle(looped, 'Lecture — 2026-09-03');
  assert.equal(title, REAL_LOOP_PREFIX);
  assert.ok(title.length <= MAX_TITLE_CHARS);
});

test('a loop that was cut off mid-phrase still collapses', () => {
  const looped = `${REAL_LOOP_PREFIX} ${REAL_LOOP_PREFIX} ${REAL_LOOP_PREFIX} Study Strategies and`;
  assert.equal(cleanTitle(looped), REAL_LOOP_PREFIX);
});

test('ordinary titles pass through untouched', () => {
  for (const real of [
    'Introduction to First-Year Engineering at USask Orientation and Program Structure Overview',
    'Introduction to Engineering Programming with MATLAB and Course Structure',
    'Engineering Communications I: Course Introduction and Syllabus Overview',
    'Introduction to Engineering Mathematics I and Limits Journey',
  ]) {
    assert.equal(cleanTitle(real), real, 'a real title was altered');
  }
});

test('repetition inside normal prose is not mistaken for a loop', () => {
  // Two full extra blocks is the bar; incidental repeats must not trip it.
  const prose = 'The the derivative of a function measures how fast the function changes over time';
  assert.equal(collapseRepetition(prose), prose);
  assert.equal(cleanTitle('Limits and Continuity and Limits'), 'Limits and Continuity and Limits');
});

test('a long non-repeating title is cut at a word boundary, never mid-word', () => {
  const long = Array.from({ length: 80 }, (_, i) => `topic${i}`).join(' ');
  const title = cleanTitle(long);
  assert.ok(title.length <= MAX_TITLE_CHARS);
  assert.ok(!long.slice(title.length).startsWith('c'), 'cut landed inside a word');
  assert.doesNotMatch(title, /\s$/);
});

test('an empty or unusable title falls back to something renderable', () => {
  assert.equal(cleanTitle('', 'Lecture — 2026-09-03'), 'Lecture — 2026-09-03');
  assert.equal(cleanTitle(null, 'Lecture — 2026-09-03'), 'Lecture — 2026-09-03');
  assert.equal(cleanTitle('   ', 'Lecture — 2026-09-03'), 'Lecture — 2026-09-03');
  assert.equal(cleanTitle('"Quoted Title"'), 'Quoted Title');
});

test('summaries keep their paragraphs but lose repeated ones', () => {
  const para = 'The lecture covered vectors and their components in two dimensions.';
  const summary = cleanSummary(`${para}\n\n${para}\n\nThen it moved on to equilibrium.`);
  assert.equal(summary, `${para}\n\nThen it moved on to equilibrium.`);
  assert.ok(summary.includes('\n\n'), 'paragraph breaks must survive');
});

test('lists are de-duplicated, bounded and de-looped', () => {
  const list = cleanList(['Vectors', 'vectors', '  Moments  ', '', null, 'Loop Loop Loop Loop Loop Loop']);
  assert.deepEqual(list, ['Vectors', 'Moments', 'Loop']);
  assert.equal(cleanList(new Array(500).fill(0).map((_, i) => `item ${i}`)).length, 60);
  assert.deepEqual(cleanList('not an array'), []);
});

test('definitions drop half-empty pairs instead of storing them', () => {
  const defs = cleanDefinitions([
    { term: 'Scalar', definition: 'A quantity with magnitude only.' },
    { term: '', definition: 'orphaned' },
    { term: 'orphaned', definition: '' },
  ]);
  assert.deepEqual(defs, [{ term: 'Scalar', definition: 'A quantity with magnitude only.' }]);
});

test('cleanAnalysis covers every field the pipeline persists', () => {
  // If a new field is written to the lectures row it must pass through here
  // too, or the next degenerate generation lands in the database again.
  const route = fs.readFileSync(new URL('../routes/processLectureRecording.js', import.meta.url), 'utf8');
  // Anchored on the UPDATE itself: `detectAndCreateAssignments(` also appears
  // earlier as a function declaration, so an indexOf end marker slices backwards.
  const at = route.indexOf('update lectures set ai_title=');
  assert.ok(at > -1, 'the analysis UPDATE moved');
  const persist = route.slice(at, at + 900);
  for (const field of ['title', 'summary', 'concepts', 'vocabulary', 'definitions', 'formulas', 'action_items', 'exam_mentions']) {
    assert.match(persist, new RegExp(`analysis\\.${field}`), `${field} is persisted`);
  }
  const cleaned = cleanAnalysis({}, { fallbackTitle: 'Lecture — 2026-09-03' });
  for (const field of ['title', 'summary', 'concepts', 'vocabulary', 'definitions', 'formulas', 'action_items', 'exam_mentions']) {
    assert.ok(field in cleaned, `${field} is not sanitised`);
  }
  assert.match(route, /cleanAnalysis\(/, 'the pipeline no longer sanitises what it stores');
});
