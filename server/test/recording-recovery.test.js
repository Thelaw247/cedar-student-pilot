import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { listRecoverableRecordings, saveRecording, clearRecording } from '../../src/lib/recordingStore.js';
import { setCachedUserId } from '../../src/lib/currentUser.js';

/**
 * A lecture recording is the one thing in this app a student cannot recreate,
 * and on 3 Sep one looked lost after a page refresh.
 *
 * It was not lost. The audio is flushed to IndexedDB every ~15 seconds, so a
 * refresh costs at most a few seconds of sound. What was missing was any way
 * to FIND it: `active` is derived from in-memory state, so the island vanished
 * on reload, and the only lookup in the app ran inside ClassDetail's Record
 * modal for one specific class — reachable only by opening that class and
 * pressing Record. A student who refreshed anywhere else was never told the
 * audio was still on their device.
 *
 * These tests pin the discovery path, and the guards that keep it from ever
 * interrupting a live recording.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const STORE = read('../../src/lib/recordingStore.js');
const CONTEXT = read('../../src/recording/RecordingContext.jsx');
const ISLAND = read('../../src/recording/RecordingIsland.jsx');

test('the store can find recordings without already knowing the class', () => {
  assert.match(STORE, /export async function listRecoverableRecordings/,
    'without a classId-free lookup, recovery is reachable only from the right class page');
  const fn = STORE.slice(STORE.indexOf('export async function listRecoverableRecordings'));
  // Scoped to the signed-in user, like every other read here: a shared device
  // must never surface one account's audio to the next.
  assert.match(fn, /getCachedUserId\(\)/);
  assert.match(fn, /IDBKeyRange\.only\(userId\)/);
  assert.match(fn, /USER_INDEX/);
  // Same definition of "recoverable" as getRecording — local bytes, or parts
  // uploaded but never attached to a lecture.
  assert.match(fn, /rec\.blob && rec\.blob\.size > 0\) \|\| rec\.parts\.length > 0/);
  // Newest first: the session the student just lost is the one to offer.
  assert.match(fn, /sort\(\(a, b\) => Number\(b\.timestamp \|\| 0\) - Number\(a\.timestamp \|\| 0\)\)/);
});

test('the provider looks for an interrupted session on boot', () => {
  assert.match(CONTEXT, /listRecoverableRecordings/, 'nothing scans for orphaned audio at startup');
  const scan = CONTEXT.slice(CONTEXT.indexOf('const scan = async () =>'), CONTEXT.indexOf('const saveAndProcess'));
  assert.ok(scan.length > 200, 'the boot scan is gone');
  assert.match(scan, /recoverSession\(classInfo, found\)/, 'the scan finds audio but never seeds the session');
});

test('recovery can never interrupt or overwrite a live recording', () => {
  const scan = CONTEXT.slice(CONTEXT.indexOf('const sessionInProgress'), CONTEXT.indexOf('const saveAndProcess'));
  assert.match(scan, /recordingRef\.current \|\| !!clsRef\.current/,
    'the guard must read the refs, not state — state is a render behind');
  // Checked before the lookup, after the lookup, and after the class fetch:
  // both awaits are windows in which the student could press Record.
  const guards = scan.match(/sessionInProgress\(\)/g) || [];
  assert.ok(guards.length >= 3, `expected a guard around each await, found ${guards.length}`);
});

test('recovering offers to save and does not save by itself', () => {
  const scan = CONTEXT.slice(CONTEXT.indexOf('const scan = async () =>'), CONTEXT.indexOf('const saveAndProcess'));
  assert.doesNotMatch(scan, /saveAndProcess\(/,
    'processing on boot would spend the student\'s credits without them asking');
});

test('a missing class name does not block recovery', () => {
  const scan = CONTEXT.slice(CONTEXT.indexOf('const scan = async () =>'), CONTEXT.indexOf('const saveAndProcess'));
  assert.match(scan, /catch/, 'a failed Class.get must not abandon the audio');
  assert.match(scan, /name: 'an earlier recording'/, 'no fallback label for a class that cannot be read');
});

test('the island says a recovered session is different from a finished one', () => {
  assert.match(ISLAND, /rec\.recoveredOnBoot \? 'Unsaved recording found' : 'Recording complete'/);
  assert.match(ISLAND, /The audio is safe on this device/);
  assert.match(CONTEXT, /recoveredOnBoot,/, 'the flag is not exposed on the context');
  // Starting a fresh recording must clear it, or the next save claims to be a
  // recovery.
  const start = CONTEXT.slice(CONTEXT.indexOf('const start = useCallback'), CONTEXT.indexOf('const togglePause'));
  assert.match(start, /setRecoveredOnBoot\(false\)/);
});

// ---- Behaviour, against a real IndexedDB implementation --------------------
// The assertions above pin the shape of the code; these run it. fake-indexeddb
// is a full implementation of the spec, so a cursor bug or an ownership leak
// fails here rather than on a student's phone.

const audio = (bytes) => new Blob([bytes], { type: 'audio/webm' });

test('recovery finds every unsaved recording for the signed-in user, newest first', async () => {
  setCachedUserId('user-a');
  await saveRecording('class-1', audio('abc'), { seconds: 30, timestamp: 1, parts: [] });
  await saveRecording('class-2', audio(''), { seconds: 90, timestamp: 2, parts: ['r2://bucket/key'] });

  const rows = await listRecoverableRecordings();
  assert.deepEqual(rows.map((r) => r.classId), ['class-2', 'class-1']);
  // The uploaded-parts case is the dangerous one: every segment reached R2 but
  // no lecture row was ever created, so nothing on the server knows it exists.
  assert.deepEqual(rows[0].parts, ['r2://bucket/key']);
  assert.equal(rows[0].seconds, 90);
});

test('a finished save is not offered back to the student', async () => {
  setCachedUserId('user-a');
  // What finalizeRecording writes once everything is uploaded and attached:
  // an empty blob and no outstanding parts. There is nothing left to save.
  await saveRecording('class-3', audio(''), { seconds: 5, timestamp: 9, parts: [] });
  const rows = await listRecoverableRecordings();
  assert.ok(!rows.some((r) => r.classId === 'class-3'), 'offered to recover a recording that was already saved');
});

test('one account never sees another account\'s audio on a shared device', async () => {
  setCachedUserId('user-b');
  await saveRecording('class-9', audio('other'), { seconds: 45, timestamp: 99, parts: [] });

  setCachedUserId('user-a');
  const mine = await listRecoverableRecordings();
  assert.ok(!mine.some((r) => r.classId === 'class-9'), 'user-b\'s recording leaked into user-a\'s recovery list');

  setCachedUserId('user-b');
  const theirs = await listRecoverableRecordings();
  assert.deepEqual(theirs.map((r) => r.classId), ['class-9']);
});

test('nothing is offered when no one is signed in', async () => {
  setCachedUserId(null);
  assert.deepEqual(await listRecoverableRecordings(), []);
});

test('a saved recording stops being offered once it is cleared', async () => {
  setCachedUserId('user-a');
  await clearRecording('class-1');
  await clearRecording('class-2');
  assert.deepEqual(await listRecoverableRecordings(), []);
});
