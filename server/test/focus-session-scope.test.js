import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * A booked session brings its own scope — and there is nothing left to ask.
 *
 * /focus/:sessionId loaded the row, read assignment_id for the rubric, and
 * then never looked at the lectures: the one session that already knew what
 * it covered opened a wizard asking the student to pick them again. The first
 * fix handed those lectures to the wizard. This one deletes the wizard.
 *
 * All three of its questions came from somewhere the app could already see.
 * Which class: the scope picker. What for: the session row — a review block
 * is a review, a block tied to an exam is a sprint. How long: the session was
 * booked with a duration, and the planner has shown that number on the card
 * since the day it was created. In the app or on paper: not a question at
 * all, but a prediction, and the record believed it even when the student did
 * the opposite.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const FOCUS = read('../../src/pages/FocusMode.jsx');
const PLANNER = read('../../src/pages/StudyPlanner.jsx');
const APP = read('../../src/App.jsx');
const HANDBOOK = read('../routes/generateClassHandbook.js');
const GUIDE = read('../../src/components/ManualStudyGuide.jsx');

test('the wizard and its picker are gone from disk and from the tree', () => {
  assert.throws(() => read('../../src/components/FocusSessionWizard.jsx'), /ENOENT/);
  assert.throws(() => read('../../src/components/LecturePickerSheet.jsx'), /ENOENT/);
  // Imports and renders, not prose: the files that explain why the wizard is
  // gone name it, and a bare name match would fail on its own obituary.
  const used = /(?:import\s+\w+\s+from\s+'[^']*(?:FocusSessionWizard|LecturePickerSheet)'|<(?:FocusSessionWizard|LecturePickerSheet)[\s/>])/;
  const files = fs.readdirSync(new URL('../../src', import.meta.url), { recursive: true });
  for (const f of files) {
    if (!String(f).endsWith('.jsx') && !String(f).endsWith('.js')) continue;
    assert.doesNotMatch(read(`../../src/${f}`), used, `${f} still uses it`);
  }
});

test('the session hands the study page its lectures, its class and its length', () => {
  assert.match(PLANNER, /const s = await base44\.entities\.StudySession\.get\(scope\.sessionId\)/);
  assert.match(PLANNER, /const ids = Array\.isArray\(s\.lecture_ids\) \? s\.lecture_ids\.filter\(Boolean\) : \[\]/);
  assert.match(PLANNER, /studySession\.adopt\(\{ session: s, cls: c, assignment: a, classId: s\.class_id, lectureIds: ids \}\)/);
  // And the pickers follow, so every tool is pointed at what it covers.
  assert.match(PLANNER, /setScope\(\{ tab: 'now', classId: s\.class_id \|\| '', lectureIds: ids \}\)/);
});

test('adopting a session never starts its clock', () => {
  // Focus Mode never auto-started either, and a timer that starts itself
  // records time nobody spent.
  const CTX = read('../../src/study/StudySessionContext.jsx');
  const adopt = CTX.slice(CTX.indexOf('const adopt = useCallback'), CTX.indexOf('const start = useCallback'));
  assert.doesNotMatch(adopt, /setPhase\('studying'\)/);
  assert.match(adopt, /if \(phaseRef\.current !== 'idle'\) return false;/, 'adopting must not replace a running session');
});

test('a project session keeps its own screen; everything else is the study page', () => {
  assert.match(FOCUS, /if \(s\?\.session_type !== 'project'\) \{ setState\('redirect'\); return; \}/);
  assert.match(FOCUS, /<Navigate to=\{studyPath\(\{ tab: 'now', sessionId: sessionId \|\| '' \}\)\} replace \/>/);
  // A roadmap step, a rubric and its own end question — none of which is
  // about lectures, and none of which ever went through the wizard.
  assert.match(FOCUS, /roadmap_step_index/);
  assert.match(FOCUS, /assignment\?\.rubric\?\.length > 0/);
  assert.match(FOCUS, /<StudyTimer variant="full"/);
});

test('/focus keeps what its callers knew', () => {
  // The lecture page sends ?lectureId&classId. Dropping them would ask the
  // student for something the link already said.
  assert.match(APP, /path="\/focus" element=\{<RedirectFocusToStudy \/>\}/);
  assert.match(APP, /if \(classId\) next\.set\('classId', classId\)/);
  assert.match(APP, /if \(lectureId\) next\.set\('ids', lectureId\)/);
  // The :sessionId route is NOT blanket-redirected — it has to read the row
  // first, because a project session stays where it is.
  assert.match(APP, /path="\/focus\/:sessionId" element=\{<FocusMode \/>\}/);
});

test('a handbook scoped to an exam AND a lecture list gets its own cache row', () => {
  // assignment_id used to short-circuit the key, so two different lecture
  // sets shared one cached handbook.
  assert.doesNotMatch(HANDBOOK, /const scopeKey = assignment_id \?/);
  assert.match(HANDBOOK, /if \(assignment_id\) scopeParts\.push\(`assignment:\$\{assignment_id\}`\)/);
  assert.match(HANDBOOK, /if \(lecture_ids && lecture_ids\.length > 0\) scopeParts\.push\(`lectures:/);
  assert.match(HANDBOOK, /scopeParts\.length > 0 \? scopeParts\.join\('\|'\) : 'full'/);
  assert.match(HANDBOOK, /`lectures:\$\{\[\.\.\.lecture_ids\]\.sort\(\)\.join\(','\)\}`/);
});

test('the paper guide refetches when the scope changes', () => {
  // Its deps were [classId, studyMode], so a changed lecture list served the
  // guide for whatever the student was studying last time.
  assert.match(GUIDE, /\}, \[classId, studyMode, assignmentId, \(lectureIds \|\| \[\]\)\.join\(','\)\]\);/);
});
