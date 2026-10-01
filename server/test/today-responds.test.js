import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classifySaveError, describeSaveError, SAVE_ERROR } from '../../shared/saveErrors.js';

/**
 * Two controls on /today were being hammered — "Yes" on the attendance
 * question up to six times in a row, "Try again" on the recording island up
 * to twelve — by two different students on two different days. A button
 * pressed that hard is a button that failed without saying so. These tests
 * hold the fixes: every failure on that page says what went wrong and what
 * to do next, nothing retries a request that cannot succeed, nothing covers
 * a button on a phone, and the targets are big enough for a thumb.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PROMPT = read('../../src/components/AttendancePrompt.jsx');
const CONTEXT = read('../../src/recording/RecordingContext.jsx');
const ISLAND = read('../../src/recording/RecordingIsland.jsx');
const CLIENT = read('../../src/lib/cedarClient.js');
const QUICK = read('../../src/recording/useQuickRecord.js');
const NAV = read('../../src/components/BottomNav.jsx');
const NOTIFIER = read('../../src/components/StudySessionNotifier.jsx');

// --------------------------------------------------------------- "Yes"

test('an attendance answer that fails says so, with the next step', () => {
  assert.match(PROMPT, /setError\(describeAttendanceError\(e\)\)/, 'the failure is shown, not only logged');
  assert.match(PROMPT, /role="alert"/);
  assert.match(PROMPT, /kind === 'signed_out'/);
  assert.match(PROMPT, /to="\/login"/, 'an ended session links to sign-in');
  // The spinner sits on the button that was pressed.
  assert.match(PROMPT, /submitting === 'no' \?/);
  assert.match(PROMPT, /submitting === 'yes' \?/);
  assert.match(PROMPT, /disabled=\{!!submitting\}/);
  // A second tap while the first is in flight does nothing.
  assert.match(PROMPT, /if \(!current \|\| submitting\) return;/);
});

test('an attendance answer given offline is queued, and a saved one refreshes the page', () => {
  assert.match(PROMPT, /navigator\.onLine === false/);
  assert.match(PROMPT, /enqueueOperation\(\{ entity: 'ClassAttendance', operation: 'create', args: \[row\] \}\)/);
  assert.match(PROMPT, /announceDataChange\(\['ClassAttendance'\]\)/, 'the progress ring reads the same rows');
  // "Ask me later" outlives a tab switch.
  assert.match(PROMPT, /sessionStorage\.setItem\(DISMISSED_KEY, '1'\)/);
  assert.match(PROMPT, /useState\(wasDismissedThisSession\)/);
});

test('a write no longer costs an auth round trip before the insert', () => {
  assert.match(CLIENT, /async function sessionUser\(\)/);
  assert.match(CLIENT, /supabase\.auth\.getSession\(\)/);
  const createBody = CLIENT.slice(CLIENT.indexOf('async create(fields)'), CLIENT.indexOf('async bulkCreate'));
  assert.doesNotMatch(createBody, /getUser\(\)/, 'create() re-validates the token on the auth server before every insert');
  assert.match(createBody, /await sessionUser\(\)/);
});

test('the attendance error copy covers the three things that actually happen', () => {
  // Pulled out of the component so the sentences can be checked without a DOM.
  const src = PROMPT.slice(PROMPT.indexOf('export function describeAttendanceError'), PROMPT.indexOf('export default function'));
  assert.match(src, /signed_out/);
  assert.match(src, /network/);
  assert.match(src, /unknown/);
  assert.match(src, /Tap again/);
});

// ---------------------------------------------------------- "Try again"

test('an empty recording is its own kind, and the island offers Discard rather than a retry that cannot work', () => {
  const c = classifySaveError(new Error('The recording is empty. Please record it again.'));
  assert.equal(c.kind, SAVE_ERROR.EMPTY);
  assert.equal(c.retryNow, false);
  const copy = describeSaveError(c);
  assert.match(copy.title, /nothing to save/i);
  assert.match(copy.body, /Discard it and record again/);
  assert.match(ISLAND, /const nothingToSave = failure\?\.kind === 'empty';/);
  assert.match(ISLAND, /\{!nothingToSave && \(/, 'the retry button must be gone for an empty recording');
});

test("a server-side reason is shown as itself, not as 'check your connection'", () => {
  for (const msg of [
    'The AI service was overloaded. Your recording is saved — try again in a few minutes.',
    'The operation was aborted due to timeout',
    'Processing is taking unusually long. Your recording is saved — please try again shortly.',
    'Processing failed.',
  ]) {
    const c = classifySaveError(new Error(msg));
    assert.equal(c.kind, SAVE_ERROR.UNKNOWN, `"${msg}" was classified as ${c.kind}`);
    assert.equal(c.retryNow, true);
    assert.ok(describeSaveError(c).body.includes(msg), 'the server sentence must reach the screen');
  }
  // The browser's own words still mean the network.
  for (const msg of ['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.']) {
    assert.equal(classifySaveError(new Error(msg)).kind, SAVE_ERROR.NETWORK, msg);
  }
  assert.equal(classifySaveError({ status: 0, message: '' }).kind, SAVE_ERROR.NETWORK);
});

test('every failed save sets the classified half the island reads, and a failed segment is kept for the retry', () => {
  assert.match(CONTEXT, /const failSave = \(error\) => \{/);
  // The three failures that used to set only the string.
  const rotateCatch = CONTEXT.slice(CONTEXT.indexOf('const rotateSegment'), CONTEXT.indexOf('const finalizeRecording'));
  const finalizeCatch = CONTEXT.slice(CONTEXT.indexOf('const finalizeRecording'), CONTEXT.indexOf('// The 1-second clock'));
  assert.match(rotateCatch, /await keepSegmentForRetry\(failedBlob/);
  assert.match(rotateCatch, /failSave\(new Error\(`A recording segment could not be uploaded/);
  assert.match(finalizeCatch, /await keepSegmentForRetry\(lastBlob/);
  assert.match(finalizeCatch, /failSave\(new Error\(`Could not finish uploading the last part/);
  assert.doesNotMatch(rotateCatch, /setSaveError\('A recording segment/, 'the bare string is back');
  // keepSegmentForRetry feeds the same path crash recovery uses.
  assert.match(CONTEXT, /recoveredBlobRef\.current = blob;\s*setRecoveredBlob\(blob\);/);
  // The interruption is a notice on a fine recording, and the island shows it.
  assert.match(ISLAND, /\{!failure && !rec\.recoveredOnBoot && rec\.saveError && \(/);
});

test('a save cannot be started twice, and the island says where to turn after repeated failures', () => {
  assert.match(CONTEXT, /const savingRef = useRef\(false\);/);
  assert.match(CONTEXT, /if \(!activeCls \|\| savingRef\.current\) return;/);
  // Released on every exit: the two successes and the failure.
  assert.equal((CONTEXT.match(/savingRef\.current = false;/g) || []).length, 3);
  assert.match(ISLAND, /disabled=\{rec\.processing\}/);
  assert.match(ISLAND, /const stuck = failure && failedTries >= 2;/);
  assert.match(ISLAND, /SUPPORT_MAILTO/, 'the support address is imported, never typed');
  assert.match(ISLAND, /rec\.pendingLectureId/);
  assert.match(CONTEXT, /^\s+pendingLectureId,$/m, 'the island needs the lecture id for the support line');
  // 44px rows.
  assert.match(ISLAND, /const primaryClass = 'flex-\[2\] min-h-\[44px\]/);
  assert.match(ISLAND, /const secondaryClass = 'flex-1 min-h-\[44px\]/);
});

test('a lecture is dated on the student’s own calendar day', () => {
  assert.match(CONTEXT, /import \{ localDay \} from '@\/lib\/localDay';/);
  assert.match(CONTEXT, /const today = localDay\(\);/);
  assert.doesNotMatch(CONTEXT, /toISOString\(\)\.split\('T'\)\[0\]/, 'a UTC date on a lecture again');
});

test('a refused microphone from the status bar reaches the modal that explains it', () => {
  assert.match(QUICK, /if \(outcome !== 'started'\)/);
  assert.doesNotMatch(QUICK, /if \(!ok\)/, "start() never returns a falsy value, so '!ok' never navigated");
});

// ------------------------------------------------------------------ phone

test('the bottom nav sits below the sheets, and the sheets clear the home indicator', () => {
  assert.match(NAV, /fixed bottom-0 inset-x-0 z-40/);
  assert.doesNotMatch(NAV, /inset-x-0 z-50/, 'the nav draws over the bottom sheets again');
  for (const p of ['AddEventModal', 'AddExamOrStudyModal', 'RebookSessionModal']) {
    const src = read(`../../src/components/${p}.jsx`);
    assert.match(src, /pb-\[calc\(1\.5rem\+env\(safe-area-inset-bottom\)\)\] sm:pb-6/, `${p}: no room for the home indicator`);
  }
});

test('the small targets on Today are at least 40px tall, and the dismiss crosses have a 44px hit area', () => {
  assert.match(PROMPT, /min-h-\[44px\] items-center justify-center px-4 text-xs/, '"Ask me later" was 16px tall');
  assert.match(read('../../src/components/DetectedDeadlines.jsx'), /min-h-\[40px\] px-4 py-2 rounded-lg bg-primary/);
  assert.match(read('../../src/components/TodayIntelligenceCard.jsx'), /inline-flex min-h-\[40px\] items-center gap-1\.5 px-4 py-2 rounded-lg bg-rose-600/);
  for (const p of ['TodayIntelligenceCard', 'RiskIndicatorCard']) {
    const src = read(`../../src/components/${p}.jsx`);
    assert.doesNotMatch(src, /p-1 -m-1/, `${p}: a 22px dismiss cross`);
    assert.match(src, /p-3 -m-3/);
  }
});

test('the rebook confirmation reads the data envelope and a failed rebook says why', () => {
  assert.match(NOTIFIER, /setRebookResult\(result\?\.data \|\| result\)/);
  assert.match(NOTIFIER, /gateFromError\(e\)/);
  assert.match(NOTIFIER, /status === 409/);
  assert.match(NOTIFIER, /'Not rebooked' : 'Session Rebooked'/);
  assert.doesNotMatch(NOTIFIER, /Failed to rebook\. Try again later\./);
  // The print prompt no longer spins forever when a pop-up is blocked.
  const print = read('../../src/components/AutoPrintPrompt.jsx');
  assert.match(print, /alert\('Please allow pop-ups to print transcripts\.'\);\s*setPrinting\(false\);\s*return;/);
});
