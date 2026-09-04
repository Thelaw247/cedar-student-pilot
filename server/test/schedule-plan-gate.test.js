import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FEATURE_MIN_TIER } from '../lib/credits.js';

/**
 * Adding an assignment or an exam on a plan without study planning booked
 * nothing and said nothing.
 *
 * study_schedule is a Scholar feature. AddExamOrStudyModal checked the gate
 * and quietly skipped the booking; ClassDetail's AddAssignmentModal did not
 * check at all, called the route, got a 402 and swallowed it in
 * `catch (e) { console.error(e) }`. Either way the modal closed, the deadline
 * appeared, no sessions appeared, and the student was told nothing — while
 * the same booking happens automatically and free whenever Praelecta finds a
 * deadline inside a lecture, so the absence read as a bug rather than a plan
 * boundary. Live data: every hand-created assignment in the database has zero
 * sessions; every auto-detected one has a full set.
 *
 * The deadline itself stays free. What changed is that the student is told,
 * and can upgrade or carry on.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const NOTICE = read('../../src/components/monetization/ScheduleSkippedNotice.jsx');
const CLASS_DETAIL = read('../../src/pages/ClassDetail.jsx');
const EXAM_MODAL = read('../../src/components/AddExamOrStudyModal.jsx');
const forms = [['ClassDetail', CLASS_DETAIL], ['AddExamOrStudyModal', EXAM_MODAL]];

test('study planning is still a Scholar feature', () => {
  // The whole notice only makes sense while this is true.
  assert.equal(FEATURE_MIN_TIER.study_schedule, 'scholar');
});

test('neither form can book silently on a plan that cannot plan', () => {
  for (const [name, src] of forms) {
    assert.match(src, /useFeatureGate\('study_schedule'\)/, `${name}: no gate`);
    assert.match(src, /if \(!scheduleGate\.allowed\) \{ setScheduleSkipped\(true\); setSaving\(false\); return; \}/,
      `${name}: a locked plan does not reach the notice`);
    // And the gate is consulted before the call, not after.
    const gateAt = src.indexOf('if (!scheduleGate.allowed)');
    const invokeAt = src.indexOf("invoke('generateStudySchedule'");
    assert.ok(gateAt > -1 && invokeAt > gateAt, `${name}: the route is still called first`);
  }
});

test('the notice offers an upgrade and a way out, and never loses the deadline', () => {
  assert.match(NOTICE, /is saved/, 'the student must be told the deadline itself survived');
  assert.match(NOTICE, /No study sessions were booked\./);
  assert.match(NOTICE, /See plans/);
  assert.match(NOTICE, /Not now/);
  // Upgrade goes through the existing sheet, not a second one.
  assert.match(NOTICE, /useFeatureGate\('study_schedule'\)/);
  assert.match(NOTICE, /onClick=\{lock\}/);
  // Both ways out close the modal or open the sheet — no dead end.
  assert.match(NOTICE, /onClick=\{onClose\}/);
  for (const [name, src] of forms) {
    assert.match(src, /<ScheduleSkippedNotice/, `${name}: the notice is never rendered`);
  }
});

test('the button stops promising a plan it will not make', () => {
  assert.match(CLASS_DETAIL, /scheduleGate\.allowed \? 'Add & Plan Study' : 'Add assignment'/);
  assert.match(EXAM_MODAL, /scheduleGate\.allowed \? 'Add & Plan' : 'Add exam'/);
});

test('a booking that fails is reported instead of closing over it', () => {
  for (const [name, src] of forms) {
    assert.doesNotMatch(src, /catch \(e\) \{ console\.error\(e\); \}\n\s*setSaving/, `${name}: still swallowing`);
    assert.match(src, /setError\(err\?\.response\?\.data\?\.message \|\| err\?\.response\?\.data\?\.error/, `${name}: no message shown`);
    assert.match(src, /\{error && <p className="text-xs text-destructive">\{error\}<\/p>\}/, `${name}: the error is not rendered`);
  }
});

test('turning the setting off stays silent, because that is a choice', () => {
  // Only the plan boundary earns an interruption. A student who switched
  // auto-generation off in Settings already knows why there are no sessions.
  for (const [name, src] of forms) {
    assert.match(src, /if \(!getSetting\('autoGenerateSchedules'\)\) \{ onClose\(\); return; \}/, `${name}`);
  }
});
