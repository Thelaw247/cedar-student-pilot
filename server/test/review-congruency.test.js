import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * "Review" meant two different things depending on which button you pressed.
 * Review this week ran a quiz with no choice offered; the same word inside a
 * focus session opened the handbook. Both are real ways to review — the
 * mistake was deciding for the student.
 *
 * The choice now lives on /lecture-review itself, which is where every review
 * entry point already pointed, so no link had to change and no second chooser
 * had to be built. The answer rides in the URL, so it is bookmarkable and a
 * deep link that already knows the answer skips the question.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const REVIEW = read('../../src/pages/LectureReview.jsx');
const CHOOSER = read('../../src/components/ReviewModeChooser.jsx');
const FROM_LECTURES = read('../../src/components/ReviewFromLectures.jsx');
const DETAIL = read('../../src/pages/LectureDetail.jsx');

test('every review entry point still goes to the one route that asks', () => {
  // The fix is at the destination, not at each button, so these are unchanged
  // — and must stay unchanged, or an entry point silently skips the question.
  assert.match(FROM_LECTURES, /to="\/lecture-review\/today"/);
  assert.match(FROM_LECTURES, /to="\/lecture-review\/week"/);
  assert.match(FROM_LECTURES, /navigate\(`\/lecture-review\?ids=/);
  assert.match(DETAIL, /to=\{`\/lecture-review\?ids=\$\{lectureId\}`\}/);
});

test('the question is asked before anything is generated or charged', () => {
  // Generating the quiz is a billed LLM call. Asking after would either bill
  // for work the student did not choose or throw it away.
  assert.match(REVIEW, /if \(mode !== 'quiz'\) \{ setLoading\(false\); return; \}/);
  const guardAt = REVIEW.indexOf("if (mode !== 'quiz')");
  const invokeAt = REVIEW.indexOf("invoke('generateLectureReview'");
  assert.ok(guardAt > -1 && invokeAt > guardAt, 'the gate must come before the call');
  assert.match(REVIEW, /if \(!mode\) \{/);
  assert.match(REVIEW, /<ReviewModeChooser/);
});

test('the answer is in the URL, so it survives a reload and can be linked', () => {
  assert.match(REVIEW, /searchParams\.get\('mode'\)/);
  assert.match(REVIEW, /if \(next\) sp\.set\('mode', next\); else sp\.delete\('mode'\);/);
  assert.match(REVIEW, /setSearchParams\(sp, \{ replace: true \}\)/);
  // Re-running the effect on mode is what makes the quiz start on choosing it.
  assert.match(REVIEW, /\}, \[mode, scope, lectureId, searchParams\.get\('ids'\)\]\);/);
});

test('both options are offered, in the same words, from one component', () => {
  assert.match(CHOOSER, /How do you want to review\?/);
  assert.match(CHOOSER, /Quiz me/);
  assert.match(CHOOSER, /Read the handbook/);
  assert.match(CHOOSER, /onSelect\('quiz'\)/);
  assert.match(CHOOSER, /onSelect\('handbook'\)/);
});

test('the handbook branch reuses the reader rather than a second one', () => {
  assert.match(REVIEW, /import HandbookReader from '@\/components\/HandbookReader'/);
  assert.match(REVIEW, /<HandbookReader\s+classId=\{hbPick\.classId\}/);
  // A handbook is class-scoped, so a multi-class window has to ask which.
  assert.match(REVIEW, /Which class\?/);
  assert.match(REVIEW, /if \(resolved\.length === 1\) setHbPick\(resolved\[0\]\)/,
    'a single class must open straight into the handbook, not ask a pointless question');
});

test('both branches agree on what "this week" means', () => {
  // The server window is date >= today - 7 days. The client resolves the
  // handbook scope itself, so a different arithmetic here would hand the two
  // paths different lectures for the same button.
  assert.match(REVIEW, /function localDay\(/);
  assert.match(REVIEW, /scope === 'week' \? localDay\(new Date\(Date\.now\(\) - 7 \* 86400000\)\) : today/);
  const SERVER = read('../routes/generateLectureReview.js');
  assert.match(SERVER, /interval '7 days'/);
  // And the quiz payload uses the same helper rather than its own copy.
  assert.match(REVIEW, /payload = \{ scope, local_date: localDay\(\) \};/);
});

test('the dead second chooser is gone', () => {
  // StudyModeSelector asked a near-identical question and nothing rendered it.
  // Leaving it in the tree is how the next person adds a third chooser.
  assert.throws(() => read('../../src/components/StudyModeSelector.jsx'), /ENOENT/);
  const files = fs.readdirSync(new URL('../../src', import.meta.url), { recursive: true });
  for (const f of files) {
    if (!String(f).endsWith('.jsx')) continue;
    assert.doesNotMatch(read(`../../src/${f}`), /StudyModeSelector/, `${f} still imports it`);
  }
});
