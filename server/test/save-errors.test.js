import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classifySaveError, describeSaveError, SAVE_ERROR } from '../../shared/saveErrors.js';

/**
 * A failed save must tell the student what actually happened and offer the
 * right exit.
 *
 * On 1 Sep a 90-minute lecture hit Groq's hourly transcription quota. The
 * island said "Couldn't save the recording … Try again", the student tried
 * again eleven seconds later, and that second attempt spent more of the quota
 * they were already out of. The audio had been uploaded fine both times. Three
 * things were wrong and each has a guard here:
 *
 *  1. the failure was not classified, so a per-hour quota read like a bug;
 *  2. "Try again" was the only exit, so there was no way to free the session
 *     and record the next class while the first one waited;
 *  3. Discard deleted the uploaded audio with no confirmation.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');

const island = stripComments(read('../../src/recording/RecordingIsland.jsx'));
const context = stripComments(read('../../src/recording/RecordingContext.jsx'));

// --- classification ------------------------------------------------------

const httpError = (status, message) => ({ response: { status, data: { error: message } }, message: `Request failed with status code ${status}` });

test("Groq's hourly quota (a 413 with 'per hour') is a rate limit, not a size problem", () => {
  const c = classifySaveError(httpError(413, 'Rate limit reached for model whisper-large-v3-turbo: Limit 7200 audio seconds per hour, used 6900, requested 2640. Please try again in 40m.'));
  assert.equal(c.kind, SAVE_ERROR.RATE_LIMITED);
  assert.equal(c.retryNow, false);
});

test('a plain 429 is a rate limit', () => {
  assert.equal(classifySaveError(httpError(429, 'Too Many Requests')).kind, SAVE_ERROR.RATE_LIMITED);
});

test("the server's own 24 MB / 6 h caps will never succeed on retry", () => {
  const c = classifySaveError(httpError(413, 'This recording is larger than 24 MB and exceeded the safe upload size.'));
  assert.equal(c.kind, SAVE_ERROR.TOO_LARGE);
  assert.equal(c.retryNow, false);
});

test('402 is out of credits', () => {
  assert.equal(classifySaveError(httpError(402, 'Not enough credits')).kind, SAVE_ERROR.OUT_OF_CREDITS);
});

test('a fetch that never reached the server is retryable', () => {
  const c = classifySaveError(new TypeError('Failed to fetch'));
  assert.equal(c.kind, SAVE_ERROR.NETWORK);
  assert.equal(c.retryNow, true);
});

test('anything else stays retryable and keeps the server message', () => {
  const c = classifySaveError(httpError(500, 'flashcard generation failed'));
  assert.equal(c.kind, SAVE_ERROR.UNKNOWN);
  assert.equal(c.retryNow, true);
  assert.match(c.message, /flashcard/);
});

test('every kind has a headline and a sentence, and rate-limit copy says the audio is safe', () => {
  for (const kind of Object.values(SAVE_ERROR)) {
    const copy = describeSaveError({ kind, message: 'x' });
    assert.ok(copy.title && copy.body, kind);
  }
  assert.match(describeSaveError({ kind: SAVE_ERROR.RATE_LIMITED }).body, /uploaded and safe/);
  assert.doesNotMatch(describeSaveError({ kind: SAVE_ERROR.RATE_LIMITED }).title, /couldn't/i);
});

// --- the web client wires it ---------------------------------------------

test('the web client re-exports the shared module rather than keeping its own copy', () => {
  assert.match(read('../../src/lib/saveErrors.js'), /export \* from '\.\.\/\.\.\/shared\/saveErrors\.js'/);
});

test('the recording context classifies save failures and exposes "process later"', () => {
  assert.match(context, /classifySaveError\(/);
  assert.match(context, /const processLater = useCallback/);
  assert.match(context, /canProcessLater: !!pendingLectureId && !recoveredBlob/);
  assert.match(context, /processLater,/);
});

test('"process later" deletes nothing on the server', () => {
  const body = context.slice(context.indexOf('const processLater = useCallback'), context.indexOf('const discard = useCallback'));
  assert.doesNotMatch(body, /deleteOrphanedParts|files\.delete|Lecture\.delete/);
  // ...and refuses to run while the only copy is still local.
  assert.match(body, /if \(!lectureId \|\| recoveredBlobRef\.current\) return/);
});

test('the island shows the classified headline and offers "Process later"', () => {
  assert.match(island, /failure\.title/);
  assert.match(island, /failure\.body/);
  assert.match(island, /rec\.canProcessLater/);
  assert.match(island, /onClick=\{rec\.processLater\}/);
  assert.doesNotMatch(island, /Couldn't save the recording/);
});

test('discard asks first, and says how long the recording is', () => {
  assert.doesNotMatch(island, /onClick=\{rec\.discard\}/, 'discard must go through the confirmation step');
  assert.match(island, /confirmDiscard \?/);
  assert.match(island, /Delete this \{formatClock\(rec\.seconds\)\} recording\?/);
  assert.match(island, /Keep it/);
});

// --- honest duration -------------------------------------------------------

test('the clock stops while the microphone is silent, and the saved duration is bounded by captured bytes', () => {
  assert.match(context, /if \(micSilentRef\.current\) return;/);
  assert.match(context, /const durationSeconds = estimateDurationSeconds\(\)/);
  assert.match(context, /Math\.min\(clock, fromBytes\)/);
  assert.match(island, /rec\.micSilent/);
});

test('lectures left for later are marked in lists and retry errors are classified on the detail page', () => {
  const item = stripComments(read('../../src/components/LectureItem.jsx'));
  assert.match(item, /lecture\.status === 'pending' && lecture\.recording_url && !lecture\.ai_title/);
  const detail = stripComments(read('../../src/pages/LectureDetail.jsx'));
  assert.match(detail, /describeSaveError\(classifySaveError\(e\)\)/);
});

test('the server records why it gave a lecture back, and the client shows that sentence', async () => {
  const { describeProcessingFailure } = await import('../routes/processLectureRecording.js');
  const groq = describeProcessingFailure(new Error('Groq 413: {"error":{"message":"Request too large for model `whisper-large-v3-turbo` ... on seconds of audio per hour (ASPH): Limit 7200"}}'));
  assert.equal(classifySaveError({ message: groq }).kind, SAVE_ERROR.RATE_LIMITED);
  const gemini = describeProcessingFailure(new Error('Gemini 503: {"error":{"code":503,"status":"UNAVAILABLE"}}'));
  assert.doesNotMatch(gemini, /Gemini 503/);
  assert.equal(classifySaveError({ message: gemini }).retryNow, true);
  assert.equal(classifySaveError({ message: describeProcessingFailure(new Error('insufficient credits for the measured duration (2640s needs 3)')) }).kind, SAVE_ERROR.OUT_OF_CREDITS);

  const server = stripComments(read('../../server/routes/processLectureRecording.js'));
  assert.match(server, /processing_error = \$3/);
  assert.match(server, /processing_error = null/);
  assert.match(context, /lecture\.processing_error \|\|/);
  assert.match(stripComments(read('../../src/pages/LectureDetail.jsx')), /lecture\.processing_error/);
  assert.ok(fs.existsSync(new URL('../../supabase/migrations/20260901200000_add_processing_error_to_lectures.sql', import.meta.url)));
});
