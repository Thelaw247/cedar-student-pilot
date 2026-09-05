import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { markLecturesReviewed, proficiencyOf } from '../lib/knowledgeCoverage.js';
import { masteryFromReview } from '../lib/reviewScores.js';
import { computeClassProficiency, aggregateProficiency, pairCoverageWithLectures } from '../../src/lib/conceptDecay.js';

/**
 * Phase 5: finishing a study session marks the lectures reviewed.
 *
 * Everything before this phase pointed at a write that did not exist. A
 * session knew its lectures, Focus Mode opened them, the tools built material
 * from them -- and then the student pressed Stop and the only record was a
 * duration. Every freshness badge in the app reads knowledge_coverage, and the
 * one way to move it was to sit a quiz.
 */

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
const LIB = read('../lib/knowledgeCoverage.js');
const ROUTE = read('../routes/recordStudyCoverage.js');
const INDEX = read('../index.js');
const REVIEW = read('../routes/processSessionReview.js');
const FOCUS = read('../../src/pages/FocusMode.jsx');
const QUIZ = read('../../src/components/InLectureQuiz.jsx');
const HANDBOOK = read('../../src/components/HandbookReader.jsx');
const GUIDE = read('../../src/components/ManualStudyGuide.jsx');
const TOOLBOX = read('../../src/components/StudyToolbox.jsx');
const MIGRATION = read('../../supabase/migrations/20260906000000_one_coverage_row_per_lecture.sql');

/** A pg client that records what it was asked, and answers the SELECT. */
function fakeClient(existingRows = []) {
  const calls = [];
  return {
    calls,
    upserts: () => calls.filter((c) => /insert into knowledge_coverage/.test(c.text)),
    async query(text, params) {
      calls.push({ text, params });
      if (/select lecture_id, concepts_seen/.test(text)) return { rows: existingRows };
      return { rows: [] };
    },
  };
}

// ---------------------------------------------------------------- the writer

test('no lectures, no statements at all', async () => {
  const client = fakeClient();
  assert.deepEqual(await markLecturesReviewed(client, { userId: 'u', classId: 'c', lectureIds: [] }), []);
  assert.deepEqual(await markLecturesReviewed(client, { userId: 'u', classId: 'c', lectureIds: null }), []);
  assert.equal(client.calls.length, 0, 'an empty session must not touch the database');
});

test('a lecture opened by two tools is one row, not two', async () => {
  const client = fakeClient();
  const marked = await markLecturesReviewed(client, {
    userId: 'u', classId: 'c', lectureIds: ['l1', 'l1', null, 'l2', 'l1'],
  });
  assert.deepEqual(marked, ['l1', 'l2']);
  assert.equal(client.upserts().length, 2);
});

test('reviewing without a quiz leaves the concepts exactly as they were', async () => {
  // The whole point of the phase: sitting with a lecture is evidence you
  // reviewed it, never evidence you mastered it.
  const client = fakeClient([{ lecture_id: 'l1', concepts_seen: ['Osmosis'], concepts_mastered: ['Osmosis'] }]);
  await markLecturesReviewed(client, { userId: 'u', classId: 'c', lectureIds: ['l1'] });
  const [{ params }] = client.upserts();
  assert.deepEqual(params[3], ['Osmosis'], 'concepts_seen was disturbed by a review');
  assert.deepEqual(params[4], ['Osmosis'], 'concepts_mastered was disturbed by a review');
  assert.equal(params[5], 100, 'proficiency moved on evidence that says nothing about mastery');
});

test('a first review of an untouched lecture stores no concepts and no proficiency', async () => {
  const client = fakeClient();
  await markLecturesReviewed(client, { userId: 'u', classId: 'c', lectureIds: ['l1'] });
  const [{ params }] = client.upserts();
  assert.deepEqual(params[3], []);
  assert.deepEqual(params[4], []);
  assert.equal(params[5], 0);
  assert.match(String(params[6]), /^\d{4}-\d{2}-\d{2}$/, 'last_reviewed_date must be a plain date');
});

test('quiz evidence unions into what was already known', async () => {
  const client = fakeClient([{ lecture_id: 'l1', concepts_seen: ['Osmosis'], concepts_mastered: [] }]);
  await markLecturesReviewed(client, {
    userId: 'u', classId: 'c', lectureIds: ['l1'],
    conceptsSeen: ['Osmosis', 'Diffusion', ' Diffusion ', ''],
    conceptsMastered: ['Diffusion'],
  });
  const [{ params }] = client.upserts();
  assert.deepEqual(params[3], ['Osmosis', 'Diffusion'], 'blank and duplicate concepts must be dropped');
  assert.deepEqual(params[4], ['Diffusion']);
  assert.equal(params[5], 50);
});

test('a concept cannot be mastered without having been seen', async () => {
  const client = fakeClient();
  await markLecturesReviewed(client, {
    userId: 'u', classId: 'c', lectureIds: ['l1'],
    conceptsSeen: ['Osmosis'], conceptsMastered: ['Osmosis', 'Something Never Asked'],
  });
  const [{ params }] = client.upserts();
  assert.deepEqual(params[4], ['Osmosis']);
  assert.ok(proficiencyOf(params[3], params[4]) <= 100, 'proficiency escaped 100%');
});

test('the row is locked before it is merged, and only ever the caller own row', async () => {
  const client = fakeClient();
  await markLecturesReviewed(client, { userId: 'u', classId: 'c', lectureIds: ['l1'] });
  const select = client.calls[0];
  assert.match(select.text, /for update/, 'two sessions finishing at once would interleave their unions');
  assert.match(select.text, /where user_id = \$1/, 'the lock must be scoped to the owner');
  for (const call of client.calls) {
    assert.equal(call.params[0], 'u', 'every statement carries the user id');
  }
});

test('the upsert counts a sitting and never walks the date backwards', () => {
  assert.match(LIB, /sessions_reviewed = knowledge_coverage\.sessions_reviewed \+ 1/);
  assert.match(LIB, /last_reviewed_date = greatest\(knowledge_coverage\.last_reviewed_date, excluded\.last_reviewed_date\)/);
  assert.match(LIB, /on conflict \(user_id, lecture_id\) where lecture_id is not null/,
    'the conflict target must name the partial index predicate');
});

test('the columns that are read survive being marked twice in one sitting', async () => {
  // A student who reads the chapter, quizzes on it, ends the session and then
  // fills in the review marks the same lecture four times. The date is the
  // same day each time and the concepts are a union, so the three columns any
  // screen reads land in the same place. sessions_reviewed counts marks
  // rather than sittings, which is why nothing reads it — see the note in
  // knowledgeCoverage.js.
  const prior = { lecture_id: 'l1', concepts_seen: ['Osmosis'], concepts_mastered: ['Osmosis'] };
  const client = fakeClient([prior]);
  await markLecturesReviewed(client, { userId: 'u', classId: 'c', lectureIds: ['l1'] });
  await markLecturesReviewed(client, { userId: 'u', classId: 'c', lectureIds: ['l1'], conceptsSeen: ['Osmosis'], conceptsMastered: ['Osmosis'] });
  const [first, second] = client.upserts();
  assert.deepEqual(first.params.slice(3, 7), second.params.slice(3, 7),
    'marking the same lecture twice in one sitting must be idempotent in every column a screen reads');
  assert.match(LIB, /Marks, not sittings/, 'the counter must say what it counts');
});

test('proficiency is the ratio every existing writer stored', () => {
  assert.equal(proficiencyOf([], []), 0);
  assert.equal(proficiencyOf(['a', 'b', 'c', 'd'], ['a']), 25);
  assert.equal(proficiencyOf(Array.from({ length: 13 }, (_, i) => `c${i}`), Array.from({ length: 10 }, (_, i) => `c${i}`)), 77);
});

// ------------------------------------------------------- the migration

test('the migration merges duplicates rather than dropping them', () => {
  assert.match(MIGRATION, /array_agg\(distinct c\)/, 'concepts must be unioned across the copies');
  assert.match(MIGRATION, /create unique index if not exists knowledge_coverage_user_lecture_key/);
  assert.match(MIGRATION, /where lecture_id is not null/, 'a class-level row has nothing to deduplicate against');
  // max, not sum: the copies are repeat writes of the same sittings.
  assert.match(MIGRATION, /max\(sessions_reviewed\) as sessions/);
  assert.doesNotMatch(MIGRATION, /sum\(sessions_reviewed\)/);
  // The update has to run before the delete, or the survivor never gets the union.
  assert.ok(MIGRATION.indexOf('update public.knowledge_coverage kc') < MIGRATION.indexOf('delete from public.knowledge_coverage kc'));
});

// ------------------------------------------------------------- the route

test('the session status is the idempotency guard', () => {
  assert.match(ROUTE, /status = 'completed'\s*\n\s*where id = \$1 and user_id = \$2 and status <> 'completed'/,
    'a retried Stop would count the same sitting twice');
  assert.match(ROUTE, /already_completed: true, marked: \[\]/);
});

test('recording what you studied is free', () => {
  // Calls, not prose: the route's own comment explains why there is no gate.
  assert.doesNotMatch(ROUTE, /\bgateFeature\(|\bsettleFeature\(/,
    'a student must not be charged for the app writing down what they did');
});

test('closing the session and marking its lectures are one transaction', () => {
  assert.match(ROUTE, /await client\.query\('begin'\)/);
  assert.match(ROUTE, /await client\.query\('commit'\)/);
  const begin = ROUTE.indexOf("client.query('begin')");
  const commit = ROUTE.indexOf("client.query('commit')");
  const mark = ROUTE.indexOf('markLecturesReviewed(client, {');
  const close = ROUTE.indexOf("status = 'completed'");
  assert.ok(begin < close && close < mark && mark < commit,
    'a completed session whose lectures were never marked is the bug this fixes');
});

test('lecture ids from the browser are filtered against the database', () => {
  assert.match(ROUTE, /ownedLectureIds/);
  assert.match(LIB, /where id = any\(\$1::uuid\[\]\) and class_id = \$2 and user_id = \$3/);
});

test('the route is mounted', () => {
  assert.match(INDEX, /app\.use\('\/record-study-coverage', recordStudyCoverageRouter\)/);
  // functionPath('recordStudyCoverage') -> '/record-study-coverage'
  assert.match(FOCUS, /invoke\('recordStudyCoverage'/);
});

// --------------------------------------------- the review write that was lost

test('a saved review moves the lectures it was about', () => {
  assert.match(REVIEW, /markLecturesReviewed\(client, \{/);
  const mark = REVIEW.indexOf('markLecturesReviewed(client');
  const commit = REVIEW.indexOf("client.query('commit')");
  assert.ok(mark > 0 && mark < commit, 'the coverage write must be inside the review transaction');
});

test('a review reads as concepts in the spelling a student will see', () => {
  const out = masteryFromReview(
    [{ concept: 'Cell Theory', is_correct: true }, { concept: 'cell theory', is_correct: false },
      { concept: 'Osmosis', is_correct: true }],
    [{ topic: 'Diffusion', covered: true }, { topic: 'Mitosis', covered: false }],
  );
  assert.deepEqual(out.seen, ['Cell Theory', 'Osmosis', 'Diffusion'],
    'case must not split one concept in two, and the first spelling wins');
  assert.deepEqual(out.mastered, ['Osmosis'], 'one wrong answer means the concept is not mastered');
});

test('a self-assessment says covered, never mastered', () => {
  const out = masteryFromReview([], [{ topic: 'Glycolysis', covered: true, proficiency: 100 }]);
  assert.deepEqual(out.seen, ['Glycolysis']);
  assert.deepEqual(out.mastered, [], 'a slider a student drags is not a demonstration');
});

// ------------------------------------------- studying must not lower mastery

const CLASS_LECTURES = [{ id: 'a', date: '2026-09-01' }, { id: 'b', date: '2026-09-02' }];
const today = new Date().toISOString().slice(0, 10);
const quizzed = {
  lecture_id: 'a', last_reviewed_date: today,
  concepts_seen: Array.from({ length: 13 }, (_, i) => `c${i}`),
  concepts_mastered: Array.from({ length: 10 }, (_, i) => `c${i}`),
};
const reviewedOnly = { lecture_id: 'b', last_reviewed_date: today, concepts_seen: [], concepts_mastered: [] };
const profOf = (rows) => computeClassProficiency(pairCoverageWithLectures(rows, CLASS_LECTURES), CLASS_LECTURES);

test('reviewing a second lecture does not lower mastery of the class', () => {
  // The regression this phase would otherwise have shipped: every completed
  // session writes a concept-less row, the old formula averaged it in as 0%,
  // and a student watched their proficiency fall because they studied.
  const before = profOf([quizzed]);
  const after = profOf([quizzed, reviewedOnly]);
  assert.equal(before.proficiency, 77);
  assert.equal(after.proficiency, 77, 'studying must never cost a student proficiency');
  assert.equal(after.measured, true);
});

test('reviewed but never tested is unmeasured, not zero', () => {
  const out = profOf([reviewedOnly]);
  assert.equal(out.measured, false);
  assert.equal(out.decayState, 'fresh', 'freshness is exactly what a review is evidence of');
});

test('an unmeasured class stays out of the headline number', () => {
  assert.equal(aggregateProficiency([{ proficiency: 80, conceptsSeen: 10, measured: true }]), 80);
  assert.equal(
    aggregateProficiency([{ proficiency: 80, conceptsSeen: 10, measured: true }, { proficiency: 0, conceptsSeen: 0, measured: false }]),
    80,
  );
  assert.equal(aggregateProficiency([{ proficiency: 0, conceptsSeen: 0, measured: false }]), null);
  // A caller from before the field existed keeps its old behaviour.
  assert.equal(aggregateProficiency([{ proficiency: 60, conceptsSeen: 4 }]), 60);
});

test('a dash, not a zero, on screen', () => {
  const SECTION = read('../../src/components/KnowledgeCoverageSection.jsx');
  assert.match(SECTION, /decayResult\.measured \? `\$\{proficiency\}%` : '—'/);
  assert.match(SECTION, /reviewed, not tested/);
});

test('a class studied but never tested is not "no data"', () => {
  // With an unmeasured class the headline proficiency is null, and Analytics
  // gated its whole panel on that. A student with three completed sessions
  // would have been told none of it counted.
  const ANALYTICS = read('../../src/pages/Analytics.jsx');
  assert.match(ANALYTICS, /const hasAnyCoverage = /);
  assert.match(ANALYTICS, /hasAnyData = avgProficiency !== null \|\| latestReviews\.length > 0 \|\| hasAnyCoverage/);
});

// ------------------------------------------------- what the tools report

test('every tool reports what it put in front of the student', () => {
  assert.match(TOOLBOX, /onGenerated\(ids\)/, 'material built from lectures means those lectures were opened');
  assert.match(HANDBOOK, /onLecturesOpened\(\[id\]\)/, 'a chapter on screen is a lecture opened');
  assert.match(GUIDE, /onLecturesOpened\(res\.data\.chapters\.map/);
  for (const wiring of [/onGenerated=\{markOpened\}/, /onLecturesOpened=\{markOpened\}/]) {
    assert.match(FOCUS, wiring);
  }
  assert.equal((FOCUS.match(/onLecturesOpened=\{markOpened\}/g) || []).length, 2,
    'the handbook and the paper guide both report');
});

test('opened lectures are written through as they happen', () => {
  assert.match(FOCUS, /StudySession\.update\(sessionId, \{ opened_lecture_ids: merged \}\)/,
    'a browser that dies mid-session must not lose the record');
  assert.match(FOCUS, /openedRef\.current/,
    'three tools can report in one tick; state would only see what each started from');
  assert.match(FOCUS, /useCallback/,
    'HandbookReader fires this from an effect — an unstable identity would loop it');
});

test('the handbook effect cannot loop on an inline callback', () => {
  const effect = HANDBOOK.slice(HANDBOOK.indexOf('if (!onLecturesOpened || !handbook'));
  const deps = effect.slice(effect.indexOf('}, ['), effect.indexOf('}, [') + 60);
  assert.doesNotMatch(deps, /onLecturesOpened/);
});

test('the browser no longer merges coverage by hand', () => {
  for (const [name, src] of [['InLectureQuiz', QUIZ], ['HandbookReader', HANDBOOK]]) {
    assert.doesNotMatch(src, /KnowledgeCoverage\.(create|update|filter)/,
      `${name} still writes the coverage table directly — that is the race that produced a duplicate row on a live account`);
    assert.match(src, /invoke\('recordStudyCoverage'/, `${name} should record through the one writer`);
  }
});

test('a coverage failure never tells a student their session was lost', () => {
  const stop = FOCUS.slice(FOCUS.indexOf('const handleStop'), FOCUS.indexOf('// Cancel without saving'));
  assert.match(stop, /invoke\('recordStudyCoverage'/);
  assert.match(stop, /catch \(e\) \{\s*\n\s*console\.error\('Could not record study coverage/);
  assert.match(stop, /StudySession\.update\(session\.id, \{ status: 'completed' \}\)/,
    'the session still has to close when the ledger write fails');
});
