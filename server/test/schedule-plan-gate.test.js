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
const FORM = read('../../src/components/DeadlineForm.jsx');
const SAVE = read('../../src/lib/saveDeadline.js');
const PENDING = read('../../src/components/monetization/PendingSchedules.jsx');
// The two surfaces that used to carry a copy of the form each. They are
// shells around the one form now, and the assertions that used to be made
// against both are made against it.
const shells = [['ClassDetail', CLASS_DETAIL], ['AddExamOrStudyModal', EXAM_MODAL]];

test('study planning is still a Scholar feature', () => {
  // The whole notice only makes sense while this is true.
  assert.equal(FEATURE_MIN_TIER.study_schedule, 'scholar');
});

test('the form, and the create-then-book sequence, each exist once', () => {
  // Both were written out twice, character for character, and one copy was
  // always a release behind the other — ClassDetail's did not check the gate
  // at all for months.
  for (const [name, src] of shells) {
    assert.match(src, /import DeadlineForm, \{ DeadlineModal \} from '@\/components\/DeadlineForm'/, `${name}: not using the shared form`);
    assert.match(src, /<DeadlineForm/, `${name}: the form is never rendered`);
    assert.doesNotMatch(src, /invoke\('generateStudySchedule'/, `${name}: books the sessions itself again`);
    assert.doesNotMatch(src, /useFeatureGate\('study_schedule'\)/, `${name}: a second copy of the gate`);
    assert.doesNotMatch(src, /<DeadlineCoverage/, `${name}: a second copy of the coverage control`);
  }
  assert.match(FORM, /import \{ saveDeadline, bookSessionsFor, bookingErrorMessage \} from '@\/lib\/saveDeadline'/);
  assert.match(SAVE, /invoke\('generateStudySchedule', \{ assignment_id: assignmentId \}\)/);
});

test('the form cannot book silently on a plan that cannot plan', () => {
  assert.match(FORM, /useFeatureGate\('study_schedule'\)/, 'no gate');
  assert.match(FORM, /scheduleAllowed: scheduleGate\.allowed/, 'the gate is not passed to the save');
  assert.match(FORM, /if \(outcome === 'locked'\) \{ setScheduleSkipped\(true\); setSaving\(false\); return; \}/,
    'a locked plan does not reach the notice');
  // And the gate is consulted before the call, not after.
  const gateAt = SAVE.indexOf('if (!scheduleAllowed)');
  const invokeAt = SAVE.indexOf('bookSessionsFor(assignment.id)');
  assert.ok(gateAt > -1 && invokeAt > gateAt, 'the route is called before the plan is checked');
});

test('the notice offers an upgrade and a way out, and never loses the deadline', () => {
  assert.match(NOTICE, /is saved/, 'the student must be told the deadline itself survived');
  assert.match(NOTICE, /No study sessions were booked, because/);
  assert.match(NOTICE, /See plans/);
  assert.match(NOTICE, /Not now/);
  // Upgrade goes through the existing sheet, not a second one.
  assert.match(NOTICE, /useFeatureGate\('study_schedule'\)/);
  assert.match(NOTICE, /lock\(\);/);
  // Both ways out close the modal or open the sheet — no dead end.
  assert.match(NOTICE, /onClick=\{onClose\}/);
  assert.match(FORM, /<ScheduleSkippedNotice/, 'the notice is never rendered');
});

test('the notice names the plan the student is actually on', () => {
  // "Scholar and up" says what unlocks it. It never said what they had, so
  // the sentence read as a rule rather than as something about them.
  assert.match(NOTICE, /you&rsquo;re on \{tierOf\(tier\)\.name\}/);
});

test('upgrading finishes the booking it interrupted', () => {
  // Otherwise the upgrade goes through and the exam the student had just
  // added still has nothing scheduled against it — the one thing they
  // upgraded for does not happen.
  assert.match(NOTICE, /rememberPendingSchedule\(assignmentId\)/);
  assert.match(NOTICE, /const seePlans = \(\) => \{/);
  assert.match(FORM, /assignmentId=\{savedAssignment\?\.id\}/, 'the notice is not told which deadline');
  // Picked up wherever the upgrade lands, not only on the checkout page.
  assert.match(PENDING, /hasFeature\(tier, 'study_schedule'\)/);
  assert.match(PENDING, /bookSessionsFor\(id\)/);
  // Forgotten whatever happens, or a deleted deadline retries on every load.
  assert.match(PENDING, /forgetPendingSchedule\(id\);/);
  const LAYOUT = read('../../src/components/Layout.jsx');
  assert.match(LAYOUT, /<PendingSchedules \/>/);
});

test('the button stops promising a plan it will not make', () => {
  assert.match(FORM, /scheduleGate\.allowed \? 'Add & Plan Study' : `Add \$\{deadlineTypeLabel\(form\.type\)\}`/);
  // And it names the thing being added rather than always saying "exam".
  assert.match(FORM, /confirmsCoverage \? 'Next: what it covers'/, 'no confirm step');
});

test('a booking that fails is reported instead of closing over it', () => {
  assert.doesNotMatch(FORM, /catch \(e\) \{ console\.error\(e\); \}\n\s*setSaving/, 'still swallowing');
  assert.match(FORM, /if \(outcome === 'failed'\) \{ setError\(bookingError\)/, 'no message shown');
  assert.match(FORM, /\{error && <p className="text-xs text-destructive">\{error\}<\/p>\}/, 'the error is not rendered');
});

test('retrying a failed booking books, it does not add a second deadline', () => {
  // The form stays open on a failed booking with its button live, and nothing
  // in the database stops two deadlines sharing a title and a date — so the
  // second press used to create a duplicate with its own column of sessions.
  assert.match(FORM, /if \(savedAssignment\) \{/);
  assert.match(FORM, /await bookSessionsFor\(savedAssignment\.id\);/);
  const guardAt = FORM.indexOf('if (savedAssignment) {');
  const createAt = FORM.indexOf('await saveDeadline({');
  assert.ok(guardAt > -1 && createAt > guardAt, 'the create runs before the guard');
  // And the button says what it will do.
  assert.match(FORM, /savedAssignment \? 'Try booking again'/);
});

test('nothing pays for a booking that cannot produce a session', () => {
  // generateStudySchedule charges as soon as its gate passes, whether or not
  // a session comes back, and bookAssignmentSessions returns none for a
  // deadline that is past due or already has them.
  assert.match(PENDING, /assignment\.due_date < today/);
  assert.match(PENDING, /StudySession\.filter\(\{ assignment_id: id \}\)/);
  assert.match(PENDING, /if \(existing\.length === 0\) \{/);
  const EDIT = read('../../src/components/AssignmentEditModal.jsx');
  assert.match(EDIT, /const created = await bookSessionsFor\(assignment\.id\);/);
  assert.match(EDIT, /if \(created === 0\) \{/, 'a booking that placed nothing looks like a no-op');
});

test('a create that fails is not described as a deadline that saved', () => {
  // Both copies wrapped the create and the booking in one try and reported
  // the catch as "Saved, but the study sessions could not be booked" — so a
  // rejected write told the student their exam was on the calendar.
  assert.match(SAVE, /const assignment = await base44\.entities\.Assignment\.create\(fields\);/);
  const createAt = SAVE.indexOf('Assignment.create(fields)');
  const tryAt = SAVE.indexOf('try {');
  assert.ok(createAt < tryAt, 'the create is back inside the booking try');
  assert.match(FORM, /'That could not be saved\. Check your connection and try again\.'/, 'still blames the booking');
});

test('turning the setting off stays silent, because that is a choice', () => {
  // Only the plan boundary earns an interruption. A student who switched
  // auto-generation off in Settings already knows why there are no sessions.
  assert.match(SAVE, /if \(!wantsSchedule\) return \{ assignment, outcome: 'off' \};/);
  assert.match(SAVE, /getSetting\('autoGenerateSchedules'\)/);
  // 'off' is not an interruption: only 'locked' and 'failed' stop, and
  // everything else closes.
  assert.doesNotMatch(FORM, /outcome === 'off'/, 'the setting now interrupts');
});
