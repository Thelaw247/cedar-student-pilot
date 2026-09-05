import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Phase 3: Focus Mode reads the session it was opened from.
 *
 * /focus/:sessionId loaded the row and read assignment_id for the rubric,
 * then never looked at the lectures. Scope came from a ?lectureId= URL param
 * or the wizard's manual picker — so the one session that already knew its
 * lecture ("Review: Introduction to Cellular Biology") opened empty and asked
 * the student to pick it again. After phase 2 every booked session knows,
 * which makes the omission cost far more than one review session.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const FOCUS = read('../../src/pages/FocusMode.jsx');
const WIZARD = read('../../src/components/FocusSessionWizard.jsx');
const HANDBOOK = read('../routes/generateClassHandbook.js');
const GUIDE = read('../../src/components/ManualStudyGuide.jsx');

test('the session hands Focus Mode its lectures', () => {
  assert.match(FOCUS, /if \(Array\.isArray\(s\.lecture_ids\) && s\.lecture_ids\.length > 0\) \{\s*\n\s*setSelectedLectureIds\(s\.lecture_ids\);/);
  // And they reach the wizard, which is what skips the picker.
  assert.match(FOCUS, /initialLectureIds=\{selectedLectureIds\}/);
});

test('a known goal skips the wizard; known lectures skip only the picker', () => {
  // Opening a lecture means "review this lecture" — goal included, so the
  // whole wizard collapses to the method question, exactly as before.
  // Opening a booked session does not: its lectures are known, but deep /
  // sprint / review is still the student's call, and answering it for them
  // picks their timer preset as a side effect.
  assert.match(WIZARD, /const fullySeeded = !!\(initialClassId && initialLectureIds\.length > 0 && initialGoal\)/);
  assert.match(WIZARD, /fullySeeded \? 'method' : \(initialClassId \? 'goal' : 'class'\)/);
  assert.match(WIZARD, /useState\(fullySeeded \? initialGoal : null\)/);
  // The picker skip is unchanged and independent of the goal.
  assert.match(WIZARD, /setStep\(lectureIds\.length > 0 \? 'method' : 'lectures'\)/);
});

test('only the lecture route claims to know the goal', () => {
  const seedBlock = FOCUS.slice(FOCUS.indexOf('if (lectureIdParam) {'), FOCUS.indexOf('}, [sessionId, classIdParam, lectureIdParam]'));
  assert.match(seedBlock, /setWizardGoal\('review'\)/);
  assert.match(FOCUS, /initialGoal=\{wizardGoal\}/);
  // The session branch must not set it, or every booked session becomes a
  // 30-minute review pass whatever the student wanted.
  const sessionBlock = FOCUS.slice(FOCUS.indexOf('base44.entities.StudySession.get(sessionId)'), FOCUS.indexOf('} else if (classIdParam)'));
  assert.doesNotMatch(sessionBlock, /setWizardGoal/);
});

test('a handbook scoped to an exam AND a lecture list gets its own cache row', () => {
  // assignment_id used to short-circuit the key, so two different lecture
  // sets shared one cached handbook — and Focus Mode sends both in sprint
  // mode, which is precisely when it matters.
  assert.doesNotMatch(HANDBOOK, /const scopeKey = assignment_id \?/);
  assert.match(HANDBOOK, /if \(assignment_id\) scopeParts\.push\(`assignment:\$\{assignment_id\}`\)/);
  assert.match(HANDBOOK, /if \(lecture_ids && lecture_ids\.length > 0\) scopeParts\.push\(`lectures:/);
  assert.match(HANDBOOK, /scopeParts\.length > 0 \? scopeParts\.join\('\|'\) : 'full'/);
  // A single-part call still produces the key it always did, so every
  // existing cached handbook keeps hitting rather than regenerating.
  assert.match(HANDBOOK, /`assignment:\$\{assignment_id\}`/);
  assert.match(HANDBOOK, /`lectures:\$\{\[\.\.\.lecture_ids\]\.sort\(\)\.join\(','\)\}`/);
});

test('the paper guide refetches when the scope changes', () => {
  // Its deps were [classId, studyMode], so a changed lecture list served the
  // guide for whatever the student was studying last time. HandbookReader
  // already carried this fix; this is the same bug in the file beside it.
  assert.match(GUIDE, /\}, \[classId, studyMode, assignmentId, \(lectureIds \|\| \[\]\)\.join\(','\)\]\);/);
});

test('a session with no lectures still asks, rather than starting empty', () => {
  // Every session booked before phase 2, and every ad-hoc study block.
  // Falling through to today's behaviour is the whole safety story here.
  assert.match(FOCUS, /s\.lecture_ids\.length > 0/, 'an empty scope must not be seeded as a selection');
  assert.match(WIZARD, /initialLectureIds\.length > 0 && initialGoal/, 'an empty scope must not skip the wizard');
});
