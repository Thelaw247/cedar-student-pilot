import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sessionEndTime, formatCountdown } from '../../shared/time.js';

/**
 * Today, To-do and the lecture page, refined around the student (6 Oct 2026).
 *
 * Today leads with what is next and how the day is going, and only then
 * asks its questions, in the tone each deserves. The To-do page reads as a
 * list with progress, not a form over a list. The lecture page plays its
 * recording with the app's own controls: speed, skips, every part of a long
 * lecture, the position kept, a URL refreshed when it expires. Each of
 * these is pinned here so a refactor cannot quietly undo it.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const HOME = read('../../src/pages/Home.jsx');
const RING = read('../../src/components/DailyProgressRing.jsx');
const SIGNALS = read('../../src/components/TodayIntelligenceCard.jsx');
const RISK = read('../../src/components/RiskIndicatorCard.jsx');
const GAP = read('../../src/components/EmptyTimeSuggestion.jsx');
const UP_NEXT = read('../../src/components/UpNextCard.jsx');
const TODOS = read('../../src/pages/Todos.jsx');
const LECTURE = read('../../src/pages/LectureDetail.jsx');
const PLAYER = read('../../src/components/lecture/RecordingPlayer.jsx');
const SETTINGS = read('../../src/lib/settings.js');
const CSS = read('../../src/index.css');
const R2 = read('../lib/r2.js');

// --- Today ----------------------------------------------------------------

test('Today reads in the day\'s order: what is next, how it is going, then what needs an answer, then the schedule', () => {
  const at = (s) => HOME.indexOf(s);
  const order = ['<UpNextCard', '<DailyProgressRing', '<AutoPrintPrompt', '<AttendancePrompt', '<DetectedDeadlines', '<TodayIntelligenceCard', '<RiskIndicatorCard', '<Timeline', '<ReviewPrompt'];
  for (let i = 1; i < order.length; i++) {
    assert.ok(at(order[i - 1]) > 0 && at(order[i - 1]) < at(order[i]), `${order[i - 1]} must come before ${order[i]}`);
  }
});

test('the ring shows the day\'s size before anything is done, never 0%, and says "nearly there" past half', () => {
  assert.match(RING, /const notStarted = totalItems > 0 && doneItems === 0;/);
  assert.match(RING, /`\$\{totalItems\} thing\$\{totalItems === 1 \? '' : 's'\} today`/);
  assert.match(RING, /done, nearly there`/);
  assert.doesNotMatch(RING, /keep going/);
  assert.match(RING, /notStarted \? "Today's plan" : "Today's progress"/);
});

test('a slipped session and a quiet week are amber nudges; red is kept for the course going wrong', () => {
  assert.doesNotMatch(SIGNALS, /rose-\d|bg-rose|text-rose|border-rose/);
  assert.doesNotMatch(SIGNALS, /UpNextCard/, 'the hero moved to the page');
  assert.match(SIGNALS, /study session slipped|study sessions slipped/);
  assert.match(RISK, /const NUDGE_TYPES = new Set\(\['low_engagement', 'no_study_planned', 'behind_schedule'\]\);/);
  assert.match(RISK, /if \(NUDGE_TYPES\.has\(risk\.type\)\) return severityColors\.medium;/);
  assert.match(RISK, /const colorClass = toneFor\(risk\);/);
});

test('a booked session has an end on the timeline, free time reads as hours and minutes, and the next class says "in"', () => {
  assert.match(HOME, /endTime: sessionEndTime\(s\),/);
  assert.equal(sessionEndTime({ scheduled_time: '17:30', duration_minutes: 50 }), '18:20');
  assert.equal(sessionEndTime({ scheduled_time: '23:50', duration_minutes: 30 }), '23:59');
  assert.equal(sessionEndTime({ scheduled_time: '17:30' }), null);
  assert.equal(sessionEndTime({ scheduled_time: '17:30', duration_minutes: 0 }), null);
  assert.match(GAP, /\{formatCountdown\(gapMinutes\)\} free/);
  assert.equal(formatCountdown(130), '2h 10m');
  assert.match(UP_NEXT, /minutesUntil < 1 \? 'now' : `in \$\{formatCountdown\(minutesUntil\)\}`/);
});

// --- To-do ----------------------------------------------------------------

test('the To-do page has no eyebrow chips, shows the kind only when it says something, and does not repeat the group\'s own day', () => {
  assert.doesNotMatch(TODOS, /uppercase tracking-wide/);
  assert.match(TODOS, /const kindLabel = todo\.kind && todo\.kind !== 'task' \? TODO_KIND_LABEL\[todo\.kind\] : null;/);
  assert.match(TODOS, /hideDate=\{g\.key === 'today'\}/);
  assert.match(TODOS, /\(!hideDate \|\| !todo\.due_date\) && \(/);
});

test('adding a to-do is one line, the date is a tap, and the class follows the filter', () => {
  assert.match(TODOS, /\[\['none', 'No date'\], \['today', 'Today'\], \['tomorrow', 'Tomorrow'\], \['pick', 'Pick a date'\]\]/);
  assert.match(TODOS, /const draftDue = dueMode === 'today' \? today : dueMode === 'tomorrow' \? addDays\(today, 1\) : dueMode === 'pick' \? draft\.due_date : '';/);
  assert.match(TODOS, /const draftClass = draft\.class_id != null \? draft\.class_id : \(classFilter !== 'all' \? classFilter : ''\);/);
  // Progress only once there is some: no 0% bar over an untouched list.
  assert.match(TODOS, /\{done\.length > 0 && \(/);
  assert.match(TODOS, /role="progressbar"/);
});

// --- the lecture page -----------------------------------------------------

test('the recording plays through the app\'s own player, not the browser\'s', () => {
  assert.doesNotMatch(LECTURE, /<audio controls/);
  assert.match(LECTURE, /<RecordingPlayer/);
  assert.match(LECTURE, /refs=\{recordingRefs\}/);
  assert.match(LECTURE, /lecture\.recording_parts\.length > 1 \? lecture\.recording_parts : \[lecture\.recording_url\]/, 'every part of a long recording is handed over');
  assert.match(LECTURE, /const resolvePlaybackUrl = useCallback\(\(ref\) => base44\.files\.getDownloadUrl\(ref\), \[\]\);/);
  // Deleting is the last thing on the page.
  assert.ok(LECTURE.indexOf('Delete this lecture') > LECTURE.indexOf('title="My notes"'), 'delete must sit after the notes');
  assert.match(LECTURE, /Keep it/);
});

test('the player: speed kept in Settings, position kept per lecture, parts in order, a fresh URL on error, the length forced out of a webm', () => {
  assert.match(PLAYER, /const RATES = \[1, 1\.25, 1\.5, 1\.75, 2\];/);
  assert.match(PLAYER, /setSetting\('playbackRate', next\);/);
  assert.match(SETTINGS, /playbackRate: 1,/);
  assert.match(PLAYER, /const POSITION_KEY = \(id\) => `cedar-play-pos-\$\{id\}`;/);
  assert.match(PLAYER, /writePosition\(lectureId, a\.currentTime, part\);/);
  assert.match(PLAYER, /clearPosition\(lectureId\);/, 'a finished recording starts over next time');
  assert.match(PLAYER, /if \(part < parts - 1\) \{/, 'the next part follows the last');
  assert.match(PLAYER, /const FAR_PAST_THE_END = 1e101;/);
  assert.match(PLAYER, /a\.currentTime = FAR_PAST_THE_END;/);
  assert.match(PLAYER, /if \(retriesRef\.current < 2 && src\) \{/, 'an expired URL is fetched again before giving up');
  assert.match(PLAYER, /navigator\.mediaSession\.setActionHandler\('seekbackward'/);
  assert.match(PLAYER, /preload="metadata"/);
  assert.match(PLAYER, /aria-label="Now playing"/, 'the mini bar follows the student down the transcript');
  // Space on a focused button is the button's; the card toggles on its own space.
  assert.match(PLAYER, /if \(tag === 'BUTTON' \|\| tag === 'INPUT'\) return;/);
  assert.match(CSS, /\.recording-scrubber::-webkit-slider-thumb/);
  assert.match(CSS, /\.recording-scrubber::-moz-range-progress/);
});

test('a recording\'s signed URL lasts a lecture, and only a recording\'s', () => {
  assert.match(R2, /export const PLAYBACK_EXPIRY_SECONDS = 4 \* 60 \* 60;/);
  assert.match(R2, /return \/\\\/recordings\\\/\/\.test\(String\(key \|\| ''\)\) \? PLAYBACK_EXPIRY_SECONDS : DOWNLOAD_EXPIRY_SECONDS;/);
  assert.match(R2, /const expiresIn = downloadExpiryFor\(key\);/);
});
