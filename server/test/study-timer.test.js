import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  goalMinutesFor, deriveStudyMode, deriveStudyType, formatClockSeconds,
  DEFAULT_GOAL_MINUTES,
} from '../../src/lib/studySession.js';

/**
 * Phase 3 of the navigation teardown: the timer moves, the wizard dies.
 *
 * The riskiest phase, because the machinery that runs when a session STOPS is
 * the machinery nothing on screen reports. If the study record stops being
 * written, Analytics quietly flattens. If recordStudyCoverage stops being
 * called, finishing a session stops ticking lectures off and every freshness
 * badge stays grey — and the student is told "Session saved" either way.
 *
 * So it moved whole, and this pins both halves: the arithmetic that replaced
 * the wizard's three questions, and the wiring that must still be there.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const CTX = read('../../src/study/StudySessionContext.jsx');
const TIMER = read('../../src/study/StudyTimer.jsx');
const LAYOUT = read('../../src/components/Layout.jsx');
const PLANNER = read('../../src/pages/StudyPlanner.jsx');

// --- what the wizard used to ask, answered from the row --------------------

test('a second session cannot hijack the pickers while the first is running', () => {
  const adopt = CTX.slice(CTX.indexOf('const adopt = useCallback'), CTX.indexOf('const start = useCallback'));
  assert.match(adopt, /if \(phaseRef\.current !== 'idle'\) return false;/);
  assert.match(adopt, /return true;/);
  assert.match(PLANNER, /const took = studySession\.adopt\(/);
  assert.match(PLANNER, /if \(took\) setScope\(/);
});

test('a booked session sets its own goal, and a bad row cannot', () => {
  assert.equal(goalMinutesFor({ duration_minutes: 45 }), 45);
  assert.equal(goalMinutesFor({ duration_minutes: '90' }), 90, 'numeric columns arrive as strings');
  assert.equal(goalMinutesFor({ duration_minutes: 46.4 }), 46);
  // Outside the range it is a bad row, not a goal — a two-minute "session"
  // would complete the instant it started, and a nine-hour one never would.
  for (const bad of [0, 4, 481, -30, null, undefined, NaN, 'soon']) {
    assert.equal(goalMinutesFor({ duration_minutes: bad }), DEFAULT_GOAL_MINUTES, `${bad} became a goal`);
  }
  assert.equal(goalMinutesFor(null), DEFAULT_GOAL_MINUTES, 'an ad-hoc sitting still has a goal');
});

test('the mode is read off the session, and left empty when nothing says', () => {
  assert.equal(deriveStudyMode({ session_type: 'review' }), 'review');
  assert.equal(deriveStudyMode({ session_type: 'study' }), 'deep');
  // An exam or quiz in scope is what "sprint" always meant, and it outranks
  // the session type — a study block booked for Midterm 2 is exam prep.
  assert.equal(deriveStudyMode({ session_type: 'study' }, { type: 'exam' }), 'sprint');
  assert.equal(deriveStudyMode({ session_type: 'review' }, { type: 'quiz' }), 'sprint');
  // An essay or a project deadline is not a test.
  assert.equal(deriveStudyMode({ session_type: 'study' }, { type: 'assignment' }), 'deep');
  // And where nothing says, nothing is written. A guessed label in a column
  // Analytics reads as fact is worse than an absent one.
  assert.equal(deriveStudyMode(null), null);
  assert.equal(deriveStudyMode(null, { type: 'assignment' }), null);
  assert.equal(deriveStudyMode({ session_type: 'project' }), null);
});

test('every derived value satisfies the column it is written to', () => {
  // study_records_study_mode_check: deep | sprint | review (nullable)
  // study_records_study_type_check: in_app | manual (NOT NULL)
  const modes = new Set(['deep', 'sprint', 'review', null]);
  const sessions = [null, { session_type: 'study' }, { session_type: 'review' }, { session_type: 'project' }, {}];
  const assignments = [null, { type: 'exam' }, { type: 'quiz' }, { type: 'assignment' }, { type: 'project' }, {}];
  for (const s of sessions) {
    for (const a of assignments) {
      assert.ok(modes.has(deriveStudyMode(s, a)), `${JSON.stringify([s, a])} produced an invalid study_mode`);
    }
  }
  for (const v of [true, false, undefined, null, 0, 1]) {
    assert.ok(['in_app', 'manual'].includes(deriveStudyType(v)), `${v} produced an invalid study_type`);
  }
});

test('study_type records what happened, not what was promised', () => {
  // The wizard asked in advance and believed the answer, so a student who
  // said "on paper" and then read the handbook was filed as having studied on
  // paper. A timer that ran with nothing opened in the app IS manual study.
  assert.equal(deriveStudyType(true), 'in_app');
  assert.equal(deriveStudyType(false), 'manual');
  assert.match(CTX, /study_type: deriveStudyType\(usedInAppRef\.current\)/);
  // Any tool sets it, including one that reports no lecture ids at all —
  // generating from a whole class is still studying in the app.
  const marked = CTX.slice(CTX.indexOf('const markOpened = useCallback'));
  const flagAt = marked.indexOf('usedInAppRef.current = true');
  const returnAt = marked.indexOf('if (incoming.length === 0) return;');
  assert.ok(flagAt > -1 && flagAt < returnAt, 'the flag must be set before the empty-list early return');
});

test('the clock is mm:ss and never negative', () => {
  assert.equal(formatClockSeconds(0), '00:00');
  assert.equal(formatClockSeconds(65), '01:05');
  assert.equal(formatClockSeconds(3600), '60:00');
  assert.equal(formatClockSeconds(-5), '00:00', 'an overrun countdown must not render -1:-5');
  assert.equal(formatClockSeconds(undefined), '00:00');
});

// --- the machinery that had to move whole ----------------------------------

test('stopping still writes the record, the coverage and the fallback close', () => {
  const stop = CTX.slice(CTX.indexOf('const stop = useCallback'));
  assert.match(stop, /StudyRecord\.create\(\{/);
  assert.match(stop, /invoke\('recordStudyCoverage'/);
  assert.match(stop, /session_id: id \|\| null/);
  assert.match(stop, /lecture_ids: openedRef\.current/);
  assert.match(stop, /StudySession\.update\(session\.id, \{ status: 'completed' \}\)/);
  // An ad-hoc sitting with no session row still records what it opened.
  assert.match(stop, /if \(id \|\| \(coverageClassId && openedRef\.current\.length > 0\)\)/);
  // A sitting shorter than a second is not a session and must not create a row.
  assert.match(stop, /if \(studySecondsRef\.current < 1\)/);
});

test('the clock survives the tools, because it is above the router', () => {
  assert.match(LAYOUT, /<StudySessionProvider>/);
  const providerAt = LAYOUT.indexOf('<StudySessionProvider>');
  const outletAt = LAYOUT.indexOf('<Outlet />');
  assert.ok(providerAt > 0 && providerAt < outletAt, 'the provider must wrap the routed pages');
  // Exactly one clock in the app. A second setInterval is a second source of
  // truth for how long the student has studied.
  const files = fs.readdirSync(new URL('../../src', import.meta.url), { recursive: true })
    .filter((f) => String(f).endsWith('.jsx') || String(f).endsWith('.js'));
  const tickers = files.filter((f) => /setInterval\(\(\) => \{[\s\S]{0,80}phaseRef/.test(read(`../../src/${f}`)));
  assert.deepEqual(tickers, ['study/StudySessionContext.jsx']);
});

test('the clock does not rebuild the page it sits on', () => {
  // The study page is a consumer, so a single context would rebuild the
  // lecture picker, the deadline cards and the whole tool shelf once a second
  // for a number none of them shows.
  assert.match(CTX, /const StudyTickContext = createContext\(null\)/);
  assert.match(CTX, /export function useStudyTick/);
  assert.match(CTX, /const value = useMemo\(\(\) => \(\{/);
  assert.match(CTX, /const tick = useMemo\(\(\) => \(\{\s*\n\s*studySeconds, intervalSecondsLeft, displayTime, goalProgress, ringProgress,/);
  // Only the two things that render a time subscribe to the time.
  const subscribers = fs.readdirSync(new URL('../../src', import.meta.url), { recursive: true })
    .filter((f) => (String(f).endsWith('.jsx') || String(f).endsWith('.js')))
    .filter((f) => f !== 'study/StudySessionContext.jsx') // where it is defined
    .filter((f) => /useStudyTick\(\)/.test(read(`../../src/${f}`)));
  assert.deepEqual(subscribers.sort(), ['study/NavStudyClock.jsx', 'study/StudyTimer.jsx']);
  assert.doesNotMatch(PLANNER, /useStudyTick/);
});

test('switching timer mode is not done inside a state updater', () => {
  // React calls an updater twice under StrictMode. These are side effects —
  // the interval would be recomputed against a value it had already moved
  // past, so a Pomodoro switch could lose part of a cycle.
  const change = CTX.slice(CTX.indexOf('const changeMode = useCallback'), CTX.indexOf('const markOpened'));
  assert.doesNotMatch(change, /setMode\(\(current\)/);
  assert.match(change, /if \(modeRef\.current === newMode\) return;/);
  assert.match(change, /setMode\(newMode\);/);
});

test('one timer component in two shapes, not two timers', () => {
  assert.match(TIMER, /variant = 'strip'/);
  assert.match(TIMER, /if \(variant === 'full'\)/);
  assert.doesNotMatch(TIMER, /useState\(0\)/, 'the timer must not hold clock state of its own');
  assert.match(TIMER, /const s = useStudySession\(\)/);
  assert.match(TIMER, /const t = useStudyTick\(\)/);
  // Both shapes are driven by the same controls, so pause on one page cannot
  // mean something different from pause on another.
  assert.equal((TIMER.match(/const controls = \(/g) || []).length, 1);
  // Session completion moved with the engine: the save prompt, the review
  // offer and the project end all live here rather than on either page.
  for (const piece of [/Session saved/, /<SessionReview/, /<ProjectSessionEndModal/, /Study interval complete/]) {
    assert.match(TIMER, piece);
  }
  assert.doesNotMatch(PLANNER, /SessionReview|ProjectSessionEndModal/);
});

test('the study page holds the clock but does not run it', () => {
  assert.match(PLANNER, /<StudyTimer variant="strip"/);
  // Above the tabs, so switching to Plan does not stop it.
  const timerAt = PLANNER.indexOf('<StudyTimer variant="strip"');
  const tabsAt = PLANNER.indexOf('<Segmented');
  assert.ok(timerAt > 0 && timerAt < tabsAt, 'the clock must sit above the tabs');
});

test('a running session is visible from every page', () => {
  // The provider is what stops a quiz ending a session; the indicator is what
  // stops a session being left counting on a page that never mentions it.
  const CLOCK = read('../../src/study/NavStudyClock.jsx');
  assert.match(CLOCK, /if \(to !== '\/study' \|\| !s\.running\) return null/);
  assert.match(read('../../src/components/Sidebar.jsx'), /<NavStudyClock to=\{item\.to\} \/>/);
  assert.match(read('../../src/components/BottomNav.jsx'), /<NavStudyDot to=\{item\.to\} \/>/);
  // And the nav item it hangs on is the page with the controls.
  assert.match(read('../../src/lib/navItems.js'), /to: '\/study',\s+label: 'Study'/);
});
