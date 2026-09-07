import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { goalMinutesFor, DEFAULT_GOAL_MINUTES } from '../../src/lib/studySession.js';

/**
 * Seven things the study page got wrong, reported together.
 *
 * Each is small on its own. Together they are one shape: the timer decided
 * things it had no business deciding — how long you were studying, whether
 * that counted, where you went when it ended — and offered the settings only
 * once it was too late to want them.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const TIMER = read('../../src/study/StudyTimer.jsx');
const CTX = read('../../src/study/StudySessionContext.jsx');
const TOOLBOX = read('../../src/components/StudyToolbox.jsx');
const RAIL = read('../../src/components/DesktopRail.jsx');

// 1 — two buttons that both said "quiz" ------------------------------------

test('the quiz that runs and the questions that are saved are not both "Quiz"', () => {
  const SHELF = read('../../src/components/StudyShelf.jsx');
  // The runner keeps the name, because running questions at you IS being
  // quizzed. The maker says what it makes and where it goes.
  assert.match(SHELF, /title="Quiz me"/);
  assert.doesNotMatch(TOOLBOX, /label: 'Quiz'/);
  assert.match(TOOLBOX, /label: 'Practice questions'/);
  // The server still accepts material_type 'quiz' — old rows and any future
  // caller keep working; it is the second tile that went, not the type.
  const SERVER = read('../routes/generateStudyMaterial.js');
  assert.match(SERVER, /material_type === 'quiz' \|\| material_type === 'practice_test'/);
});

// 2 — finishing a session dumped you on Analytics ---------------------------

test('finishing asks one question, and "no" leaves you where you were', () => {
  const prompt = TIMER.slice(TIMER.indexOf("s.phase === 'review_prompt'"), TIMER.indexOf('{showReview &&'));
  assert.match(prompt, /Review what I studied/);
  assert.match(prompt, /No thanks/);
  assert.doesNotMatch(prompt, /Analytics/, 'finishing must not route anywhere');
  assert.doesNotMatch(prompt, /navigate\(/, 'the answer "no" is not a navigation');
  // Nor does finishing the review itself.
  const review = TIMER.slice(TIMER.indexOf('{showReview &&'), TIMER.indexOf('project_end'));
  assert.match(review, /onClose=\{\(\) => \{ setShowReview\(false\); s\.reset\(\); \}\}/);
  assert.doesNotMatch(review, /navigate\('\/analytics'\)/);
});

// 3 — the rail's Quick actions duplicated the + button ----------------------

test('the rail only tells you things now', () => {
  assert.doesNotMatch(RAIL, /QUICK_ACTIONS/);
  assert.doesNotMatch(RAIL, />\s*Quick actions\s*</);
});

// 4 & 6 — the session length, and when you can set anything -----------------

test('every setting is there before the clock starts, not only after', () => {
  // The settings block is built once and rendered in both shapes, so it cannot
  // be phase-gated in one and not the other.
  const settings = TIMER.slice(TIMER.indexOf('const settings = ('), TIMER.indexOf('const discardConfirm'));
  assert.doesNotMatch(settings, /phase === 'studying'/, 'a setting you can only change too late');
  assert.doesNotMatch(settings, /phase === 'paused'/);
  assert.match(settings, /label="Session"/);
  assert.match(settings, /label="Study"/);
  assert.match(settings, /label="Break"/);
  assert.match(settings, /s\.setGoalMinutes/);
  // Rendered by both variants.
  assert.equal((TIMER.match(/\{settings\}/g) || []).length, 2);
});

test('the goal is prefilled only when a session actually carried one', () => {
  assert.equal(goalMinutesFor({ duration_minutes: 45 }), 45);
  assert.equal(goalMinutesFor(null), DEFAULT_GOAL_MINUTES, 'an ad-hoc sitting still needs a number');
  // …and only the real thing gets to claim it came from the session.
  assert.match(CTX, /setGoalFromSession\(Boolean\(next\.goalMinutes\) \|\| Number\(nextSession\?\.duration_minutes\) > 0\)/);
  // Changing it by hand stops it claiming that.
  assert.match(CTX, /const setGoalMinutes = useCallback\(\(m\) => \{\s*\n\s*setGoalMinutesState\(m\);\s*\n\s*setGoalFromSession\(false\);/);
  assert.match(TIMER, /note=\{s\.goalFromSession \? 'from your booked session' : null\}/);
});

// 5 — the digits did not fit the ring --------------------------------------

test('the small ring shows progress; the clock gets its own room', () => {
  // 25:00 at a legible size does not fit a 44px circle. The ring is a progress
  // indicator, which works at any size; the time is a number and needs space.
  assert.match(TIMER, /const ring = \(size, withTime\) =>/);
  assert.match(TIMER, /\{ring\(36, false\)\}/, 'the strip ring must carry no text');
  assert.match(TIMER, /\{ring\(256, true\)\}/, 'the big ring keeps its centred time');
  assert.match(TIMER, /text-2xl font-bold tabular-nums/, 'the strip clock is a real number');
});

test('the settings dropdown survives a ticking clock', () => {
  // StudyTimer re-renders once a second. A component declared inside its body
  // is a new type on every one of those renders, so React would unmount and
  // remount the <select> — closing the dropdown as the student opened it.
  assert.match(TIMER, /^function Field\(/m);
  const body = TIMER.slice(TIMER.indexOf('export default function StudyTimer'));
  assert.doesNotMatch(body, /const Field = /, 'Field must not be defined per render');
});

// 7 — no way out that was not a row in Analytics ---------------------------

test('a mistaken Start can be cancelled without becoming a session', () => {
  assert.match(CTX, /const discard = useCallback\(\(\) => \{/);
  const discard = CTX.slice(CTX.indexOf('const discard = useCallback'), CTX.indexOf('Stop and save. The order here'));
  // It records nothing.
  assert.doesNotMatch(discard, /StudyRecord\.create/);
  assert.doesNotMatch(discard, /recordStudyCoverage/);
  // It clears the clock…
  assert.match(discard, /setPhase\('idle'\)/);
  assert.match(discard, /setStudySeconds\(0\); studySecondsRef\.current = 0;/);
  assert.match(discard, /setCycles\(0\)/);
  // …and keeps what is being studied. You cancelled a timer, not your plans.
  for (const kept of [/setSession\(/, /setClassId\(/, /setLectureIds\(/, /setGoalMinutesState\(/, /openedRef/]) {
    assert.doesNotMatch(discard, kept, 'discard threw away more than the clock');
  }
  // And it is reachable whenever stopping is.
  assert.match(TIMER, /Cancel this session without saving/);
  assert.match(TIMER, /const askBeforeDiscard = t\.studySeconds >= 60/,
    'forty minutes should not vanish on one tap, and one minute needs no ceremony');
});

test('a finished session is not re-adopted on reload', () => {
  // The URL keeps ?sessionId after a save. Without this the clock would prime
  // itself against a completed row and claim its goal came from the booking.
  const PLANNER = read('../../src/pages/StudyPlanner.jsx');
  assert.match(PLANNER, /if \(s\.status === 'completed'\) return;/);
});

test('discard and reset are different things', () => {
  // reset() clears the scope too — it is what runs after a session is saved
  // and finished with. discard() keeps it, so Start works again immediately.
  const reset = CTX.slice(CTX.indexOf('const reset = useCallback'), CTX.indexOf('Throw this sitting away'));
  assert.match(reset, /setSession\(null\)/);
  assert.match(reset, /setLectureIds\(\[\]\)/);
});
