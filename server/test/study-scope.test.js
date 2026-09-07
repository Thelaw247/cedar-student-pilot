import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readStudyScope, studyScopeParams, studyPath, STUDY_TABS } from '../../src/lib/studyScope.js';

/**
 * Phase 1 of the navigation teardown: what you are studying lives in the URL.
 *
 * Fourteen buttons in the app mean "study this", and each of them knew
 * something — this lecture, this class, this deadline. Most threw it away on
 * the way through: the class page's Focus button opened a picker asking which
 * class, and the two study tabs each kept their own copy of the selection, so
 * choosing a class in one and switching asked again.
 *
 * Nothing visible changes in this phase. It is the contract every later phase
 * is built on, so it is tested on its own before anything is built on it.
 */

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
const APP = read('../../src/App.jsx');
const PLANNER = read('../../src/pages/StudyPlanner.jsx');
const PANEL = read('../../src/components/PracticePanel.jsx');
const p = (qs) => new URLSearchParams(qs);

test('a scope reads back exactly as it was written', () => {
  const scope = { tab: 'now', classId: 'c1', lectureIds: ['l1', 'l2'], assignmentId: 'a1', sessionId: 's1' };
  assert.deepEqual(readStudyScope(p(new URLSearchParams(studyScopeParams(scope)).toString())), scope);
});

test('an empty selection means the whole class, and is not written as a key', () => {
  // `ids=` in a URL reads as an empty selection, and an empty selection
  // already means something else here — every lecture in the class. The two
  // must not be spellable the same way.
  assert.deepEqual(studyScopeParams({ classId: 'c1', lectureIds: [] }), { classId: 'c1' });
  assert.equal(studyPath({ classId: 'c1', lectureIds: [] }), '/study?classId=c1');
  assert.deepEqual(readStudyScope(p('classId=c1')).lectureIds, []);
});

test('the links already in the wild keep working', () => {
  // Nothing writes ?tab=practice any more, but it is in students' history and
  // in bookmarks. It maps rather than breaks.
  assert.equal(readStudyScope(p('tab=practice')).tab, 'now');
  assert.equal(readStudyScope(p('tab=plan')).tab, 'schedule');
  assert.equal(readStudyScope(p('tab=nonsense')).tab, 'now', 'an unknown tab falls back, never throws');
  // A bare /study opens on the tools, not on a list of dates. The page is
  // called Study; everything that means the schedule names it.
  assert.equal(readStudyScope(p('')).tab, 'now');
  assert.deepEqual(STUDY_TABS, ['now', 'schedule']);
});

test('a malformed id list is survivable', () => {
  assert.deepEqual(readStudyScope(p('ids=a,,%20b%20,')).lectureIds, ['a', 'b']);
  assert.deepEqual(readStudyScope(undefined).lectureIds, []);
  assert.equal(studyPath(), '/study');
});

test('the renamed route keeps its query string', () => {
  // <Navigate to="/study"> drops the search, and the search is where the scope
  // lives — a bookmarked /planner?classId=… would have landed on an empty page.
  assert.match(APP, /path="\/study" element=\{<StudyPlanner \/>\}/);
  assert.match(APP, /path="\/planner" element=\{<RedirectPreservingQuery to="\/study" \/>\}/);
  assert.match(APP, /\$\{to\}\$\{location\.search\}\$\{location\.hash\}/);
  assert.doesNotMatch(APP, /Navigate to="\/planner"/, 'a legacy redirect still points at the old name');
});

test('the page holds the scope in the URL, not in its own state', () => {
  assert.match(PLANNER, /const \[scope, setScope\] = useStudyScope\(\)/);
  assert.doesNotMatch(PLANNER, /useState\(initialTab\)/, 'the tab is component state again');
  assert.doesNotMatch(PLANNER, /useSearchParams/, 'the page reads the query string behind the hook');
});

test('the one picker reports to the URL', () => {
  // Phase 1 wired two pickers to one scope; phase 2 deleted the second picker
  // outright (ReviewFromLectures went with it), so there is one left and it
  // still has to report. The count is 1 rather than 2 for that reason — if a
  // second picker ever comes back, it belongs on this list.
  assert.match(PANEL, /onScopeChange/, 'PracticePanel keeps its selection to itself');
  assert.match(PANEL, /onScopeChange\(\{ classId: id, lectureIds: \[\] \}\)/,
    'PracticePanel does not report a class change');
  assert.match(PANEL, /onScopeChange\(\{ lectureIds: ids \|\| \[\] \}\)/,
    'PracticePanel does not report a lecture change');
  assert.equal((PLANNER.match(/onScopeChange=\{setScope\}/g) || []).length, 1,
    'the practice tab is not wired to the scope');
});

test('changing the scope does not fill up the back button', () => {
  // Adjusting which lectures you want is one intention being refined, not
  // navigation. Pushing each change would make Back walk through every one of
  // them instead of leaving the page.
  const SCOPE = read('../../src/lib/studyScope.js');
  assert.match(SCOPE, /\{ replace: true \}/);
  assert.match(SCOPE, /params\.delete\(key\)/, 'a stale scope key could survive a change');
});
