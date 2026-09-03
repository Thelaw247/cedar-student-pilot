import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LECTURE_PENDING, LECTURE_PROCESSING, PROCESSING_STALE_MINUTES } from '../../shared/lectureStatus.js';
import { RECLAIM_REASON } from '../routes/reclaimStuckLectures.js';

/**
 * processLectureRecording claims a lecture by setting it to 'processing' and
 * releases it in a catch block — which only runs in-process. A Render restart,
 * a redeploy or an OOM kill mid-run leaves the row 'processing' with nobody
 * working on it. The lecture page then polls forever and never shows the retry
 * button, because retry is gated on 'pending'. The audio is safe in R2 the
 * whole time and nothing in the product will touch it.
 *
 * claimLecture already had the recovery rule (a row older than the stale
 * window is re-claimable); nothing ever applied it unprompted. These pin the
 * sweep that does, and the page behaviour that stops pretending work is
 * happening.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const ROUTE = read('../routes/reclaimStuckLectures.js');
const PROCESS = read('../routes/processLectureRecording.js');
const INDEX = read('../index.js');
const WORKFLOW = read('../../.github/workflows/scheduled-credit-grant.yml');
const DETAIL = read('../../src/pages/LectureDetail.jsx');

test('one stale window is shared by everything that depends on it', () => {
  // Three consumers: the re-claim in processLectureRecording, this sweep, and
  // the lecture page's decision to stop waiting. A second copy of the number
  // is a bug waiting for the two to drift.
  assert.equal(typeof PROCESSING_STALE_MINUTES, 'number');
  assert.ok(PROCESSING_STALE_MINUTES >= 10, 'too short a window could reclaim a lecture that is still being worked on');
  assert.doesNotMatch(PROCESS, /const PROCESSING_STALE_MINUTES\s*=/, 'the constant was redefined locally');
  assert.match(PROCESS, /import \{ PROCESSING_STALE_MINUTES \} from '\.\.\/\.\.\/shared\/lectureStatus\.js'/);
  assert.match(ROUTE, /PROCESSING_STALE_MINUTES/);
  assert.match(DETAIL, /PROCESSING_STALE_MINUTES/);
});

test('the sweep only touches rows that are genuinely abandoned', () => {
  // Bounded by both status and age: a lecture actively being processed right
  // now must never be yanked out from under the run that owns it.
  assert.match(ROUTE, /where status = \$3\s*\n\s*and updated_at < now\(\) - make_interval\(mins => \$4\)/);
  assert.match(ROUTE, /\[LECTURE_PENDING, RECLAIM_REASON, LECTURE_PROCESSING, PROCESSING_STALE_MINUTES\]/);
  // Released to 'pending', which is the one status the retry button reacts to.
  assert.equal(LECTURE_PENDING, 'pending');
  assert.equal(LECTURE_PROCESSING, 'processing');
});

test('the sweep is idempotent and safe to run twice', () => {
  // The UPDATE matches only rows still in 'processing' past the window, so a
  // second pass in the same minute matches nothing. No cooldown state needed.
  assert.match(ROUTE, /returning id, user_id/);
  assert.match(ROUTE, /reclaimed: rows\.length/);
});

test('the sweep is behind the same shared-secret gate as the other scheduled routes', () => {
  assert.match(ROUTE, /x-cedar-trigger-token/);
  assert.match(ROUTE, /tokensMatch/, 'token comparison must be constant-time, like the sibling routes');
  assert.match(ROUTE, /status\(401\)/);
  // Falls back to the grant token so the sweep works without a second secret
  // having to be provisioned before it can ever run.
  assert.match(ROUTE, /RECLAIM_TRIGGER_TOKEN \|\| process\.env\.GRANT_TRIGGER_TOKEN/);
});

test('the reason a student reads says the recording is safe', () => {
  // The first thought on seeing a failed lecture is that the audio is gone.
  assert.match(RECLAIM_REASON, /safe/i);
  assert.ok(RECLAIM_REASON.length > 60 && RECLAIM_REASON.length < 300);
});

test('something actually calls it', () => {
  // A sweeper nobody runs is the state this whole fix is replacing.
  assert.match(INDEX, /app\.use\('\/reclaim-stuck-lectures', reclaimStuckLecturesRouter\)/);
  assert.match(WORKFLOW, /reclaim-stuck-lectures/);
  assert.match(WORKFLOW, /^ {2}reclaim:$/m, 'the reclaim job is not in the scheduled workflow');
  assert.match(WORKFLOW, /schedule:/);
});

test('the lecture page stops polling a lecture the server has abandoned', () => {
  assert.match(DETAIL, /const processingStalled = processingMinutes > PROCESSING_STALE_MINUTES/);
  assert.match(DETAIL, /if \(processingStalled\) return undefined;/,
    'the poll keeps running against a row that will never change');
  // And offers the same recovery the pending state gets, rather than an
  // indefinite "Processing..." with no way out.
  assert.match(DETAIL, /\(lecture\.status === LECTURE_PENDING \|\| processingStalled\)/);
  assert.match(DETAIL, /Processing stopped before it finished/);
});
