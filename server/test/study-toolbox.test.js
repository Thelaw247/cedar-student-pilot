import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * One toolbox, and one place a student studies.
 *
 * It began as an extraction: the Practice tab had four generation tools and a
 * focus session had none, so the screen where a student had already committed
 * an hour gave them the fewest tools in the app. The toolbox was pulled out
 * and rendered in both.
 *
 * The navigation teardown finished the job from the other end. There is no
 * second study screen to render it on any more — the timer came to the tools
 * rather than the tools being copied to the timer — so the toolbox has one
 * caller again, and this time that is the point rather than the problem.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const TOOLBOX = read('../../src/components/StudyToolbox.jsx');
const PANEL = read('../../src/components/PracticePanel.jsx');
const FOCUS = read('../../src/pages/FocusMode.jsx');

test('one caller renders it, and the timer comes to it', () => {
  assert.match(PANEL, /import StudyToolbox from '@\/components\/StudyToolbox'/);
  assert.match(PANEL, /<StudyToolbox/);
  // The project screen is the only other study surface left, and generating
  // flashcards was never part of working through a roadmap step — the old
  // render there was already guarded by !isProjectSession.
  assert.doesNotMatch(FOCUS, /<StudyToolbox/);
  assert.match(FOCUS, /<StudyTimer variant="full"/, 'the project screen keeps the clock, not the tools');
});

test('the generation lives in one file, not two', () => {
  // The whole point. A second invoke of generateStudyMaterial in the app is
  // a second place for the next bug to be fixed in only one of.
  for (const [name, src] of [['PracticePanel', PANEL], ['FocusMode', FOCUS]]) {
    assert.doesNotMatch(src, /invoke\('generateStudyMaterial'/, `${name} still generates its own material`);
    assert.doesNotMatch(src, /material_type:/, `${name} still builds the request`);
  }
  // And nowhere else in the app either.
  const files = fs.readdirSync(new URL('../../src', import.meta.url), { recursive: true })
    .filter((f) => String(f).endsWith('.jsx') || String(f).endsWith('.js'));
  const callers = files.filter((f) => /invoke\('generateStudyMaterial'/.test(read(`../../src/${f}`)));
  assert.deepEqual(callers, ['components/StudyToolbox.jsx']);
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
  // The study page resolves it from the one picker at the top.
  assert.match(PANEL, /const scopeForGeneration = \(\) => resolveScopeIds\(scopeIds, lectures\)/);
});

test('a result stops being shown when it stops belonging to the screen', () => {
  // PracticePanel used to clear it on class switch. Remounting on a key would
  // clear it too, and also throw away the tool the student had chosen.
  assert.match(TOOLBOX, /useEffect\(\(\) => \{ setResult\(null\); \}, \[scopeKey\]\)/);
  assert.match(PANEL, /scopeKey=\{selectedClass\}/);
  assert.doesNotMatch(PANEL, /setResult\(null\)/, 'the panel no longer owns that state');
});

test('the panel still shows what was saved, and refreshes after a run', () => {
  assert.match(PANEL, /const refreshSaved = async \(\) =>/);
  assert.match(PANEL, /onGenerated=\{onGenerated\}/);
  assert.match(PANEL, /await refreshSaved\(\);/, 'a run still refreshes the saved lists');
  // The callback carries the lectures the material was built from, which is
  // how the running session learns what it opened — the panel refreshes its
  // saved lists AND reports them.
  assert.match(TOOLBOX, /if \(onGenerated\) await onGenerated\(ids\)/);
  assert.match(PANEL, /await studySession\.markOpened\(ids\)/);
  // Saved material is the panel's, not the toolbox's — a focus session has no
  // use for a wall of every card the class has ever produced.
  assert.match(PANEL, /Saved Flashcards/);
  assert.match(PANEL, /Saved Questions/);
  assert.doesNotMatch(TOOLBOX, /Saved/);
});

test('all six tools are on one page, under one picker', () => {
  const SHELF = read('../../src/components/StudyShelf.jsx');
  for (const title of ['Quiz me', 'Handbook', 'Paper guide']) {
    assert.match(SHELF, new RegExp(`title="${title}"`));
  }
  assert.match(PANEL, /<StudyShelf/);
  assert.match(PANEL, /<StudyToolbox/);
  assert.equal((PANEL.match(/<LectureScopePicker/g) || []).length, 1);
});

test('a project session gets the clock and its roadmap, not the material tools', () => {
  // Working through a roadmap step is not the same activity as building
  // flashcards, and its screen already has a rubric checklist. The old render
  // was guarded by !isProjectSession; now there is simply nothing to guard.
  assert.match(FOCUS, /session_type !== 'project'/);
  assert.match(FOCUS, /roadmap_step_index/);
  assert.doesNotMatch(FOCUS, /<StudyShelf/);
});
