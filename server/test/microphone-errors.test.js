import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MIC_ERROR, classifyMicrophoneError, describeMicrophoneError, microphoneSettingsHint } from '../../src/lib/microphoneErrors.js';

/**
 * 18 September 2026, from the Windows desktop app: "the recording button
 * isn't working, it goes for 10 seconds and then times out." That was the
 * whole report, because that was all the app had said. getUserMedia's
 * rejection was swallowed into 'mic-denied' and shown as "grant permission";
 * a recorder that stopped on its own was shown as "interrupted" with no
 * reason. Both ends now keep the browser's own words.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

test('the browser\'s error names sort into the three things a student can act on', () => {
  assert.equal(classifyMicrophoneError({ name: 'NotAllowedError', message: 'Permission denied' }).kind, MIC_ERROR.PERMISSION);
  assert.equal(classifyMicrophoneError({ name: 'SecurityError' }).kind, MIC_ERROR.PERMISSION);
  assert.equal(classifyMicrophoneError({ name: 'NotFoundError', message: 'Requested device not found' }).kind, MIC_ERROR.NO_DEVICE);
  assert.equal(classifyMicrophoneError({ name: 'OverconstrainedError' }).kind, MIC_ERROR.NO_DEVICE);
  // The Windows one: permission granted, device present, capture will not start.
  assert.equal(classifyMicrophoneError({ name: 'NotReadableError', message: 'Could not start audio source' }).kind, MIC_ERROR.DEVICE_BUSY);
  assert.equal(classifyMicrophoneError({ name: 'AbortError' }).kind, MIC_ERROR.DEVICE_BUSY);
  assert.equal(classifyMicrophoneError({ name: 'SomethingElse' }).kind, MIC_ERROR.UNKNOWN);
  assert.equal(classifyMicrophoneError(null).kind, MIC_ERROR.UNKNOWN);
});

test('the raw detail survives, because it is what the next report needs', () => {
  const c = classifyMicrophoneError({ name: 'NotReadableError', message: 'Could not start audio source' });
  assert.equal(c.detail, 'NotReadableError: Could not start audio source');
  assert.equal(classifyMicrophoneError({ name: 'NotAllowedError' }).detail, 'NotAllowedError');
  assert.equal(classifyMicrophoneError({}).detail, '');
});

test('a device that will not start is not told to grant permission', () => {
  const busy = describeMicrophoneError(classifyMicrophoneError({ name: 'NotReadableError' }));
  assert.doesNotMatch(busy.body, /grant permission/i);
  assert.match(busy.title, /could not be started/);
  const denied = describeMicrophoneError(classifyMicrophoneError({ name: 'NotAllowedError' }));
  assert.match(denied.title, /permission was refused/);
  const none = describeMicrophoneError(classifyMicrophoneError({ name: 'NotFoundError' }));
  assert.match(none.title, /No microphone was found/);
});

test('the desktop app names the OS switch; a browser tab does not guess', () => {
  assert.match(microphoneSettingsHint('win32'), /Let desktop apps access your microphone/);
  assert.match(microphoneSettingsHint('darwin'), /Privacy & Security/);
  assert.equal(microphoneSettingsHint('linux'), '');
  assert.equal(microphoneSettingsHint(null), '');
  const onWindows = describeMicrophoneError(classifyMicrophoneError({ name: 'NotReadableError' }), { platform: 'win32' });
  assert.match(onWindows.body, /Privacy & security → Microphone/);
  const inBrowser = describeMicrophoneError(classifyMicrophoneError({ name: 'NotReadableError' }));
  assert.doesNotMatch(inBrowser.body, /Windows/);
});

test('the recording engine keeps the reason at both ends', () => {
  const CONTEXT = read('../../src/recording/RecordingContext.jsx');
  // The request: the DOMException is kept and exposed, not swallowed.
  const start = CONTEXT.slice(CONTEXT.indexOf('const start = useCallback'), CONTEXT.indexOf('const togglePause'));
  assert.match(start, /setStartError\(null\)/);
  assert.match(start, /const failure = \{ name: e\?\.name \|\| 'Error', message: e\?\.message \|\| '' \};/);
  assert.match(start, /console\.error\('\[recording\] microphone request failed:'/);
  assert.match(start, /setStartError\(failure\)/);
  assert.match(CONTEXT, /^\s+startError,$/m, 'startError is not exposed on the context');
  // The stop: the recorder's error event and an ended track both name themselves.
  assert.match(CONTEXT, /recorder\.onerror = \(event\) =>/);
  assert.match(CONTEXT, /const error = event\?\.error;/);
  assert.match(CONTEXT, /stopReasonRef\.current = 'the microphone stopped delivering audio'/);
  assert.match(CONTEXT, /const handleUnexpectedStop = \(reason = ''\) =>/);
  assert.match(CONTEXT, /console\.error\('\[recording\] stopped without being asked:'/);
  // Still one finalize per failure: onerror and onstop both arrive.
  const stop = CONTEXT.slice(CONTEXT.indexOf('const handleUnexpectedStop'), CONTEXT.indexOf('const stopCurrentSegment'));
  assert.match(stop, /if \(rotatingRef\.current\) return;/);
});

test('the record screen shows the classified failure and, in the desktop app, the OS switch', () => {
  const MODAL = read('../../src/pages/ClassDetail.jsx');
  assert.match(MODAL, /classifyMicrophoneError\(rec\.startError \|\| \{\}\)/);
  assert.match(MODAL, /describeMicrophoneError\(micFailure, \{ platform: desktop\?\.platform \|\| null \}\)/);
  assert.match(MODAL, /\{micFailure\.detail\}/, 'the raw error name is not shown');
  assert.doesNotMatch(MODAL, /Please grant permission and try again\./, 'the one-size-fits-all sentence is back');
  // The OS answer is read only when the shell can give one, and the button
  // only offered when the shell can act on it.
  assert.match(MODAL, /typeof desktop\?\.microphoneAccess !== 'function'/);
  assert.match(MODAL, /const canOpenMicSettings = typeof desktop\?\.openMicrophoneSettings === 'function';/);
  assert.match(MODAL, /osMicAccess === 'denied' \|\| osMicAccess === 'restricted'/);
});

test('the desktop shell answers the two microphone questions for its own origin only', () => {
  const preload = read('../../desktop/preload.cjs');
  const main = read('../../desktop/main.cjs');
  assert.match(preload, /microphoneAccess: \(\) => ipcRenderer\.invoke\('praelecta:microphone-access'\)/);
  assert.match(preload, /openMicrophoneSettings: \(\) => ipcRenderer\.invoke\('praelecta:open-microphone-settings'\)/);
  assert.match(main, /ipcMain\.handle\('praelecta:microphone-access'/);
  assert.match(main, /ipcMain\.handle\('praelecta:open-microphone-settings'/);
  assert.match(main, /if \(!fromAppOrigin\(event\)\) return 'unknown';/);
  assert.match(main, /if \(!fromAppOrigin\(event\)\) return false;/);
  assert.match(main, /systemPreferences\.getMediaAccessStatus\('microphone'\)/);
  assert.match(main, /win32: 'ms-settings:privacy-microphone'/);
  assert.match(main, /installMicrophoneBridge\(\);/);
  // The page must be able to tell a shell that has the bridge from one that
  // does not, so the marker stays and the functions are additions to it.
  assert.match(preload, /isDesktop: true,/);
  assert.match(preload, /platform: process\.platform,/);
});
