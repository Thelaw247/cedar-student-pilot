import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { studyPath, sessionStudyPath, readStudyScope, STUDY_TABS } from '../../src/lib/studyScope.js';

/**
 * The navigation teardown, checked as one thing.
 *
 * Five phases, and three promises that only mean anything together:
 *
 *   one route can reach every tool
 *   no screen asks a question before showing the material
 *   every entry point carries what it knew
 *
 * The per-phase tests pin how each piece was built. This one pins what the
 * pieces were for, so a future change that quietly re-adds a chooser, a second
 * study surface, or a link that drops its scope fails here even if it passes
 * everywhere else.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const SRC = new URL('../../src', import.meta.url);
const files = fs.readdirSync(SRC, { recursive: true })
  .filter((f) => String(f).endsWith('.jsx') || String(f).endsWith('.js'));
const source = (f) => read(`../../src/${f}`);

const APP = read('../../src/App.jsx');
const PLANNER = read('../../src/pages/StudyPlanner.jsx');
const PANEL = read('../../src/components/PracticePanel.jsx');
const SHELF = read('../../src/components/StudyShelf.jsx');
const TOOLBOX = read('../../src/components/StudyToolbox.jsx');

// --- one route can reach every tool ---------------------------------------

test('every study tool is reachable from /study, under one picker', () => {
  // The runners, opened in place or linked with the scope on them.
  for (const tile of ['Quiz me', 'Handbook', 'Paper guide', "Today's lectures", 'This week']) {
    assert.match(SHELF, new RegExp(`title="${tile.replace(/'/g, "\\\\?'")}"`), `${tile} left the shelf`);
  }
  // The makers.
  for (const id of ['flashcards', 'practice_test', 'summary_sheet']) {
    assert.match(TOOLBOX, new RegExp(`id: '${id}'`), `${id} left the toolbox`);
  }
  // Both under the one selection, and the clock above them.
  assert.match(PANEL, /<StudyShelf/);
  assert.match(PANEL, /<StudyToolbox/);
  assert.equal((PANEL.match(/<LectureScopePicker/g) || []).length, 1, 'a second picker is back');
  assert.match(PLANNER, /<StudyTimer variant="strip"/);
});

test('there is no second study surface to drift from it', () => {
  // The shelf and the toolbox are each rendered in exactly one place. A copy
  // is how the Practice tab and Focus Mode ended up with different tools.
  for (const tag of ['<StudyShelf', '<StudyToolbox']) {
    const renderers = files.filter((f) => source(f).includes(tag));
    assert.equal(renderers.length, 1, `${tag} is rendered in ${renderers.length} places: ${renderers}`);
  }
  // The timer is the exception, deliberately: two shapes of one component,
  // driven by one state, on the study page and the project screen.
  const timers = files.filter((f) => source(f).includes('<StudyTimer')).sort();
  assert.deepEqual(timers, ['pages/FocusMode.jsx', 'pages/StudyPlanner.jsx']);
});

// --- no screen asks a question before showing the material -----------------

test('no chooser screen survives, and none has grown back', () => {
  for (const gone of ['ReviewModeChooser', 'StudyModeSelector', 'FocusSessionWizard', 'LecturePickerSheet']) {
    assert.throws(() => read(`../../src/components/${gone}.jsx`), /ENOENT/, `${gone} is back on disk`);
  }
  const used = /(?:import\s+\w+\s+from\s+'[^']*(?:ReviewModeChooser|StudyModeSelector|FocusSessionWizard|LecturePickerSheet)'|<(?:ReviewModeChooser|StudyModeSelector|FocusSessionWizard|LecturePickerSheet)[\s/>])/;
  for (const f of files) assert.doesNotMatch(source(f), used, `${f} still uses one`);
  // And the route they used to gate lands on something.
  assert.match(read('../../src/pages/LectureReview.jsx'), /const mode = searchParams\.get\('mode'\) \|\| 'quiz'/);
});

test('a tool that cannot run says so instead of letting you find out', () => {
  // Greyed with the reason, never hidden and never live-until-tapped.
  assert.match(SHELF, /disabledReason/);
  assert.match(SHELF, /Unlocks with \{lockedTierName\}/);
  assert.match(read('../../src/pages/LectureDetail.jsx'), /handbookGate\.allowed \?/);
  // Every 402 carries a control, not just a sentence.
  const NOTICE = read('../../src/components/monetization/GateNotice.jsx');
  assert.match(NOTICE, /openUpgrade\(\{ source, feature: gate\.feature \}\)/);
});

// --- every entry point carries what it knew --------------------------------

test('the doors compose the scope rather than typing a path', () => {
  // A hand-typed '/study?classId=…' is how a link starts drifting from what
  // the page reads. Everything that knows something builds it.
  assert.match(read('../../src/pages/LectureDetail.jsx'), /studyPath\(\{ tab: 'now', classId: lecture\?\.class_id \|\| '', lectureIds: \[lectureId\] \}\)/);
  assert.match(read('../../src/pages/ClassDetail.jsx'), /studyPath\(\{ tab: 'now', classId \}\)/);
  for (const f of ['components/StudySessionNotifier.jsx', 'components/RebookSessionModal.jsx', 'pages/StudyPlanner.jsx']) {
    assert.match(source(f), /sessionStudyPath\(/, `${f} decides where a session opens by itself`);
  }
});

test('what each door carries reads back as the page will read it', () => {
  assert.deepEqual(readStudyScope(new URLSearchParams(studyPath({ tab: 'now', classId: 'c1', lectureIds: ['l1'] }).split('?')[1])),
    { tab: 'now', classId: 'c1', lectureIds: ['l1'], assignmentId: '', sessionId: '' });
  assert.equal(readStudyScope(new URLSearchParams(sessionStudyPath({ id: 's1' }).split('?')[1])).sessionId, 's1');
  assert.equal(sessionStudyPath({ id: 's1', session_type: 'project' }), '/focus/s1');
});

// --- names, and the last of the dead wood ---------------------------------

test('the tabs are called what they are', () => {
  // "Plan" held a review workflow that was not planning; "Practice" is not
  // what you call a tab with a clock on it.
  assert.match(PLANNER, /\{ value: 'now', label: 'Study now' \}/);
  assert.match(PLANNER, /\{ value: 'schedule', label: 'Schedule' \}/);
  assert.doesNotMatch(PLANNER, /label: 'Practice' \}/);
  assert.doesNotMatch(PLANNER, /label: 'Plan' \}/);
  // The values never changed, so every link ever written still resolves.
  assert.deepEqual(STUDY_TABS, ['now', 'schedule']);
  assert.equal(readStudyScope(new URLSearchParams('tab=practice')).tab, 'now');
  assert.equal(readStudyScope(new URLSearchParams('tab=plan')).tab, 'schedule');
  // And the page opens on the half it is named after.
  assert.equal(readStudyScope(new URLSearchParams('')).tab, 'now');
});

test('the routes that only existed to forward are gone', () => {
  // /study-tools was a page that became a tab in a redesign before this one.
  // Nothing has linked to it since; a redirect nobody follows is a route to
  // keep working forever for no one.
  assert.doesNotMatch(APP, /study-tools/);
  // /planner and /focus stay — those links are in students' history, and the
  // per-phase tests prove the app itself no longer walks through them.
  assert.match(APP, /path="\/planner" element=\{<RedirectPreservingQuery to="\/study" \/>\}/);
  assert.match(APP, /path="\/focus" element=\{<RedirectFocusToStudy \/>\}/);
});

test('the components the teardown orphaned are off disk', () => {
  // ProjectRoadmap was replaced by the roadmap the project screen renders
  // itself; AddStudySessionModal by AddExamOrStudyModal. Neither was rendered
  // anywhere — one was kept alive only by a test that read its markup.
  for (const gone of ['ProjectRoadmap', 'AddStudySessionModal']) {
    assert.throws(() => read(`../../src/components/${gone}.jsx`), /ENOENT/);
    for (const f of files) assert.doesNotMatch(source(f), new RegExp(`\\b${gone}\\b`), `${f} references ${gone}`);
  }
  // OAuthConsentUnavailable LOOKS unreferenced and is not: it is what
  // @/pages/OAuthConsent resolves to in the Cloudflare build, which is the
  // one that ships. Deleting it would break production, not tidy it.
  assert.doesNotThrow(() => read('../../src/pages/OAuthConsentUnavailable.jsx'));
  assert.match(read('../../vite.config.js'), /'@\/pages\/OAuthConsent': fileURLToPath\(new URL\('\.\/src\/pages\/OAuthConsentUnavailable\.jsx'/);
});
