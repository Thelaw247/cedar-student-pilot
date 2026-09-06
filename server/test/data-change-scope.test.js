import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dataChangeAffects } from '../../src/lib/dataChanged.js';

/**
 * Ticking a to-do reloaded the page it was on.
 *
 * Reported 6 Sep 2026 from a lecture page. The checkbox itself was fine — the
 * write is optimistic and the box flips instantly. What followed was the
 * problem: the write announced "something changed" with no indication of what,
 * every listener in the app answered the only way it could, and the lecture
 * page's answer was loadData() — which sets `loading`, and `loading` renders a
 * full-page spinner over the page the student was reading.
 *
 * Four surfaces refetched everything they own because one checkbox moved.
 */

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
const LIB = read('../../src/lib/dataChanged.js');
const TODOS = read('../../src/hooks/useTodos.js');
const LECTURE = read('../../src/pages/LectureDetail.jsx');
const CLASS = read('../../src/pages/ClassDetail.jsx');
const HOME = read('../../src/pages/Home.jsx');
const RAIL = read('../../src/components/DesktopRail.jsx');
const CLIENT = read('../../src/lib/cedarClient.js');

const evt = (entities) => ({ detail: entities ? { entities } : null });

// A real EventTarget standing in for window, so the two halves — announce and
// subscribe — are exercised together rather than asserted about separately.
globalThis.window = new EventTarget();
const { announceDataChange, onDataChange } = await import('../../src/lib/dataChanged.js');

// ------------------------------------------------------------ the rule

test('a named change reaches only the listeners that read it', () => {
  assert.equal(dataChangeAffects(evt(['Todo']), ['Todo']), true);
  assert.equal(dataChangeAffects(evt(['Todo']), ['Lecture', 'Class', 'Note']), false,
    'the lecture page still hears a to-do being ticked');
  assert.equal(dataChangeAffects(evt(['Todo']), ['Assignment', 'Todo']), true,
    'one entity in common is enough');
});

test('an unnamed change still reaches everyone', () => {
  // Reconnection sync and a finished recording cannot know what moved, so they
  // must keep waking every listener — and an un-migrated caller keeps behaving
  // exactly as it did.
  for (const listener of [undefined, [], ['Lecture'], ['Todo']]) {
    assert.equal(dataChangeAffects(evt(null), listener), true);
    assert.equal(dataChangeAffects({}, listener), true, 'a plain Event has no detail at all');
  }
});

test('a listener that declares nothing hears everything', () => {
  assert.equal(dataChangeAffects(evt(['Todo']), undefined), true);
  assert.equal(dataChangeAffects(evt(['Todo']), []), true);
});

test('the unsubscribe is shaped for a useEffect cleanup', () => {
  assert.match(LIB, /return \(\) => window\.removeEventListener/);
});

// ------------------------------------------------- the reported path

test('a to-do write says it changed to-dos', () => {
  assert.match(TODOS, /announceDataChange\(\['Todo'\]\)/);
  assert.doesNotMatch(TODOS, /dispatchEvent/,
    'still announcing an untyped event, which every page answers with a full refetch');
});

test('the lecture page does not listen for to-dos', () => {
  const sub = LECTURE.match(/onDataChange\([^;]+\)/s);
  assert.ok(sub, 'the lecture page no longer subscribes at all');
  assert.doesNotMatch(sub[0], /'Todo'/,
    'the page refetches itself when the checklist at its own bottom is ticked');
  assert.match(sub[0], /'Lecture'/);
});

test('a background refetch never blanks a page being read', () => {
  // The second half of the fix. Even for a change a page DOES care about — a
  // recording finishing — replacing it with a spinner loses the scroll
  // position and every open section.
  for (const [name, src] of [['LectureDetail', LECTURE], ['ClassDetail', CLASS], ['Home', HOME]]) {
    assert.match(src, /const loadData = useCallback\(async \(\{ quiet = false \} = \{\}\) => \{\s*\n\s*if \(!quiet\) setLoading\(true\);/,
      `${name} still shows its full-page spinner on a background refetch`);
    assert.match(src, /onDataChange\(\(\) => loadData\(\{ quiet: true \}\)/, `${name} refetches loudly`);
  }
});

test('every surface declares what it reads', () => {
  for (const [name, src, expected] of [
    ['LectureDetail', LECTURE, 'Note'],
    ['ClassDetail', CLASS, 'KnowledgeCoverage'],
    ['Home', HOME, 'StudySession'],
    ['DesktopRail', RAIL, 'Assignment'],
  ]) {
    assert.match(src, /onDataChange\(/, `${name} does not use the scoped subscription`);
    assert.ok(src.includes(`'${expected}'`), `${name} does not declare ${expected}, which it reads`);
    assert.doesNotMatch(src, /addEventListener\('cedar-data-changed'/,
      `${name} still has a raw unscoped listener`);
  }
});

test('spending credits moves the balance, not every page', () => {
  assert.match(CLIENT, /announceDataChange\(\['Credits'\]\)/);
  const balance = read('../../src/hooks/useBalance.js');
  assert.match(balance, /onDataChange\(refresh, \['Credits'\]\)/);
  // Generating anything used to make every open page refetch itself.
  assert.doesNotMatch(CLIENT, /dispatchEvent\(new CustomEvent\('cedar-data-changed'\)\)/);
});

test('the events that really do mean "everything" stay broad', () => {
  // A reconnection sync and a finished recording cannot know what moved.
  const offline = read('../../src/components/OfflineIndicator.jsx');
  const recording = read('../../src/recording/RecordingContext.jsx');
  assert.match(offline, /cedar-data-changed/);
  assert.match(recording, /cedar-data-changed/);
});

// ------------------------------------------------ the whole path, live

test('ticking a to-do wakes the to-do list and nothing else', () => {
  const woke = [];
  const off = [
    onDataChange(() => woke.push('todos'), ['Todo']),
    onDataChange(() => woke.push('lecture page'), ['Lecture', 'Class', 'Note']),
    onDataChange(() => woke.push('class page'), ['Lecture', 'Class', 'Assignment', 'KnowledgeCoverage']),
    onDataChange(() => woke.push('home'), ['Semester', 'Class', 'CalendarEvent', 'Assignment', 'StudySession', 'ClassAttendance', 'Lecture']),
    onDataChange(() => woke.push('rail'), ['Assignment', 'Lecture', 'Semester', 'Class']),
    onDataChange(() => woke.push('balance'), ['Credits']),
  ];

  announceDataChange(['Todo']);
  assert.deepEqual(woke, ['todos'], 'a checkbox woke something that does not read to-dos');

  woke.length = 0;
  announceDataChange(['Credits']);
  assert.deepEqual(woke, ['balance']);

  woke.length = 0;
  announceDataChange(['Lecture']);
  assert.deepEqual(woke, ['lecture page', 'class page', 'home', 'rail'],
    'a finished recording must still reach every surface that shows lectures');

  woke.length = 0;
  announceDataChange(); // reconnection sync
  assert.equal(woke.length, 6, 'a broad change has to reach everyone');

  for (const stop of off) stop();
  woke.length = 0;
  announceDataChange(['Todo']);
  assert.deepEqual(woke, [], 'unsubscribing left a listener behind');
});
