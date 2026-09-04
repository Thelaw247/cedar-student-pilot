import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Findings from a mobile audit run at iPhone-13 width (390px) against a real
 * build. Every one of these was reachable on a desktop and unreachable, or
 * disruptive, on a phone. They are pinned here because each is a one-token
 * class that a later refactor would silently drop.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const INDEX_HTML = read('../../index.html');
const CSS = read('../../src/index.css');

test('the page can be pinch-zoomed, and a focused input does not zoom it', () => {
  // maximum-scale=1 blocks pinch-zoom outright — an accessibility failure iOS
  // ignores anyway. The real cause of the zoom-on-focus jump is a sub-16px
  // font in the field, which the CSS rule below fixes at the source.
  assert.match(INDEX_HTML, /name="viewport"/);
  const viewport = INDEX_HTML.match(/<meta name="viewport"[^>]*>/)[0];
  assert.doesNotMatch(viewport, /maximum-scale/);
  assert.match(INDEX_HTML, /viewport-fit=cover/, 'needed for env(safe-area-inset-*) to resolve');
  assert.match(CSS, /@media \(max-width: 640px\)[\s\S]{0,120}?font-size: 16px;/);
});

test('hover-only controls are visible on a touch screen', () => {
  // opacity-0 + group-hover never resolves without a pointer: the delete
  // controls simply did not exist on a phone.
  assert.match(CSS, /@media \(hover: none\)[\s\S]{0,120}?\.reveal-on-hover[\s\S]{0,60}?opacity: 1 !important;/);
  for (const p of [
    '../../src/components/Timeline.jsx',
    '../../src/components/lecture/LectureTodos.jsx',
    '../../src/pages/Todos.jsx',
  ]) {
    const src = read(p);
    const hoverOnly = src.match(/className="[^"]*opacity-0[^"]*group-hover:opacity-100[^"]*"/g) || [];
    assert.ok(hoverOnly.length > 0, `${p}: the hover-only control moved`);
    for (const cls of hoverOnly) {
      assert.match(cls, /reveal-on-hover/, `${p}: a hover-only control is unreachable on touch`);
    }
  }
});

test('the toast viewport stays inside the screen', () => {
  // `fixed top-0 w-full p-4` is 100vw plus 32px of padding: it measured 16px
  // past the right edge at 390px on every page, and pushed a horizontal
  // scrollbar onto the document.
  const TOAST = read('../../src/components/ui/toast.jsx');
  assert.doesNotMatch(TOAST, /fixed top-0 z-\[100\][^"]*\bw-full\b/);
  assert.equal((TOAST.match(/fixed top-0 z-\[100\][^"]*inset-x-0/g) || []).length, 2);
  // Still pinned bottom-right on desktop, so inset-x-0 must be released there.
  assert.equal((TOAST.match(/sm:left-auto sm:right-0/g) || []).length, 2);
});

test('every modal panel can scroll', () => {
  // A `fixed inset-0` overlay clips its panel. With the keyboard up on a
  // phone there is ~350px of height, so a panel taller than that hid its own
  // submit button with no way to reach it.
  const files = [
    '../../src/components/AddEventModal.jsx',
    '../../src/components/AddExamOrStudyModal.jsx',
    '../../src/components/AddStudySessionModal.jsx',
    '../../src/components/AssignmentEditModal.jsx',
    '../../src/components/AttendancePrompt.jsx',
    '../../src/components/RebookSessionModal.jsx',
    '../../src/components/StudyModeSelector.jsx',
    '../../src/pages/ClassDetail.jsx',
    '../../src/pages/FocusMode.jsx',
  ];
  for (const p of files) {
    const src = read(p);
    const overlays = (src.match(/fixed inset-0 z-50/g) || []).length;
    const scrollable = (src.match(/max-h-\[90dvh\] overflow-y-auto/g) || []).length;
    assert.ok(overlays > 0, `${p}: the modal overlay moved`);
    assert.equal(scrollable, overlays, `${p}: ${overlays} overlays but ${scrollable} scrollable panels`);
  }
  // dvh, not vh: on mobile Safari 90vh is measured against the tallest
  // viewport, so with the URL bar showing it is still taller than the screen.
  for (const p of files) assert.doesNotMatch(read(p), /max-h-\[90vh\]/, `${p}: vh does not account for the URL bar`);
});

test('the undo toast fits a phone and clears the home indicator', () => {
  const UNDO = read('../../src/hooks/useUndo.jsx');
  const shell = UNDO.slice(UNDO.indexOf('export function UndoToast'));
  assert.match(shell, /w-\[calc\(100vw-2rem\)\] max-w-sm/, 'a long message ran off both edges');
  assert.match(shell, /pb-\[env\(safe-area-inset-bottom\)\]/);
  // Padding, not a bottom override, so the desktop lg:bottom-6 still applies.
  assert.match(shell, /bottom-24 lg:bottom-6/);
});

test('the smallest touch targets got taller without moving', () => {
  // 16px tall at 390px wide. Negative margins absorb the added padding, so
  // nothing around them shifts.
  const PICKER = read('../../src/components/LectureScopePicker.jsx');
  assert.equal((PICKER.match(/py-2 -my-2 px-1 -mx-1/g) || []).length, 2);
});
