import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * "Review" meant two different things depending on which button you pressed.
 * Review this week ran a quiz with no choice offered; the same word inside a
 * focus session opened the handbook. Both are real ways to review — the
 * mistake was deciding for the student.
 *
 * The first fix put the choice on /lecture-review itself, so every entry point
 * landed on the same question. That was congruent and it was still a wall:
 * five of the app's fourteen study doors opened onto something to answer
 * rather than something to read.
 *
 * So the question stopped being a screen and became two tiles on the study
 * shelf, each linking to the thing it names. The route keeps honouring
 * ?mode= — that is what the tiles use — and a link that says nothing gets the
 * quiz, which is what "review" meant on every entry point that never asked.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const REVIEW = read('../../src/pages/LectureReview.jsx');
const SHELF = read('../../src/components/StudyShelf.jsx');
const DETAIL = read('../../src/pages/LectureDetail.jsx');

test('the review entry points land on material, not on a question', () => {
  // The shelf says which kind it means. The lecture page does not yet — it is
  // repointed in phase 4 — so the default has to be the one it always ran.
  assert.match(SHELF, /navigate\(`\/lecture-review\?ids=\$\{lectureIds\.join\(','\)\}&mode=quiz`\)/);
  assert.match(SHELF, /navigate\('\/lecture-review\/today\?mode=quiz'\)/);
  assert.match(SHELF, /navigate\('\/lecture-review\/week\?mode=quiz'\)/);
  assert.match(DETAIL, /to=\{`\/lecture-review\?ids=\$\{lectureId\}`\}/);
  assert.match(REVIEW, /const mode = searchParams\.get\('mode'\) \|\| 'quiz'/,
    'a link with no mode must land on something rather than on a fork');
});

test('nothing is generated or charged for a mode that is not in play', () => {
  // Generating the quiz is a billed LLM call, and the handbook branch below
  // builds its own material. Running both would bill for work nobody asked for.
  assert.match(REVIEW, /if \(mode !== 'quiz'\) \{ setLoading\(false\); return; \}/);
  const guardAt = REVIEW.indexOf("if (mode !== 'quiz')");
  const invokeAt = REVIEW.indexOf("invoke('generateLectureReview'");
  assert.ok(guardAt > -1 && invokeAt > guardAt, 'the gate must come before the call');
});

test('the mode is in the URL, so it survives a reload and can be linked', () => {
  assert.match(REVIEW, /searchParams\.get\('mode'\)/);
  // Re-running the effect on mode is what makes a mode change start the quiz.
  assert.match(REVIEW, /\}, \[mode, scope, lectureId, searchParams\.get\('ids'\)\]\);/);
});

test('the handbook branch reuses the reader rather than a second one', () => {
  assert.match(REVIEW, /import HandbookReader from '@\/components\/HandbookReader'/);
  assert.match(REVIEW, /<HandbookReader\s+classId=\{hbPick\.classId\}/);
  // A handbook is class-scoped, so a multi-class window has to ask which.
  assert.match(REVIEW, /Which class\?/);
  assert.match(REVIEW, /if \(resolved\.length === 1\) setHbPick\(resolved\[0\]\)/,
    'a single class must open straight into the handbook, not ask a pointless question');
  // The shelf never reaches that question: it already knows the class, so it
  // opens the reader itself rather than routing through the resolver.
  assert.match(SHELF, /<HandbookReader classId=\{classId\} lectureIds=\{scopedIds\}/);
});

test('everything that says "this week" means the same seven days', () => {
  // The server window is `date between (today - 7 days) and today`. Three
  // places decide something about that window — the quiz payload, the client
  // side handbook scope, and the shelf that greys the tile out — so they share
  // one helper instead of three copies of the same arithmetic.
  assert.match(REVIEW, /import \{ localDay \} from '@\/lib\/localDay'/);
  assert.doesNotMatch(REVIEW, /function localDay\(/, 'a private copy has grown back');
  assert.match(REVIEW, /scope === 'week' \? localDay\(new Date\(Date\.now\(\) - 7 \* 86400000\)\) : today/);
  assert.match(REVIEW, /payload = \{ scope, local_date: localDay\(\) \};/);
  assert.match(SHELF, /const weekFrom = daysAgo\(7\)/);
  const SERVER = read('../routes/generateLectureReview.js');
  assert.match(SERVER, /interval '7 days'/);
});

test('no chooser screen survives anywhere in the tree', () => {
  // StudyModeSelector asked a near-identical question and nothing rendered it;
  // ReviewModeChooser asked it for real. Leaving either in the tree is how the
  // next person adds a third.
  assert.throws(() => read('../../src/components/StudyModeSelector.jsx'), /ENOENT/);
  assert.throws(() => read('../../src/components/ReviewModeChooser.jsx'), /ENOENT/);
  const files = fs.readdirSync(new URL('../../src', import.meta.url), { recursive: true });
  for (const f of files) {
    if (!String(f).endsWith('.jsx')) continue;
    const src = read(`../../src/${f}`);
    assert.doesNotMatch(src, /StudyModeSelector/, `${f} still imports it`);
    assert.doesNotMatch(src, /ReviewModeChooser/, `${f} still imports it`);
  }
});
