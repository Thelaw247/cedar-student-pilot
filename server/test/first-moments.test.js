import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * The first week, from the student's side (4 Oct 2026).
 *
 * The landing page already leans on the research that decides a sign-up
 * (see the conversion write-up). Inside the app the same moments were bare:
 * a lecture came back finished and the island vanished without a word; the
 * first finished lecture looked like the fiftieth; a brand-new account
 * opened the study page onto five greyed tiles; Today asked the browser for
 * notification permission before it had shown anything; and a student who
 * imported deadlines on day one met a red "not much study time" card. Each
 * of these is a sentence or a card now, and each is pinned here so a
 * refactor cannot quietly take it away.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const ISLAND = read('../../src/recording/RecordingIsland.jsx');
const LECTURE = read('../../src/pages/LectureDetail.jsx');
const PANEL = read('../../src/components/PracticePanel.jsx');
const UP_NEXT = read('../../src/components/UpNextCard.jsx');
const TODAY_CARD = read('../../src/components/TodayIntelligenceCard.jsx');
const HOME = read('../../src/pages/Home.jsx');
const SETTINGS = read('../../src/pages/Settings.jsx');
const DEFAULTS = read('../../src/lib/settings.js');
const RISK = read('../../server/routes/detectAcademicRisk.js');
const ONBOARDING = read('../../src/pages/Onboarding.jsx');
const SHEET = read('../../src/components/monetization/UpgradeSheet.jsx');

test('a finished lecture is announced, with a way to open it, unless its page is already on screen', () => {
  assert.match(ISLAND, /title: 'Your lecture is ready'/);
  assert.match(ISLAND, /navigate\(`\/lectures\/\$\{lectureId\}`\)/, 'the toast must open the lecture');
  assert.match(ISLAND, /if \(window\.location\.pathname === `\/lectures\/\$\{lectureId\}`\) return;/, 'no toast over the page that is already showing it');
  // The session still closes the instant processing finishes.
  assert.match(ISLAND, /rec\.dismissReview\(\);/);
});

test('the first finished lecture gets its card once, and only when it is the first', () => {
  assert.match(LECTURE, /const FIRST_LECTURE_KEY = 'cedar-first-lecture-seen';/);
  assert.match(LECTURE, /Lecture\.filter\(\{ status: LECTURE_COMPLETE \}, undefined, 2\)/, 'two rows are enough to know whether this is the only one');
  assert.match(LECTURE, /finished\.length === 1 && finished\[0\]\.id === lectureId/);
  assert.match(LECTURE, /Your first lecture is in\./);
  assert.match(LECTURE, /it all stays yours/);
  // Shown once per browser: the flag is written when the card appears.
  assert.match(LECTURE, /localStorage\.setItem\(FIRST_LECTURE_KEY, '1'\)/);
});

test('a study page with nothing to study shows one next step, not five greyed tiles', () => {
  assert.match(PANEL, /\(!selectedClass \|\| lectures\.length === 0\) \?/);
  assert.match(PANEL, /title="Add your classes first"/);
  assert.match(PANEL, /Nothing to study in \$\{/);
  assert.match(PANEL, /navigate\(`\/classes\/\$\{selectedClass\}\?record=1`\)/, 'the next step is the record button on that class');
});

test('the browser is asked for notification permission from Settings, never on arrival', () => {
  assert.doesNotMatch(UP_NEXT, /requestPermission/, 'Today asks for permission on its own again');
  assert.match(UP_NEXT, /export function classChangeNotificationsOn\(\)/);
  assert.match(UP_NEXT, /getSetting\('classChangeNotifications'\) !== false/, 'a browser that said yes before the switch existed keeps its notifications');
  assert.match(SETTINGS, /function ClassChangeToggle\(\)/);
  assert.match(SETTINGS, /await Notification\.requestPermission\(\)/);
  assert.match(SETTINGS, /label="Between classes"/);
  assert.match(DEFAULTS, /classChangeNotifications: null,/);
});

test('the first week says when to press Record, and never scolds a new account for not studying', () => {
  assert.match(UP_NEXT, /Press Record when it starts\. The notes make themselves\./);
  assert.match(UP_NEXT, /firstWeek = false/);
  // The hero is rendered by the page itself, first on it (6 Oct 2026); the
  // signals card no longer carries it.
  assert.match(HOME, /<UpNextCard todayClasses=\{todayClasses\} events=\{todayEvents\} firstWeek=\{lectures\.length === 0\} \/>/);
  assert.doesNotMatch(TODAY_CARD, /UpNextCard/);
  assert.match(RISK, /const semesterAgeDays = /);
  assert.match(RISK, /totalStudyMinutes < 60 && allAssignments\.length > 0 && semesterAgeDays >= 7/);
});

test('the welcome flow counts the account as a step already done, and the plan sheet says what stays', () => {
  assert.match(ONBOARDING, /aria-label=\{`Step \$\{step \+ 2\} of \$\{STEPS \+ 1\}: account made`\}/);
  assert.match(ONBOARDING, /Array\.from\(\{ length: STEPS \+ 1 \}/);
  assert.match(SHEET, /Everything you already made stays yours · Secure checkout by Stripe/);
  // No exclamation marks in the day's own messages.
  assert.doesNotMatch(UP_NEXT, /done for today!/);
});
