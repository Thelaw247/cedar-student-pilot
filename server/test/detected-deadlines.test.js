import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * A deadline Praelecta hears in a lecture is a question now, not a fact.
 *
 * processLectureRecording used to create the assignment outright and book a
 * full set of study sessions for it, free, on any plan. Three things were
 * wrong with that, and each one is a test below:
 *
 *  1. Nobody was asked. A date that moved, a title the model misheard, or a
 *     professor mentioning another section's essay all landed on the calendar
 *     as real work, and the notice announcing it had one button, which
 *     dismissed the notice rather than the assignment.
 *  2. It did not behave like a deadline the student typed in. A manual one
 *     books nothing on Student — study_schedule is a Scholar feature — while a
 *     detected one booked a full set, which made the manual case read as
 *     broken.
 *  3. Answering it had nowhere to go. It does now: the same form, with the
 *     same coverage step and the same plan check as every other deadline.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const ROUTE = read('../routes/processLectureRecording.js');
const CARDS = read('../../src/components/DetectedDeadlines.jsx');
const SCHEDULER = read('../lib/studyScheduler.js');
const MIGRATION = read('../../supabase/migrations/20260908010000_detected_deadlines_ask_first.sql');

test('the pipeline records candidates instead of creating assignments', () => {
  assert.match(ROUTE, /async function recordDetectedDeadlines\(/);
  assert.match(ROUTE, /update lectures set detected_deadlines = \$1 where id = \$2 and user_id = \$3/);
  // The insert and the booking that used to follow it, gone rather than
  // guarded — a flag with two branches is two behaviours to keep working.
  assert.doesNotMatch(ROUTE, /insert into assignments/);
  assert.doesNotMatch(ROUTE, /bookAssignmentSessions/);
});

test('booking sessions has one caller again, and it checks the plan', () => {
  // The detection pipeline was the second, and it never checked: the same
  // deadline got a full set of sessions or none depending on how it arrived.
  assert.match(SCHEDULER, /export async function bookAssignmentSessions/);
  const ROUTE_SCHEDULE = read('../routes/generateStudySchedule.js');
  assert.match(ROUTE_SCHEDULE, /gateFeature\(userId, 'study_schedule', res\)/);
  const gateAt = ROUTE_SCHEDULE.indexOf("gateFeature(userId, 'study_schedule'");
  const bookAt = ROUTE_SCHEDULE.indexOf('bookAssignmentSessions(');
  assert.ok(gateAt > -1 && bookAt > gateAt, 'the sessions are booked before the plan is checked');
});

test('a candidate that is already on the calendar is not asked about', () => {
  // Typed in by hand, confirmed from an earlier lecture, or mentioned twice.
  assert.match(ROUTE, /select id from assignments where user_id = \$1 and class_id = \$2 and due_date = \$3 and lower\(title\) = lower\(\$4\) limit 1/);
  // And nothing already past is worth preparing for.
  assert.match(ROUTE, /if \(item\.due_date < today\) continue;/);
});

test('an answered question survives a re-analysis, if one ever happens', () => {
  // Detection runs once per lecture today — its caller is inside
  // `if (!lecture.ai_title)`, and ai_title is only ever set — so this is a
  // guard rather than a path in use. It is what keeps a student's "no" a no
  // on the day a reprocess path does re-analyse a lecture.
  assert.match(ROUTE, /if \(!lecture\.ai_title\) \{/);
  assert.match(ROUTE, /\.filter\(\(d\) => d && d\.decision\)/);
  assert.match(ROUTE, /for \(const d of answered\.values\(\)\) if \(!next\.some\(\(n\) => key\(n\) === key\(d\)\)\) next\.push\(d\);/);
});

test('answering opens the same form a student would have used', () => {
  // Not a second create path: the coverage step, the plan check and the
  // booking all have to be the ones every other deadline goes through.
  assert.match(CARDS, /import DeadlineForm, \{ DeadlineModal \} from '@\/components\/DeadlineForm'/);
  assert.match(CARDS, /initial=\{\{ title: adding\.item\.title, due_date: adding\.item\.due_date, type: adding\.item\.type \}\}/);
  assert.doesNotMatch(CARDS, /Assignment\.create/, 'the card creates the assignment itself');
  // Both answers are offered, and both are recorded on the lecture.
  assert.match(CARDS, /Add it/);
  assert.match(CARDS, /No thanks/);
  // Two answers, two controls. A ✕ beside "No thanks" would do the same
  // thing, which is how the notice this replaces ended up with a button that
  // dismissed the card and left the work.
  assert.doesNotMatch(CARDS, /aria-label="Dismiss"/);
  assert.match(CARDS, /decide\(adding, 'added', assignment\?\.id \|\| null\)/);
  assert.match(CARDS, /decide\(entry, 'dismissed'\)/);
  // Answered by what the question was, not by where it sat: reprocessing a
  // lecture rewrites the array, and answering by position could mark a
  // different deadline as the one the student declined.
  assert.match(CARDS, /const at = list\.findIndex\(same\);/);
});

test('the decision is recorded before the plan notice can be closed over', () => {
  // onSaved fires the moment the row exists; onDone fires when the flow ends.
  // If the card waited for onDone, a student who closed the modal on the
  // upgrade notice would be asked again about a deadline already saved.
  const FORM = read('../../src/components/DeadlineForm.jsx');
  const savedAt = FORM.indexOf('onSaved?.(assignment)');
  const lockedAt = FORM.indexOf("if (outcome === 'locked')");
  assert.ok(savedAt > -1 && lockedAt > savedAt, 'the caller is told after the notice, not before');
});

test('the cards read the lectures the page already has', () => {
  // A component that fetched for itself would be a third copy of "which
  // lectures does this student have" on a screen that holds two already.
  assert.doesNotMatch(CARDS, /Lecture\.filter|Lecture\.list/);
  assert.match(read('../../src/pages/Home.jsx'), /<DetectedDeadlines lectures=\{lectures\}/);
  assert.match(read('../../src/pages/ClassDetail.jsx'), /<DetectedDeadlines lectures=\{lectures\}/);
});

test('the announcement it replaces is gone', () => {
  // It announced an assignment that already existed and was already booked;
  // its only button dismissed the notice, not the work.
  assert.ok(!fs.existsSync(new URL('../../src/components/AssignmentDetectedNotice.jsx', import.meta.url)));
  for (const p of ['../../src/pages/Home.jsx', '../../src/pages/ClassDetail.jsx']) {
    assert.doesNotMatch(read(p), /AssignmentDetectedNotice/);
  }
});

test('the column is additive and defaulted, so no lecture changes', () => {
  assert.match(MIGRATION, /add column if not exists detected_deadlines jsonb not null default '\[\]'::jsonb/);
  assert.doesNotMatch(MIGRATION, /\b(delete|drop|truncate)\b/i);
});
