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

// --- a segment can never outgrow the cap ------------------------------------
//
// The 90-minute rotation assumed 32 kbps Opus. Safari records AAC, and when
// the encoder does not take the bitrate hint WebKit falls back to 192 kbps:
// the 24 MB cap in about seventeen minutes, every lecture on an iPhone refused
// by the client before upload, and nothing on the server to show for it (one
// student, three weeks, zero lecture rows). Segments now rotate on size too.

test('segments rotate on size as well as time, under the upload cap with room for one more slice', () => {
  const rotateBytes = Number(context.match(/const SEGMENT_ROTATE_BYTES = (\d+) \* 1024 \* 1024;/)?.[1]);
  const maxBytes = Number(context.match(/const MAX_SEGMENT_BYTES = (\d+) \* 1024 \* 1024;/)?.[1]);
  assert.ok(rotateBytes > 0 && maxBytes > 0, 'both caps must be named constants');
  // 15 s of audio at even 256 kbps is under half a MiB; 4 MiB of headroom is
  // plenty and still leaves a segment large enough that Chrome's 90-minute
  // segments (about 21 MB) rotate at most once more than before.
  assert.ok(maxBytes - rotateBytes >= 2, `rotation at ${rotateBytes} MiB leaves too little headroom under ${maxBytes} MiB`);
  // Judged on the bytes captured so far, inside the slice handler, and never
  // while a rotation is already in flight (the old recorder's last slice lands
  // in the same handler).
  const handler = context.slice(context.indexOf('recorder.ondataavailable = (e) =>'), context.indexOf('recorder.onstop = () =>'));
  assert.match(handler, /blob\.size >= SEGMENT_ROTATE_BYTES && recordingRef\.current && !rotatingRef\.current/);
  assert.match(handler, /rotateSegment\(\);/);
  // The time boundary stays.
  assert.match(context, /segmentSecondsRef\.current >= SEGMENT_ROTATE_SECONDS/);
});

test('every save, failed or not, leaves a short-scalar record of what the device recorded', () => {
  assert.match(context, /recorderMimeRef\.current = recorder\.mimeType \|\| '';/, 'the real format is read off the recorder');
  assert.match(context, /track\('recording_save_failed', \{ kind: classified\.kind, status: Number\(e\?\.response\?\.status \|\| e\?\.status \|\| 0\), \.\.\.saveFacts\(pendingBytes\) \}\)/);
  assert.match(context, /track\('recording_saved', \{ parts: parts\.length, \.\.\.saveFacts\(\) \}\)/);
  // The segment that failed to upload counts toward the bitrate: it is the
  // one that tells the story.
  assert.match(context, /failSave\(new Error\(`Could not finish uploading the last part[^`]*`\), \{ pendingBytes: lastBlob\?\.size \|\| 0 \}\)/);
  assert.match(context, /failSave\(new Error\(`A recording segment could not be uploaded[^`]*`\), \{ pendingBytes: failedBlob\?\.size \|\| 0 \}\)/);
  // Whitelisted server-side, so the events are kept rather than dropped.
  const trackEvent = read('../../server/routes/trackEvent.js');
  assert.match(trackEvent, /'recording_saved',/);
  assert.match(trackEvent, /'recording_save_failed',/);
  // No free text ever: the facts are a platform token, the recorder's own
  // MIME string, and numbers.
  const facts = context.slice(context.indexOf('const saveFacts = '), context.indexOf('const failSave = '));
  assert.match(facts, /platform: devicePlatform\(\)/);
  assert.match(facts, /kbps: measuredKbps\(/);
  assert.doesNotMatch(facts, /message|userAgent/);
});

test('the device token and the measured bitrate are what the record says they are', async () => {
  const { devicePlatform, measuredKbps } = await import('../../src/lib/recordingFacts.js');
  assert.match(context, /from '@\/lib\/recordingFacts'/);
  assert.equal(devicePlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1'), 'ios');
  assert.equal(devicePlatform('Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15'), 'ios');
  assert.equal(devicePlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15'), 'mac');
  assert.equal(devicePlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36'), 'android');
  assert.equal(devicePlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0'), 'windows');
  assert.equal(devicePlatform(''), 'other');
  // 50 minutes at 192 kbps AAC: 72 MB. At 32 kbps Opus: 12 MB.
  assert.equal(measuredKbps(72 * 1000 * 1000, 50 * 60), 192);
  assert.equal(measuredKbps(12 * 1000 * 1000, 50 * 60), 32);
  assert.equal(measuredKbps(0, 60), null);
  assert.equal(measuredKbps(1000, 0), null);
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
