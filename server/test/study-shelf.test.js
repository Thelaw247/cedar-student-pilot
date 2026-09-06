import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { scopeBlockReason, windowBlockReason } from '../../src/lib/studyShelf.js';
import { localDay, daysAgo } from '../../src/lib/localDay.js';

/**
 * Phase 2 of the navigation teardown: every tool on one shelf.
 *
 * Three complaints in the same report turned out to be one defect. "Quiz me
 * says it can't generate a quiz" — the generator was fine, the window was
 * empty: the button asked for lectures dated today when the newest lecture
 * was two days old. "Review asks whether I want a quiz or the handbook" — a
 * fork standing where the material should have been. And the handbook wall,
 * hit twelve times in a single day by an account on a plan that does not
 * include it.
 *
 * All three are the app knowing something before the tap and not saying so.
 * So: no question before the material, and a tool that cannot run is visible
 * and greyed WITH ITS REASON.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const SHELF = read('../../src/components/StudyShelf.jsx');
const PANEL = read('../../src/components/PracticePanel.jsx');
const PLANNER = read('../../src/pages/StudyPlanner.jsx');
const REVIEW = read('../../src/pages/LectureReview.jsx');

// --- the reasons, which are the whole point -------------------------------

test('a blocked tool says which of the three things is wrong', () => {
  assert.equal(scopeBlockReason({ classId: '' }), 'Pick a class first');
  assert.equal(scopeBlockReason({ classId: '', hasClasses: false }), 'Add a class first',
    'there is nothing to pick on a brand-new account');
  assert.equal(scopeBlockReason({ classId: 'c1', lectureCount: 0 }), 'This class has no lectures yet');
  assert.equal(scopeBlockReason({ classId: 'c1', lectureCount: 9, lectureIds: [] }),
    'Select at least one lecture above');
  assert.equal(scopeBlockReason({ classId: 'c1', lectureCount: 9, lectureIds: ['l1'] }), null,
    'a usable selection must not be greyed out');
});

test("today's review greys itself out on the day it cannot work", () => {
  // The reported bug, exactly: newest lecture 2 September, today the 6th.
  const today = localDay();
  const done = { date: today, ai_summary: 'x' };
  assert.equal(windowBlockReason([{ date: daysAgo(2), ai_summary: 'x' }], today, today, 'dated today'),
    'No lectures dated today');
  assert.equal(windowBlockReason([done], today, today, 'dated today'), null);
});

test('a lecture that is still processing gets its own sentence', () => {
  // Not the same wall: waiting is worth knowing about, and the runner says so
  // too — but only after a tap and a page load.
  const today = localDay();
  const raw = [{ date: today }, { date: today, ai_concepts: [] }];
  assert.equal(windowBlockReason(raw, today, today, 'dated today'),
    '2 lectures dated today, still processing');
  assert.equal(windowBlockReason([{ date: today }], today, today, 'dated today'),
    '1 lecture dated today, still processing');
  // Any one of the three content columns is enough to build questions from.
  for (const ready of [{ transcript: 't' }, { ai_summary: 's' }, { ai_concepts: ['c'] }]) {
    assert.equal(windowBlockReason([{ date: today, ...ready }], today, today, 'dated today'), null);
  }
});

test('the week window matches the server, inclusive at both ends', () => {
  // The server asks for `date between (today - 7 days) and today`. A window
  // one day narrower here would grey out a review that would have worked,
  // which is the same disease pointing the other way.
  const today = localDay();
  const from = daysAgo(7);
  assert.equal(windowBlockReason([{ date: from, ai_summary: 'x' }], from, today, 'in the past 7 days'), null);
  assert.equal(windowBlockReason([{ date: daysAgo(8), ai_summary: 'x' }], from, today, 'in the past 7 days'),
    'No lectures in the past 7 days');
});

test('an unknown window stays live rather than greying itself out', () => {
  // The shelf is handed the lectures the page already loaded; when it has not
  // been handed any, it does not get to guess. Greying a working button would
  // be a worse bug than the one being fixed.
  assert.equal(windowBlockReason(null, '2026-01-01', '2026-01-08', 'dated today'), null);
  assert.equal(windowBlockReason(undefined, '2026-01-01', '2026-01-08', 'dated today'), null);
  // And a row with no date at all cannot be counted as being in any window.
  assert.equal(windowBlockReason([{ ai_summary: 'x' }], '2026-01-01', '2026-01-08', 'x'), 'No lectures x');
});

// --- no question before the material --------------------------------------

test('the quiz-or-handbook fork is gone, and both are tiles instead', () => {
  assert.equal(fs.existsSync(new URL('../../src/components/ReviewModeChooser.jsx', import.meta.url)), false,
    'the chooser is still on disk');
  assert.doesNotMatch(REVIEW, /ReviewModeChooser/);
  assert.match(REVIEW, /const mode = searchParams\.get\('mode'\) \|\| 'quiz'/,
    'a link with no mode has to land on something, not on a question');
  // The shelf links straight to the one it means.
  assert.match(SHELF, /mode=quiz/);
  assert.match(SHELF, /title="Handbook"/);
  assert.match(SHELF, /title="Quiz me"/);
});

test('the second class picker and the second lecture picker are gone', () => {
  assert.equal(fs.existsSync(new URL('../../src/components/ReviewFromLectures.jsx', import.meta.url)), false,
    'the review panel with its own two pickers is still on disk');
  assert.doesNotMatch(PLANNER, /ReviewFromLectures/);
  // One picker, in the panel that owns the scope.
  assert.equal((PANEL.match(/<LectureScopePicker/g) || []).length, 1);
  assert.doesNotMatch(SHELF, /LectureScopePicker/, 'the shelf grew a picker of its own');
  assert.doesNotMatch(SHELF, /<select/, 'the shelf grew a class picker of its own');
});

test('every tool on the shelf works on the selection made above it', () => {
  assert.match(PANEL, /<StudyShelf/);
  assert.match(PANEL, /lectureIds=\{reviewLectureIds\}/);
  assert.match(PANEL, /const reviewLectureIds = explicitScopeIds\(scopeIds, lectures\)/,
    'the review runner takes ids in a URL and has no "whole class" shorthand to expand');
  // Both tools sit under the same picker, in the same panel.
  const shelfAt = PANEL.indexOf('<StudyShelf');
  const toolboxAt = PANEL.indexOf('<StudyToolbox');
  const pickerAt = PANEL.indexOf('<LectureScopePicker');
  assert.ok(pickerAt > 0 && pickerAt < shelfAt && shelfAt < toolboxAt,
    'the shelf and the toolbox must both come after the one picker');
});

test('a whole-class handbook is still asked for the way it always was', () => {
  // generateClassHandbook caches under scope_key 'full' when no lecture_ids
  // are sent, and under the sorted id list when they are. Sending every id
  // for a whole-class handbook would miss the row it already has and
  // regenerate it — at cost, silently.
  assert.match(SHELF, /const scopedIds = wholeClass \? null : lectureIds/);
  assert.match(SHELF, /lectureIds=\{scopedIds\}/);
  assert.match(PANEL, /wholeClass=\{wholeClass\}/);
  assert.match(PANEL, /const wholeClass = resolveScopeIds\(scopeIds, lectures\)\?\.length === 0/);
});

test('a tier refusal is a tile you can press, not a wall you walk into', () => {
  // Twelve handbook refusals in one day on a Student account. The gate is
  // read before the tap now, and the locked tile opens the upgrade sheet.
  assert.match(SHELF, /useFeatureGate\('handbook'\)/);
  assert.match(SHELF, /useFeatureGate\('lecture_review'\)/);
  assert.match(SHELF, /Unlocks with \{lockedTierName\} — tap to upgrade/);
  assert.match(SHELF, /onClick=\{onLock\}/);
  // The paper guide calls generateClassHandbook too, so it shares that gate
  // rather than being offered on a plan that cannot run it.
  const guide = SHELF.slice(SHELF.indexOf('title="Paper guide"'), SHELF.indexOf('title="Today\'s lectures"'));
  assert.match(guide, /lockedTierName=\{handbook\.allowed \? null : handbook\.requiredTierName\}/);
});

test('a tool that cannot run is greyed, never hidden and never live', () => {
  // "Visible and greyed with the reason on it" — hiding it sends the student
  // looking for it, and leaving it live is the dead end.
  assert.match(SHELF, /aria-disabled="true"/);
  assert.match(SHELF, /cursor-not-allowed/);
  assert.match(SHELF, /\{disabledReason\}/);
  // Five tools, and every one of them can say why it is unavailable.
  assert.equal((SHELF.match(/disabledReason=\{/g) || []).length, 5);
  // The two that go by date are kept apart from the three that use the
  // selection, so nobody has to wonder why "today" ignored their picker.
  assert.match(SHELF, /Or catch up across every class/);
  const byDate = SHELF.slice(SHELF.indexOf('Or catch up across every class'));
  assert.match(byDate, /title="Today's lectures"/);
  assert.match(byDate, /title="This week"/);
  assert.doesNotMatch(byDate, /disabledReason=\{scopeReason\}/,
    'a by-date tool must not be greyed out by the lecture selection');
});

test('the page hands the shelf the lectures it already loaded', () => {
  // The planner fetches every lecture in the semester for the coverage
  // checklist. Fetching them a second time inside the shelf would be a
  // needless query on a tab students open constantly.
  assert.match(PLANNER, /allLectures=\{lectures\}/);
  assert.doesNotMatch(SHELF, /base44/, 'the shelf fetches data of its own');
});
