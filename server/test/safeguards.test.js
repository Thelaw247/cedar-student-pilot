import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import { contentMatchesType, detectedType, notAudioReason, SNIFF_BYTES } from '../lib/fileSignature.js';
import { answeredAsDuplicate } from '../lib/sameRequest.js';
import { SERVER_ERROR_MESSAGE, sendServerError } from '../lib/http.js';
import { classifySaveError, SAVE_ERROR } from '../../shared/saveErrors.js';
import { keyboardState, isTypingTarget } from '../../src/hooks/useOnScreenKeyboard.js';

/**
 * The October 2026 safeguards: the things an app does when nobody tested the
 * way a student actually uses it. A tap that runs twice, an error that shows
 * its own insides, a keyboard over the field, a back button that loses the
 * form, an upload that is not what it says. Each is held here, functionally
 * where the code is pure and from source where it is a component.
 */

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');

// ------------------------------------------------------------------ uploads

const bytes = (...parts) => Buffer.concat(parts.map((p) => (typeof p === 'string' ? Buffer.from(p, 'latin1') : Buffer.from(p))));
const PNG = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], [0, 0, 0, 13]);
const JPEG = bytes([0xff, 0xd8, 0xff, 0xe0], 'JFIF');
const WEBP = bytes('RIFF', [0x24, 0, 0, 0], 'WEBPVP8 ');
const PDF = bytes('%PDF-1.7\n');

test('an upload is what its bytes say, not what its name says', () => {
  assert.ok(contentMatchesType(PNG, 'image/png'));
  assert.ok(contentMatchesType(JPEG, 'image/jpeg'));
  assert.ok(contentMatchesType(WEBP, 'image/webp'));
  assert.ok(contentMatchesType(PDF, 'application/pdf'));
  // Some generators put bytes before the header; readers allow 1024 of them.
  assert.ok(contentMatchesType(bytes('\n\n  ', '%PDF-1.4'), 'application/pdf'));
  assert.ok(!contentMatchesType(bytes(Buffer.alloc(SNIFF_BYTES, 0x20), '%PDF-1.4'), 'application/pdf'));
  assert.ok(contentMatchesType(bytes('# Week 3\n\nσ = F / A'), 'text/markdown'));
  assert.ok(contentMatchesType(bytes('Caf\xe9 handout, Windows-1252'), 'text/plain'), 'a non-UTF-8 handout is still text');

  // Renamed files: a page as a photo, a program as a PDF, a binary as text.
  assert.ok(!contentMatchesType(bytes('<html><script>alert(1)</script>'), 'image/png'));
  assert.ok(!contentMatchesType(bytes('MZ', [0x90, 0, 3, 0]), 'application/pdf'));
  assert.ok(!contentMatchesType(PNG, 'image/jpeg'));
  assert.ok(!contentMatchesType(bytes('PK', [3, 4, 20, 0, 0, 0]), 'text/plain'), 'binary is not text');
  // A type with no check is never accepted by accident.
  assert.ok(!contentMatchesType(PNG, 'image/svg+xml'));
  assert.ok(!contentMatchesType(PNG, undefined));
  // Where several types are allowed, the bytes say which one it is.
  assert.equal(detectedType(PNG), 'image/png');
  assert.equal(detectedType(JPEG), 'image/jpeg');
  assert.equal(detectedType(WEBP), 'image/webp');
  assert.equal(detectedType(PDF), 'application/pdf');
  assert.equal(detectedType(bytes('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);
});

test('a recording is refused only when it is plainly not audio', () => {
  // Real recordings: WebM (Chrome, Firefox, Android), MP4/M4A (Safari, which
  // the app still labels audio/webm), Ogg, WAV, MP3 with and without ID3.
  for (const audio of [
    bytes([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]),
    bytes([0, 0, 0, 0x1c], 'ftypM4A ', [0, 0, 0, 0]),
    bytes([0, 0, 0, 0x18], 'ftypmp42'),
    bytes('OggS', [0, 2, 0, 0]),
    bytes('RIFF', [0x24, 0x08, 0, 0], 'WAVEfmt '),
    bytes('ID3', [4, 0, 0, 0]),
    bytes([0xff, 0xfb, 0x90, 0x64]),
  ]) {
    assert.equal(notAudioReason(audio), null, `refused real audio starting ${audio.subarray(0, 8).toString('hex')}`);
  }
  assert.match(notAudioReason(bytes('<?php system($_GET["c"]); ?>')), /web page or script/);
  assert.match(notAudioReason(bytes('\xef\xbb\xbf  <!doctype html>')), /web page or script/);
  assert.match(notAudioReason(bytes('#!/bin/sh\n')), /script/);
  assert.match(notAudioReason(PDF), /PDF/);
  assert.match(notAudioReason(bytes('PK', [3, 4])), /archive/);
  assert.match(notAudioReason(bytes('MZ', [0x90, 0])), /program/);
  assert.match(notAudioReason(bytes('\x7fELF')), /program/);
});

test('every upload path checks content before keeping the file', () => {
  const r2 = read('../lib/r2.js');
  const avatar = r2.slice(r2.indexOf('export async function confirmAvatarUpload'), r2.indexOf('export async function createDownloadUrl'));
  assert.match(avatar, /if \(!AVATAR_TYPES\.has\(detectedType\(await firstBytes\(client, bucket, key\)\)\)\)/);
  assert.match(avatar, /DeleteObjectCommand/);
  const recording = r2.slice(r2.indexOf('export async function confirmRecordingUpload'), r2.indexOf('export async function confirmAvatarUpload'));
  assert.match(recording, /notAudioReason\(await firstBytes\(client, bucket, key\)\)/);
  assert.match(r2, /Range: `bytes=0-\$\{SNIFF_BYTES - 1\}`/, 'a photo or recording is checked from its first bytes, not downloaded');
  const materials = read('../lib/lectureMaterials.js');
  const confirm = materials.slice(materials.indexOf('export async function confirmMaterialUpload'));
  assert.ok(confirm.indexOf('contentMatchesType(buffer, contentType)') < confirm.indexOf('extractMaterialText('), 'the check comes before the file is read');
  assert.match(read('../lib/timetableFile.js'), /const actualType = detectedType\(buffer\);\n  if \(!ALLOWED_TIMETABLE_TYPES\.has\(actualType\)\)/);
});

// ------------------------------------------------------------- double taps

function fakeResponse(body) {
  const res = new EventEmitter();
  res.req = { body };
  res.statusCode = 200;
  res.headersSent = false;
  res.sent = null;
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.sent = { status: res.statusCode, body: payload }; res.headersSent = true; return res; };
  return res;
}

test('a paid request sent twice runs once, and the second gets the first one\'s answer', async () => {
  const first = fakeResponse({ class_id: 'c1' });
  assert.equal(await answeredAsDuplicate('u1', 'handbook', first), false, 'the first one runs');

  const second = fakeResponse({ class_id: 'c1' });
  const waiting = answeredAsDuplicate('u1', 'handbook', second);
  // Not the same request: another class, another feature, another student.
  for (const [user, feature, body] of [['u1', 'handbook', { class_id: 'c2' }], ['u1', 'exam_prediction', { class_id: 'c1' }], ['u2', 'handbook', { class_id: 'c1' }]]) {
    const other = fakeResponse(body);
    assert.equal(await answeredAsDuplicate(user, feature, other), false, `${user}/${feature} was held as a duplicate`);
    other.emit('close');
  }

  first.status(200).json({ handbook: 'one', cached: false });
  assert.equal(await waiting, true, 'the duplicate is answered, not run');
  assert.deepEqual(second.sent, { status: 200, body: { handbook: 'one', cached: false } });
  first.emit('close');

  // Asked again after the answer: a new request, not a double tap.
  const later = fakeResponse({ class_id: 'c1' });
  assert.equal(await answeredAsDuplicate('u1', 'handbook', later), false);
  later.emit('close');
});

test('a request whose student already left is not held for anyone', async () => {
  // Closed before the gate: 'close' has already fired, so an entry made now
  // would never be cleared and would answer every later tap with this run.
  const gone = Object.assign(fakeResponse({ lecture_id: 'gone' }), { destroyed: true });
  assert.equal(await answeredAsDuplicate('u1', 'lecture_review', gone), false);
  const next = fakeResponse({ lecture_id: 'gone' });
  assert.equal(await answeredAsDuplicate('u1', 'lecture_review', next), false, 'the abandoned run was registered');
  next.emit('close');
});

test('a duplicate whose first request was dropped runs in its place', async () => {
  const first = fakeResponse({ lecture_id: 'l1' });
  await answeredAsDuplicate('u1', 'lecture_review', first);
  const second = fakeResponse({ lecture_id: 'l1' });
  const waiting = answeredAsDuplicate('u1', 'lecture_review', second);
  first.emit('close'); // the tab was closed before an answer
  assert.equal(await waiting, false);
  // ...and is now the one in flight for anything after it.
  const third = fakeResponse({ lecture_id: 'l1' });
  const queued = answeredAsDuplicate('u1', 'lecture_review', third);
  second.status(402).json({ error: 'insufficient_credits' });
  assert.equal(await queued, true);
  assert.equal(third.sent.status, 402, 'a refusal is shared too: the duplicate is not charged either');
  second.emit('close');
});

test('every paid feature goes through the duplicate check before anything else', () => {
  const credits = read('../lib/credits.js');
  const gate = credits.slice(credits.indexOf('export async function gateFeature'));
  assert.match(gate, /if \(await answeredAsDuplicate\(userId, feature, res\)\) return \{ ok: false \};/);
  assert.ok(gate.indexOf('answeredAsDuplicate(') < gate.indexOf('requireTier('), 'before the balance is even read');
});

test('a project whose sessions fail is not created twice on the retry', () => {
  const modal = read('../../src/components/ProjectAssignmentModal.jsx');
  assert.match(modal, /const assignment = createdAssignment \|\| await base44\.entities\.Assignment\.create\(/);
  assert.match(modal, /setCreatedAssignment\(assignment\);/);
});

// ------------------------------------------------------------ error text

test('a failure on the server reaches the student as a sentence, not as its own text', () => {
  const dir = new URL('../routes/', import.meta.url);
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const src = fs.readFileSync(new URL(file, dir), 'utf8');
    assert.doesNotMatch(src, /status\(5\d\d\)\.json\(\{ ?error: (error|err|e)\??\.message/, `${file} sends a raw error with a 5xx`);
    assert.doesNotMatch(src, /status\(status >= 400 && status < 600[^)]*\)\.json\(\{ error: error\.message/, `${file} passes a 5xx message through`);
  }
  const res = fakeResponse(null);
  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args);
  try {
    sendServerError(res, new Error('duplicate key value violates unique constraint "lectures_pkey"'), 'test');
  } finally {
    console.error = original;
  }
  assert.deepEqual(res.sent, { status: 500, body: { error: SERVER_ERROR_MESSAGE } });
  assert.equal(logged[0][0], '[test]', 'the real error is logged, with where it happened');
  assert.match(String(logged[0][1].message), /duplicate key/);
  // 4xx sentences written for students still go out as they are.
  const recording = read('../routes/processLectureRecording.js');
  assert.match(recording, /if \(status >= 400 && status < 500\) \{/);
  assert.match(recording, /return sendServerError\(res, error, 'recording'\);/);
});

test('a dropped connection says so in words, and the code that reacts to it still does', () => {
  const client = read('../../src/lib/cedarClient.js');
  assert.match(client, /export const UNREACHABLE_MESSAGE = "Couldn't reach Praelecta\. Check your network connection and try again\.";/);
  assert.match(client, /const response = await reach\(`\$\{RENDER_API_URL\}\$\{path\}`/);
  assert.equal((client.match(/const uploaded = await reach\(prepared\.data\.upload_url/g) || []).length, 3, 'all three uploads');
  assert.doesNotMatch(client.slice(client.indexOf('async function apiRequest')), /await fetch\(/);
  // The offline queue looks for the word "network"; the save flow for the code
  // or the sentence, which the recording island wraps in one of its own.
  const unreachable = Object.assign(new Error("Couldn't reach Praelecta. Check your network connection and try again."), { code: 'NETWORK', status: 0 });
  assert.equal(classifySaveError(unreachable).kind, SAVE_ERROR.NETWORK);
  assert.equal(classifySaveError(new Error(`A recording segment could not be uploaded (${unreachable.message}). It is safe on this device.`)).kind, SAVE_ERROR.NETWORK);
  assert.ok(unreachable.message.includes('network'));
});

test('no native alert is left in the app: failures are toasts', () => {
  const root = new URL('../../src/', import.meta.url);
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(new URL(`${d.name}/`, dir)) : [new URL(d.name, dir)]));
  for (const file of walk(root).filter((f) => /\.jsx?$/.test(f.pathname))) {
    const code = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    assert.doesNotMatch(code, /(^|[^.\w])alert\(/, `${file.pathname.split('/src/')[1]} still calls alert()`);
  }
  assert.match(read('../../src/components/SessionReview.jsx'), /toast\(\{ variant: 'destructive', title: "Couldn't score this review"/);
  for (const [file, kind] of [['AttendancePrompt.jsx', 'This answer could not be saved. Tap again'], ['ReviewForm.jsx', 'This could not be saved. Try again']]) {
    const src = read(`../../src/components/${file}`);
    assert.ok(src.includes(kind), `${file}: unknown failures say a sentence`);
    assert.doesNotMatch(src, /could not be saved\$\{e\?\.message/, `${file} shows the database's text again`);
  }
});

test('the toast area lets taps through, and its ✕ is visible on a phone', () => {
  const toast = read('../../src/components/ui/toast.jsx');
  assert.equal((toast.match(/className="pointer-events-none fixed top-0 z-\[100\]/g) || []).length, 2, 'provider and viewport');
  assert.match(toast, /"reveal-on-hover absolute right-2 top-2/);
  assert.match(toast, /pointer-events-auto relative flex/, 'each toast still takes its own taps');
});

// ------------------------------------------------------------- the keyboard

test('the keyboard is told apart from a toolbar, a zoom and a tap on a button', () => {
  const viewport = (height, offsetTop = 0, scale = 1) => ({ height, offsetTop, scale });
  // iPhone: the window stays 664 tall, the visible part drops to 370.
  assert.deepEqual(keyboardState({ fullHeight: 664, innerHeight: 664, viewport: viewport(370), typing: true }), { open: true, top: 0, height: 370, inset: 294 });
  // Safari scrolled the visible part down to reach the field.
  assert.deepEqual(keyboardState({ fullHeight: 664, innerHeight: 664, viewport: viewport(370, 120), typing: true }), { open: true, top: 120, height: 370, inset: 174 });
  // A phone that shrinks the window instead: nothing to lift, but it is open.
  assert.deepEqual(keyboardState({ fullHeight: 780, innerHeight: 420, viewport: viewport(420), typing: true }), { open: true, top: 0, height: 420, inset: 0 });
  // The toolbar sliding away, a pinch zoom, focus on a button: not the keyboard.
  assert.equal(keyboardState({ fullHeight: 745, innerHeight: 664, viewport: viewport(664), typing: true }).open, false);
  assert.equal(keyboardState({ fullHeight: 664, innerHeight: 664, viewport: viewport(300, 0, 2), typing: true }).open, false);
  assert.equal(keyboardState({ fullHeight: 664, innerHeight: 664, viewport: viewport(370), typing: false }).open, false);
  const field = (tagName, type = '', extra = {}) => ({ tagName, getAttribute: () => type, ...extra });
  assert.ok(isTypingTarget(field('INPUT', 'text')) && isTypingTarget(field('INPUT')) && isTypingTarget(field('TEXTAREA')) && isTypingTarget(field('SELECT')));
  assert.ok(!isTypingTarget(field('INPUT', 'checkbox')) && !isTypingTarget(field('BUTTON')) && !isTypingTarget(field('INPUT', 'text', { readOnly: true })));
});

test('form sheets, the recording island and the bottom nav make room for the keyboard', () => {
  assert.match(read('../../src/components/Layout.jsx'), /useOnScreenKeyboard\(\);/);
  const css = read('../../src/index.css');
  assert.match(css, /html\.keyboard-open \.sheet-overlay \{\s*top: var\(--visible-top, 0px\);\s*bottom: auto;\s*height: var\(--visible-height, 100%\);/);
  assert.match(css, /html\.keyboard-open \.sheet-overlay > \[role="dialog"\] \{/);
  assert.match(css, /html\.keyboard-open \[data-recording-island\] \{\s*bottom: calc\(var\(--keyboard-inset, 0px\) \+ 0\.75rem\);/);
  assert.match(css, /html\.keyboard-open \[data-bottom-nav\] \{\s*visibility: hidden;/);
  for (const file of ['EditClassModal', 'AssignmentEditModal', 'AddEventModal', 'ReviewForm', 'AddExamOrStudyModal', 'ProjectAssignmentModal', 'RebookSessionModal', 'DeadlineForm', 'ProjectSessionEndModal']) {
    const src = read(`../../src/components/${file}.jsx`);
    const overlays = (src.match(/className="(sheet-overlay )?fixed inset-0 z-\[?\d+\]? flex/g) || []);
    assert.ok(overlays.length > 0 && overlays.every((o) => o.includes('sheet-overlay')), `${file}: a form sheet that ignores the keyboard`);
  }
  assert.equal((read('../../src/recording/RecordingIsland.jsx').match(/data-recording-island>/g) || []).length, 4, 'every state of the island');
});

// ------------------------------------------------------------ back button

test('a form left by the back button is there when the student comes back', () => {
  const hook = read('../../src/hooks/useDraft.js');
  assert.match(hook, /sessionStorage\.setItem\(PREFIX \+ key, JSON\.stringify\(value\)\)/);
  assert.match(hook, /if \(here\(\) === openedAt\) removeDraft\(key\);/, 'closing a form where it was opened lets the draft go');
  assert.match(hook, /if \(changed\.current && !discarded\.current\) writeDraft\(key, value\);/, 'an untouched form stores nothing, and a saved one nothing more');
  assert.match(read('../../src/lib/AuthContext.jsx'), /clearAllDrafts\(\);\n  if \(!userId\) return;/, 'drafts go at sign-out');
  const uses = {
    'components/DeadlineForm.jsx': /useDraft\(\s*`deadline:/,
    'components/AddEventModal.jsx': /useDraft\('event:new'/,
    'components/AddExamOrStudyModal.jsx': /useDraft\('study-block:new'/,
    'components/EditClassModal.jsx': /const draftKey = isEdit \? null : `class:new:/,
    'components/ReviewForm.jsx': /useDraft\(`\$\{draft\}:body`/,
    'components/ProjectAssignmentModal.jsx': /useDraft\(`\$\{draft\}:roadmap`/,
    'pages/SemesterSetup.jsx': /useDraft\(`\$\{draft\}:classes`/,
  };
  for (const [file, pattern] of Object.entries(uses)) assert.match(read(`../../src/${file}`), pattern, file);
  // Saved means gone: a draft brought back after the row exists would make a second row.
  assert.match(read('../../src/components/DeadlineForm.jsx'), /discardDraft\(\);\n      onSaved\?\.\(assignment\);/);
  assert.match(read('../../src/pages/SemesterSetup.jsx'), /discardClasses\(\);\n      discardInfo\(\);/);
  assert.match(read('../../src/pages/PrivacyPolicy.jsx'), /Unsaved forms<\/span>: what you have typed into a form you haven&rsquo;t saved yet/);
});

// ---------------------------------------------------------------- dark mode

test('the chosen theme is on the page before the first frame', () => {
  const main = read('../../src/main.jsx');
  assert.ok(main.indexOf("localStorage.getItem('cedar-theme') === 'dark'") < main.indexOf('ReactDOM.createRoot'));
  assert.doesNotMatch(read('../../src/components/Layout.jsx'), /cedar-theme/, 'Layout switched the theme off and on again after the first frame');
  assert.match(read('../../src/components/ProtectedRoute.jsx'), /border-muted border-t-primary/);
});

// ------------------------------------------------------------------ paywall

test('every place that takes a payment links the Terms, the Privacy Policy and the refund policy', () => {
  const links = read('../../src/components/monetization/PaywallLegalLinks.jsx');
  for (const to of ['/terms', '/privacy', '/terms#refunds']) assert.match(links, new RegExp(`to="${to}"`));
  for (const file of ['components/monetization/UpgradeSheet.jsx', 'pages/Subscription.jsx', 'pages/Onboarding.jsx', 'components/SubscriptionSettings.jsx']) {
    assert.match(read(`../../src/${file}`), /<PaywallLegalLinks( onNavigate=\{onClose\})? \/>/, file);
  }
});

test('the terms grant a licence and say how to report a copyright problem', () => {
  const terms = read('../../src/pages/Terms.jsx');
  assert.match(terms, /<Section id="licence" icon=\{KeyRound\} title="Your licence to use Praelecta">/);
  assert.match(terms, /<Section id="copyright" icon=\{Copyright\} title="Copyright complaints">/);
  assert.match(terms, /An account that keeps infringing will be closed\./);
});

// --------------------------------------------------------------- database

test('no table keeps privileges the browser does not need', () => {
  const dir = new URL('../../supabase/migrations/', import.meta.url);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const all = files.map((f) => fs.readFileSync(new URL(f, dir), 'utf8')).join('\n');
  // Tables created after the Data API grants were tightened carry Supabase's
  // default privileges for anon and authenticated unless a migration takes
  // them away. product_events kept all of them, TRUNCATE included, for a
  // month.
  const tightened = files.indexOf('20260822023448_tighten_data_api_grants_and_policies.sql');
  assert.ok(tightened >= 0);
  for (const f of files.slice(tightened + 1)) {
    for (const [, table] of fs.readFileSync(new URL(f, dir), 'utf8').matchAll(/create table (?:if not exists )?public\.([a-z_]+)/g)) {
      assert.match(all, new RegExp(`revoke all privileges on table public\\.${table} from anon, authenticated;`), `${table} (${f}) keeps the default grants`);
    }
  }
});
