import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * 8 September 2026: a phone died mid-lecture and the app replaced the lecture
 * with an invented one.
 *
 * The chain, from the live rows:
 *
 *   The recording never reached the server — segments upload at the 90-minute
 *   rotation or on Save, and an 80-minute class reaches neither, so the audio
 *   existed only in IndexedDB on that phone. With no lecture row and no
 *   attendance row, AttendancePrompt considered the session unconfirmed and
 *   asked whether the student had attended. It asked from a full-screen scrim
 *   at z-50, over the recovery pill at z-40 that was already offering the real
 *   audio back, and with no third answer available for a single pending
 *   session. "Yes" invoked generateMissedLectureSummary, which wrote a lecture
 *   flagged is_missed onto a class the student had just confirmed attending,
 *   and charged 2 credits.
 *
 * Four things had to be true for that to happen. Each one is a test.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PROMPT = read('../../src/components/AttendancePrompt.jsx');
const CONTEXT = read('../../src/recording/RecordingContext.jsx');
const CLASS_DETAIL = read('../../src/pages/ClassDetail.jsx');
const MISSED = read('../routes/generateMissedLectureSummary.js');

test('answering an attendance question generates nothing and spends nothing', () => {
  // The question is about attendance. A paid generative feature hanging off
  // one of its two answers is not something the screen ever said.
  // Anchored on the call, not the name: the comment explaining why the call
  // is gone mentions it, and matching that would fail on the fix itself.
  assert.doesNotMatch(PROMPT, /invoke\(\s*'generateMissedLectureSummary'/,
    'the attendance prompt can still fabricate a lecture');
  assert.doesNotMatch(PROMPT, /functions\.invoke\(/,
    'the attendance prompt calls a backend function again');
  // It still records the answer — removing the fabrication must not remove
  // the feature.
  assert.match(PROMPT, /ClassAttendance\.create\(\{/);
  assert.match(PROMPT, /attended,/);
});

test('the attendance question always has a way out', () => {
  // Gated on `remaining > 1`, a single pending session had exactly two doors,
  // and one of them used to cost credits.
  assert.doesNotMatch(PROMPT, /\{remaining > 1 && \(/, 'the dismiss control is conditional again');
  assert.match(PROMPT, /onClick=\{handleDismissAll\}/);
  assert.match(PROMPT, /Ask me later/);
});

test('the attendance question waits behind a recording session', () => {
  // A z-50 scrim over the z-40 pill is what buried the recovery offer. The
  // fix is ordering, not z-index: audio first, housekeeping after.
  assert.match(PROMPT, /useRecording\(\)/);
  assert.match(PROMPT, /if \(dismissed \|\| sessionActive \|\| !current\) return null;/);
  // `active` is the provider's own definition of "there is a session on
  // screen", and it includes a crash-recovered one waiting to be saved.
  assert.match(CONTEXT, /const active = !!cls && \(recording \|\| readyToSave/);
  assert.match(CONTEXT, /\|\| !!recoveredBlob\)/);
});

test('a new session cannot overwrite audio that never finished saving', () => {
  // recordingStore holds one record per [userId, classId] and every 15-second
  // flush is a put over it, so starting a second session for the same class
  // destroys the first one about fifteen seconds in.
  const STORE = read('../../src/lib/recordingStore.js');
  assert.match(STORE, /keyPath: \['userId', 'classId'\]/);
  assert.match(CONTEXT, /const stored = await getRecording\(classInfo\.id\)\.catch\(\(\) => null\);/);
  assert.match(CONTEXT, /return 'recovery-pending';/);

  // The mic is taken BEFORE the store is read. Safari grants it against the
  // user activation from the tap, and an awaited IndexedDB read in front of
  // the call can spend that activation — on the phones where every recording
  // in this app is actually made.
  const micAt = CONTEXT.indexOf('await navigator.mediaDevices.getUserMedia');
  const storeAt = CONTEXT.indexOf('await getRecording(classInfo.id)');
  assert.ok(micAt > -1 && storeAt > micAt, 'the store is read before the microphone is requested');
  // And the stream is released rather than left running on the refusal path.
  assert.match(CONTEXT, /stream\.getTracks\(\)\.forEach\(\(t\) => \{ try \{ t\.stop\(\); \}/);

  // The caller shows what was found instead of reporting a microphone fault.
  assert.match(CLASS_DETAIL, /if \(outcome === 'recovery-pending'\) \{/);
  assert.match(CLASS_DETAIL, /const found = await findRecoverableRecording\(classId\);/);
  assert.match(CLASS_DETAIL, /if \(found\) setRecovery\(found\); else setMicError\(true\);/);
  assert.match(CLASS_DETAIL, /outcome === 'started'/);
});

test('one lecture per class per day', () => {
  // Recovering the real recording after an estimate had been written would
  // otherwise leave two lectures for the same date, one of them fictional and
  // indexed by every study tool that reads the class.
  assert.match(MISSED, /select id, is_ai_estimated from lectures where class_id = \$1 and user_id = \$2 and date = \$3 limit 1/);
  assert.match(MISSED, /res\.status\(409\)/);
  // Checked before the gate, so a refusal costs nothing.
  const checkAt = MISSED.indexOf('and date = $3 limit 1');
  const gateAt = MISSED.indexOf("gateFeature(userId, 'missed_summary'");
  assert.ok(checkAt > -1 && gateAt > checkAt, 'the student is charged before the duplicate is caught');
  // And the refusal reaches the student in words rather than as "try again".
  assert.match(CLASS_DETAIL, /setError\(e\?\.response\?\.data\?\.message/);
});

test('the deliberate way in still exists, and still says what it does', () => {
  // Removing the automatic path must not remove the feature: a student who
  // genuinely missed a class asks for the estimate by name.
  assert.match(CLASS_DETAIL, /<MissedLectureConfirmModal/);
  assert.match(CLASS_DETAIL, /doesn't reflect what was actually taught/);
  assert.match(CLASS_DETAIL, /guidance_notes: notes\.trim\(\) \|\| undefined/);
  // Filed against the day the student is looking at. toISOString rolls over at
  // 18:00 in Saskatoon, so a Tuesday-evening estimate landed on Wednesday and
  // slipped past the one-per-day check for the day it was meant to cover.
  assert.match(CLASS_DETAIL, /date: new Date\(\)\.toLocaleDateString\('en-CA'\)/);
});

test('dates the student can see are local dates', () => {
  // toISOString rolls over at 18:00 in Saskatoon. The estimate was being filed
  // against tomorrow from six in the evening, and the same call on the
  // assignments tab put a "Past due" badge on work due today, every evening.
  assert.match(CLASS_DETAIL, /const todayStr = new Date\(\)\.toLocaleDateString\('en-CA'\);/);
  assert.match(CLASS_DETAIL, /const isPastDue = \(a\) => statusOf\(a\) === 'active' && a\.due_date && a\.due_date < todayStr;/);
});
