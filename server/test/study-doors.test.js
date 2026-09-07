import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { studyPath, sessionStudyPath, readStudyScope } from '../../src/lib/studyScope.js';

/**
 * Phase 4 of the navigation teardown: fourteen doors become one per place.
 *
 * The count was the finding. Fourteen controls in the app meant "study this",
 * and each of them knew something — this lecture, this class, this booked
 * session. Most threw it away on the way through: the class page's Focus
 * button opened a picker asking which class, on a page that was already
 * showing you one.
 *
 * Every door now goes to the same place and carries what it knew. The ones
 * that were two names for the same destination are gone rather than renamed —
 * removing beats adding, and a door that leads where another door already
 * leads is not a convenience.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const SRC = new URL('../../src', import.meta.url);
const files = fs.readdirSync(SRC, { recursive: true })
  .filter((f) => String(f).endsWith('.jsx') || String(f).endsWith('.js'));
const source = (f) => read(`../../src/${f}`);

const DETAIL = read('../../src/pages/LectureDetail.jsx');
const CLASS = read('../../src/pages/ClassDetail.jsx');
const RAIL = read('../../src/components/DesktopRail.jsx');
const PLANNER = read('../../src/pages/StudyPlanner.jsx');

// --- the count ------------------------------------------------------------

test('nothing in the app links to the old names any more', () => {
  // /planner and /focus still exist as redirects, for links in students'
  // history and in old emails. Nothing inside the app should need them: a
  // redirect that the app itself relies on is a scope-dropping hop.
  const offenders = [];
  for (const f of files) {
    if (['App.jsx', 'lib/navItems.js', 'lib/studyScope.js'].includes(String(f))) continue;
    const src = source(f);
    // Links and navigations, not prose — several files explain why the old
    // names are gone, and a bare match would fail on the explanation.
    const bad = src.match(/(?:to=\{?["'`][^"'`]*\/(?:planner|focus)\b|navigate\(\s*[`'"][^`'"]*\/(?:planner|focus)\b)/g);
    if (bad) offenders.push(`${f}: ${bad.join(', ')}`);
  }
  // sessionStudyPath is the one place /focus/:id is still produced, because a
  // project session genuinely lives there.
  assert.deepEqual(offenders, []);
});

test('the lecture page has one door to the study page, not three', () => {
  assert.match(DETAIL, /Study this lecture/);
  assert.doesNotMatch(DETAIL, />\s*Practice\s*</, '"Practice" and "Focus" landed on the same screen');
  assert.doesNotMatch(DETAIL, /Focus\s*<\/Link>/);
  // And it carries both halves of what it knows.
  assert.match(DETAIL, /studyPath\(\{ tab: 'now', classId: lecture\?\.class_id \|\| '', lectureIds: \[lectureId\] \}\)/);
});

test('the lecture page names the Scholar wall before the tap', () => {
  assert.match(DETAIL, /useFeatureGate\('handbook'\)/);
  assert.match(DETAIL, /handbookGate\.allowed \?/);
  assert.match(DETAIL, /onClick=\{handbookGate\.lock\}/);
  // And opens the reader in place when it is allowed — it already knows the
  // class and the lecture, so there is nothing to ask.
  assert.match(DETAIL, /<HandbookReader\s+classId=\{lecture\.class_id\}\s+lectureIds=\{\[lectureId\]\}/);
});

test('the class page has one door, not a three-card menu', () => {
  assert.match(CLASS, /Study this class/);
  assert.match(CLASS, /studyPath\(\{ tab: 'now', classId \}\)/);
  // Headings, not prose: the comment above the surviving button explains what
  // the three cards were, and a bare match would fail on its own obituary.
  assert.doesNotMatch(CLASS, /<h3[^>]*>Plan &amp; review<\/h3>/, 'two names for the same page');
  assert.doesNotMatch(CLASS, /<h3[^>]*>Focus session<\/h3>/);
  assert.doesNotMatch(CLASS, /<h3[^>]*>Practice<\/h3>/);
  // The Handbook tab stays: it is a destination, not a chooser.
  assert.match(CLASS, /\{ value: 'handbook', label: 'Handbook' \}/);
});

test('the rail stops offering what the nav item beside it does better', () => {
  assert.doesNotMatch(RAIL, /label: 'Focus session'/);
  assert.match(RAIL, /label: 'Add a class'/, 'the one quick action with no other entry point');
});

// --- a booked session knows where it belongs ------------------------------

test('a session opens where it is actually studied', () => {
  assert.equal(sessionStudyPath({ id: 's1' }), '/study?tab=now&sessionId=s1');
  assert.equal(sessionStudyPath({ id: 's1', session_type: 'study' }), '/study?tab=now&sessionId=s1');
  assert.equal(sessionStudyPath({ id: 's1', session_type: 'review' }), '/study?tab=now&sessionId=s1');
  // A project works through a roadmap step, not a set of lectures.
  assert.equal(sessionStudyPath({ id: 's1', session_type: 'project' }), '/focus/s1');
  // And nothing usable still lands somewhere real.
  assert.equal(sessionStudyPath(null), '/study?tab=now');
  assert.equal(sessionStudyPath({}), '/study?tab=now');
});

test('every caller uses that one decision rather than making its own', () => {
  const callers = files.filter((f) => /sessionStudyPath\(/.test(source(f)) && String(f) !== 'lib/studyScope.js');
  assert.deepEqual(callers.sort(), [
    'components/RebookSessionModal.jsx',
    'components/StudySessionNotifier.jsx',
    'pages/StudyPlanner.jsx',
  ]);
});

test('a project session cannot be adopted onto the lecture shelf', () => {
  // Nothing links it there any more, but a hand-edited URL or an old bookmark
  // can, and adopting it would show a lecture shelf for a session with none.
  assert.match(PLANNER, /if \(s\.session_type === 'project'\) \{ navigate\(sessionStudyPath\(s\), \{ replace: true \}\); return; \}/);
});

// --- what every door carries ---------------------------------------------

test('a door that knew something still knows it on arrival', () => {
  // This is the whole point of phase 1 being first: the scope survives the
  // link. Read each one back the way the study page will.
  const fromLecture = studyPath({ tab: 'now', classId: 'c1', lectureIds: ['l1'] });
  assert.deepEqual(readStudyScope(new URLSearchParams(fromLecture.split('?')[1])), {
    tab: 'now', classId: 'c1', lectureIds: ['l1'], assignmentId: '', sessionId: '',
  });
  const fromClass = studyPath({ tab: 'now', classId: 'c1' });
  assert.deepEqual(readStudyScope(new URLSearchParams(fromClass.split('?')[1])).classId, 'c1');
  const fromSession = sessionStudyPath({ id: 's1' });
  assert.deepEqual(readStudyScope(new URLSearchParams(fromSession.split('?')[1])).sessionId, 's1');
});

test('the risk card sends scheduling to the schedule and studying to the shelf', () => {
  const RISK = read('../../src/components/RiskIndicatorCard.jsx');
  assert.match(RISK, /low_proficiency: \{ label: 'Review weak topics', to: '\/study\?tab=now' \}/);
  for (const key of ['low_engagement', 'no_study_planned', 'behind_schedule']) {
    assert.match(RISK, new RegExp(`${key}: \\{ label: '[^']+', to: '/study\\?tab=schedule' \\}`));
  }
});
