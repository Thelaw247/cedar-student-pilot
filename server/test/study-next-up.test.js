import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nextUpFor, reviewedOn, daysBetween, daysLeftLabel, sittingDayLabel } from '../../src/lib/studyNextUp.js';
import { scopeSummary, windowCount } from '../../src/lib/studyShelf.js';
import { formatShortDate } from '../../shared/time.js';

/**
 * The study page, redesigned around the reason to study (5 Oct 2026).
 *
 * The page opened on a class picker, a list of checkboxes and five tiles of
 * equal weight, with the exam that brought the student there on the other
 * tab. It now leads with what is next for the class on screen (the deadline,
 * how much of it is reviewed, the sitting they booked), makes the quiz the
 * one tile that leads, writes the selection onto the tools that use it, and
 * says on each lecture when it was last reviewed. Every number on it is read
 * off rows the page already loads; nothing is invented to fill a gap.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PLANNER = read('../../src/pages/StudyPlanner.jsx');
const PANEL = read('../../src/components/PracticePanel.jsx');
const CARD = read('../../src/components/StudyNextUp.jsx');
const SHELF = read('../../src/components/StudyShelf.jsx');
const TOOLBOX = read('../../src/components/StudyToolbox.jsx');
const PICKER = read('../../src/components/LectureScopePicker.jsx');

const today = '2026-10-05';
const lectures = [
  { id: 'l1', class_id: 'c1', date: '2026-09-08' },
  { id: 'l2', class_id: 'c1', date: '2026-09-13' },
  { id: 'l3', class_id: 'c1', date: '2026-09-20' },
  { id: 'l4', class_id: 'c1', date: '2026-10-02' },
];
const midterm = { id: 'a1', class_id: 'c1', title: 'Midterm 1', type: 'exam', due_date: '2026-10-20', status: 'active', coverage_scope: 'cumulative' };
const coverage = [{ class_id: 'c1', lecture_id: 'l1', last_reviewed_date: '2026-09-22' }, { class_id: 'c1', lecture_id: 'l9', last_reviewed_date: '2026-09-01' }];

// --- what is next, decided from rows -------------------------------------

test('no deadline and no sitting means no card, not an empty one', () => {
  assert.equal(nextUpFor({ classId: 'c1', deadlines: [], sessions: [], lectures, coverage, today }), null);
  assert.equal(nextUpFor({ classId: '', deadlines: [midterm], sessions: [], lectures, coverage, today }), null);
  // Rows still loading are not "no rows".
  assert.equal(nextUpFor({ classId: 'c1', deadlines: null, sessions: null, lectures, coverage: null, today }), null);
});

test('the soonest upcoming deadline of this class leads, resolved ones and other classes do not', () => {
  const deadlines = [
    { ...midterm, id: 'later', due_date: '2026-11-01' },
    { ...midterm, id: 'done', due_date: '2026-10-06', status: 'completed' },
    { ...midterm, id: 'gone', due_date: '2026-10-01' },
    { ...midterm, id: 'other', class_id: 'c2', due_date: '2026-10-06' },
    midterm,
  ];
  const next = nextUpFor({ classId: 'c1', deadlines, sessions: [], lectures, coverage, today });
  assert.equal(next.deadline.id, 'a1');
  assert.equal(next.daysLeft, 15);
});

test('progress counts reviewed lectures by the same rule as the coverage checklist', () => {
  const next = nextUpFor({ classId: 'c1', deadlines: [midterm], sessions: [], lectures, coverage, today });
  assert.deepEqual(next.progress, { total: 4, done: 1, notReviewedIds: ['l2', 'l3', 'l4'] });
  // A row with no last_reviewed_date is not a review.
  const half = [{ class_id: 'c1', lecture_id: 'l2', proficiency: 50 }];
  assert.equal(nextUpFor({ classId: 'c1', deadlines: [midterm], sessions: [], lectures, coverage: half, today }).progress.done, 0);
});

test('a project gets its date and no bar; unknown coverage gets no bar either', () => {
  const project = { ...midterm, id: 'p1', type: 'project', due_date: '2026-10-09' };
  assert.equal(nextUpFor({ classId: 'c1', deadlines: [project], sessions: [], lectures, coverage, today }).progress, null);
  assert.equal(nextUpFor({ classId: 'c1', deadlines: [midterm], sessions: [], lectures, coverage: null, today }).progress, null);
  // A deadline that covers no lectures (a problem set) has nothing to tick.
  const pset = { ...midterm, id: 's1', type: 'assignment', coverage_scope: 'none' };
  assert.equal(nextUpFor({ classId: 'c1', deadlines: [pset], sessions: [], lectures, coverage, today }).progress, null);
});

test('the next booked sitting is the soonest scheduled one for this class, never a project or the past', () => {
  const sessions = [
    { id: 's-past', class_id: 'c1', status: 'scheduled', scheduled_date: '2026-10-04', scheduled_time: '19:00' },
    { id: 's-done', class_id: 'c1', status: 'completed', scheduled_date: '2026-10-06', scheduled_time: '09:00' },
    { id: 's-proj', class_id: 'c1', status: 'scheduled', scheduled_date: '2026-10-05', scheduled_time: '08:00', session_type: 'project' },
    { id: 's-late', class_id: 'c1', status: 'scheduled', scheduled_date: '2026-10-06', scheduled_time: '18:00' },
    { id: 's-soon', class_id: 'c1', status: 'scheduled', scheduled_date: '2026-10-06', scheduled_time: '17:30' },
    { id: 's-other', class_id: 'c2', status: 'scheduled', scheduled_date: '2026-10-05', scheduled_time: '10:00' },
  ];
  const next = nextUpFor({ classId: 'c1', deadlines: [], sessions, lectures, coverage, today });
  assert.equal(next.deadline, null);
  assert.equal(next.session.id, 's-soon');
});

test('the small words are the right ones', () => {
  assert.equal(daysBetween('2026-10-05', '2026-10-20'), 15);
  assert.equal(daysLeftLabel(0), 'today');
  assert.equal(daysLeftLabel(1), 'tomorrow');
  assert.equal(daysLeftLabel(15), 'in 15 days');
  assert.equal(daysLeftLabel(21), 'in 3 weeks');
  assert.equal(sittingDayLabel('2026-10-05', today, formatShortDate), 'Today');
  assert.equal(sittingDayLabel('2026-10-06', today, formatShortDate), 'Tomorrow');
  assert.equal(sittingDayLabel('2026-10-08', today, formatShortDate), 'Thu, Oct 8');
  assert.equal(reviewedOn(coverage).get('l1'), '2026-09-22');
  assert.equal(reviewedOn(null).size, 0);
});

// --- the selection, written on the tools that use it ----------------------

test('the quiz tile says what it will run on, and the by-date tiles say how many', () => {
  assert.equal(scopeSummary({ lectureIds: ['a', 'b', 'c', 'd', 'e'], wholeClass: true, lectureCount: 5 }), 'On all 5 lectures');
  assert.equal(scopeSummary({ lectureIds: ['a', 'b'], wholeClass: false, lectureCount: 5 }), 'On 2 of 5 lectures');
  assert.equal(scopeSummary({ lectureIds: ['a'], wholeClass: true, lectureCount: 1 }), 'On the only lecture so far');
  assert.equal(scopeSummary({ lectureIds: [], wholeClass: false, lectureCount: 5 }), null, 'nothing selected has a reason, not a count');
  const ready = { date: '2026-10-03', transcript: 'x' };
  const processing = { date: '2026-10-04' };
  assert.equal(windowCount([ready, processing, { date: '2026-09-01', transcript: 'x' }], '2026-09-28', '2026-10-05'), 1);
  assert.equal(windowCount(null, '2026-09-28', '2026-10-05'), null, 'unknown lectures keep the general wording');
  assert.match(SHELF, /meta=\{onQuiz\}/);
  assert.match(SHELF, /counted\(weekCount, 'from the past 7 days', 'Everything from the past 7 days'\)/);
});

test('one tile leads: Quiz me is full width and tinted, the other two are a pair under it', () => {
  const quizAt = SHELF.indexOf('title="Quiz me"');
  const pairAt = SHELF.indexOf('<div className="grid grid-cols-2 gap-3 mb-6">');
  assert.ok(quizAt > 0 && pairAt > quizAt, 'the pair must come after the hero');
  assert.match(SHELF.slice(0, quizAt), /hero\s/, 'Quiz me is the hero tile');
  assert.match(SHELF, /Find out what stuck, question by question, in teaching order/);
  // The hero keeps every state the other tiles have: a lock stays pressable,
  // a reason stays readable, and the width never changes between them.
  const tile = SHELF.slice(SHELF.indexOf('function Tile('));
  assert.equal((tile.match(/Unlocks with \{lockedTierName\}\. Tap to upgrade/g) || []).length, 2);
  assert.equal((tile.match(/\{disabledReason\}/g) || []).length, 2);
  // Side-by-side tiles are pinned to the top, so the shorter one does not
  // float to the middle of its box.
  assert.match(tile, /'flex flex-col items-start text-left p-4 rounded-xl'/);
});

// --- the card, and how it reaches the picker ------------------------------

test('the page hands the panel the rows it already loaded, and the card reads them', () => {
  assert.match(PLANNER, /deadlines=\{loading \? null : deadlineAssignments\}/);
  assert.match(PLANNER, /sessions=\{loading \? null : upcoming\}/);
  assert.match(PLANNER, /coverage=\{loading \? null : coverage\}/);
  assert.match(PANEL, /<StudyNextUp/);
  assert.doesNotMatch(CARD, /base44/, 'the card fetches data of its own');
  // First in the panel: the reason to study comes before the tools.
  const cardAt = PANEL.indexOf('<StudyNextUp');
  const pickerAt = PANEL.indexOf('<LectureScopePicker');
  assert.ok(cardAt > 0 && cardAt < pickerAt, 'the card must sit above the picker');
  // And its one action writes the picker's selection the way the picker does.
  assert.match(PANEL, /const next = ids\.length >= lectures\.length \? \[\] : ids;/);
  assert.match(CARD, /Select the \{left\} not reviewed yet/);
  assert.match(CARD, /onClick=\{\(\) => studyThis\(session\)\}/);
  assert.match(CARD, /role="progressbar"/);
});

test('each lecture row says when it was last reviewed, and a long list folds its start', () => {
  assert.match(PANEL, /reviewedOn=\{reviewed\}/);
  assert.match(PICKER, /Reviewed \{formatShortDate\(reviewedDate\)\}/);
  assert.match(PICKER, /const SHOW_LATEST = 8;/);
  assert.match(PICKER, /Show the \{hiddenCount\} earlier lecture/);
  assert.doesNotMatch(PICKER, /max-h-64 overflow-y-auto/, 'the scroll box inside the page is back');
  // A lecture picked by name is never folded away behind the count.
  assert.match(PICKER, /const folded = !showAll && lectures\.length > SHOW_LATEST && !pickedEarlier;/);
  // The class line under the picker is numbers: how many, from when, how many reviewed.
  assert.match(PANEL, /\{reviewedCount !== null && ` · \$\{reviewedCount\} reviewed`\}/);
});

test('the makers are one group with one button, and a finished run ends on its facts', () => {
  assert.match(TOOLBOX, /role="radiogroup" aria-label="What to make"/);
  assert.match(TOOLBOX, /role="radio" aria-checked=\{on\}/);
  assert.match(TOOLBOX, /Make \{chosenLabel\}/);
  assert.match(TOOLBOX, /Reading \{madeFrom \|\| sources\}…/);
  assert.match(TOOLBOX, /hasSources \? `From \$\{sources\}` : 'Select at least one lecture above'/);
  assert.match(TOOLBOX, /export function madeLine\(/);
  assert.match(TOOLBOX, /Shown here only, so copy what you want to keep/, 'the summary sheet is not stored; the student is told');
  assert.match(TOOLBOX, /setMadeFrom\(describeSources\(sourceCount, fileCount\)\);/, 'the finished line describes the run, not the next selection');
});
