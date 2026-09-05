import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Phase 4: one toolbox, used in both places.
 *
 * The Practice tab had four generation tools; a focus session had none, and
 * offered instead a fork between the handbook and the paper guide. So the one
 * screen where a student had already committed an hour gave them the fewest
 * tools in the app.
 *
 * This is an extraction, not a second implementation. A copy inside FocusMode
 * would have been two generate buttons drifting apart — and PracticePanel's
 * own tests are the proof that the Practice tab is unchanged, because they
 * were not touched.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const TOOLBOX = read('../../src/components/StudyToolbox.jsx');
const PANEL = read('../../src/components/PracticePanel.jsx');
const FOCUS = read('../../src/pages/FocusMode.jsx');

test('both callers render the same component', () => {
  assert.match(PANEL, /import StudyToolbox from '@\/components\/StudyToolbox'/);
  assert.match(FOCUS, /import StudyToolbox from '@\/components\/StudyToolbox'/);
  assert.match(PANEL, /<StudyToolbox/);
  assert.match(FOCUS, /<StudyToolbox/);
});

test('the generation lives in one file, not two', () => {
  // The whole point. A second invoke of generateStudyMaterial in the app is
  // a second place for the next bug to be fixed in only one of.
  for (const [name, src] of [['PracticePanel', PANEL], ['FocusMode', FOCUS]]) {
    assert.doesNotMatch(src, /invoke\('generateStudyMaterial'/, `${name} still generates its own material`);
    assert.doesNotMatch(src, /material_type:/, `${name} still builds the request`);
  }
  assert.match(TOOLBOX, /invoke\('generateStudyMaterial'/);
  assert.equal((TOOLBOX.match(/invoke\('generateStudyMaterial'/g) || []).length, 1);
});

test('all four tools moved, and the tier gate moved with them', () => {
  for (const id of ['flashcards', 'quiz', 'practice_test', 'summary_sheet']) {
    assert.match(TOOLBOX, new RegExp(`id: '${id}'`), `${id} did not come across`);
    assert.doesNotMatch(PANEL, new RegExp(`id: '${id}'`), `${id} is defined twice`);
  }
  // The lock is part of the tool, not part of the page around it.
  assert.match(TOOLBOX, /useFeatureGate\('study_material'\)/);
  assert.doesNotMatch(PANEL, /useFeatureGate/);
  assert.match(TOOLBOX, /Upgrade to use — practice generation ships with/);
});

test('the caller owns the scope, and is asked for it at the moment of generating', () => {
  // A value prop would be read stale while the student is still changing the
  // picker. A function is asked when it matters.
  assert.match(TOOLBOX, /const ids = resolveLectureIds \? resolveLectureIds\(\) : \[\]/);
  assert.match(TOOLBOX, /if \(ids === null\) \{ setResult\(\{ error:/, 'an unusable selection must still say so');
  // The Practice tab resolves from its picker; a session already knows.
  assert.match(PANEL, /const scopeForGeneration = \(\) => resolveScopeIds\(scopeIds, lectures\)/);
  assert.match(FOCUS, /resolveLectureIds=\{\(\) => selectedLectureIds\}/);
});

test('a result stops being shown when it stops belonging to the screen', () => {
  // PracticePanel used to clear it on class switch. Remounting on a key would
  // clear it too, and also throw away the tool the student had chosen.
  assert.match(TOOLBOX, /useEffect\(\(\) => \{ setResult\(null\); \}, \[scopeKey\]\)/);
  assert.match(PANEL, /scopeKey=\{selectedClass\}/);
  assert.doesNotMatch(PANEL, /setResult\(null\)/, 'the panel no longer owns that state');
  // A focus session's scope is its session and its lectures.
  assert.match(FOCUS, /scopeKey=\{`\$\{session\?\.id \|\| cls\?\.id \|\| ''\}:\$\{selectedLectureIds\.join\(','\)\}`\}/);
});

test('the panel still shows what was saved, and refreshes after a run', () => {
  assert.match(PANEL, /const refreshSaved = async \(\) =>/);
  assert.match(PANEL, /onGenerated=\{refreshSaved\}/);
  assert.match(TOOLBOX, /if \(onGenerated\) await onGenerated\(\)/);
  // Saved material is the panel's, not the toolbox's — a focus session has no
  // use for a wall of every card the class has ever produced.
  assert.match(PANEL, /Saved Flashcards/);
  assert.match(PANEL, /Saved Questions/);
  assert.doesNotMatch(TOOLBOX, /Saved/);
});

test('all six tools are on the focus screen, not four here and two behind a fork', () => {
  const block = FOCUS.slice(FOCUS.indexOf('Study tools'), FOCUS.indexOf('{/* Complete state */}'));
  assert.match(block, /setShowHandbook\(true\)/);
  assert.match(block, /setShowManualGuide\(true\)/);
  assert.match(block, /<StudyToolbox/);
  // And it says what the material will be built from, because a session that
  // knows its lectures should not make the student guess.
  assert.match(block, /this session covers/);
});

test('the toolbox appears once the session is running, and never on a project', () => {
  // A project session works through a roadmap of steps; generating flashcards
  // for it is not the same activity and its screen already has a checklist.
  assert.match(FOCUS, /\{\(phase === 'studying' \|\| phase === 'paused' \|\| phase === 'complete'\)\s*\n\s*&& !isProjectSession && \(session\?\.class_id \|\| cls\?\.id \|\| wizardClassId\) && \(/);
});
