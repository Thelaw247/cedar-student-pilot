import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * The app's own modals are hand-rolled: a fixed backdrop that closes on a
 * click, around a panel. To a screen reader that panel was a run of loose
 * text and buttons with no name and no edge, and a keyboard had no way out
 * of it at all — only a pointer could reach the backdrop.
 *
 * Each panel now says it is a modal dialog, is named by its own heading, and
 * closes on Escape through one shared hook. Every piece is an attribute or a
 * call that a later edit could drop without anything else failing, so they
 * are pinned here.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

// DeadlineForm holds DeadlineModal, the shell every add-a-deadline surface uses.
const MODALS = [
  'AddEventModal',
  'AddExamOrStudyModal',
  'AssignmentEditModal',
  'DeadlineForm',
  'EditClassModal',
  'ProjectAssignmentModal',
  'RebookSessionModal',
  'ShortcutsHelp',
].map((name) => [name, read(`../../src/components/${name}.jsx`)]);

test('every backdrop-closed panel is a modal dialog', () => {
  for (const [name, src] of MODALS) {
    // sheet-overlay: the keyboard-aware sheets (hooks/useOnScreenKeyboard.js).
    const backdrops = (src.match(/className="(?:sheet-overlay )?fixed inset-0 [^"]*" onClick=/g) || []).length;
    const dialogs = (src.match(/role="dialog" aria-modal="true" aria-labelledby=\{/g) || []).length;
    assert.ok(backdrops > 0, `${name}: the backdrop moved`);
    assert.equal(dialogs, backdrops, `${name}: ${backdrops} backdrops but ${dialogs} dialog panels`);
  }
});

test('every aria-labelledby names an element that is there', () => {
  // An id that resolves to nothing leaves the dialog (or field) unnamed, and
  // nothing on screen looks any different.
  for (const [name, src] of MODALS) {
    const refs = [...src.matchAll(/aria-labelledby=\{(`[^`]*`|\w+)\}/g)].map((m) => m[1]);
    assert.ok(refs.length > 0, `${name}: nothing is labelled by reference`);
    for (const ref of refs) {
      assert.ok(src.includes(` id={${ref}}`), `${name}: aria-labelledby={${ref}} points at no element`);
    }
  }
});

test('Escape closes each dialog, through the one shared hook', () => {
  for (const [name, src] of MODALS) {
    assert.match(src, /import \{ useEscapeKey \} from '@\/hooks\/useEscapeKey';/, `${name}: no Escape`);
    const dialogs = (src.match(/role="dialog"/g) || []).length;
    const calls = (src.match(/useEscapeKey\(/g) || []).length;
    assert.equal(calls, dialogs, `${name}: ${dialogs} dialogs but ${calls} Escape handlers`);
  }
  // Its three views are each their own modal; the chooser only listens while
  // it is the one on screen, or a single Escape would close twice.
  const [, chooser] = MODALS.find(([name]) => name === 'AddExamOrStudyModal');
  assert.match(chooser, /useEscapeKey\(onClose, !mode\)/);
});

test('the hook leaves alone an Escape that something inside the dialog used', () => {
  // Radix popovers and selects dismiss on Escape and call preventDefault. Without
  // this check, closing a dropdown inside a modal closed the modal too.
  const HOOK = read('../../src/hooks/useEscapeKey.js');
  assert.match(HOOK, /e\.key === 'Escape' && !e\.defaultPrevented/);
  assert.match(HOOK, /window\.addEventListener\('keydown', onKey\)/);
  assert.match(HOOK, /return \(\) => window\.removeEventListener\('keydown', onKey\)/);
});

test('backing out of an inline delete with Escape leaves the dialog around it open', () => {
  // DeleteXButton sits inside AssignmentEditModal. Its Escape is marked as
  // handled, so the modal's hook skips it, and the keyboard goes back to the ✕.
  const X = read('../../src/components/DeleteXButton.jsx');
  assert.match(X, /if \(e\.key === 'Escape'\) \{ e\.preventDefault\(\); backOut\(\); \}/);
  assert.match(X, /xRef\.current\?\.focus\(\)/);
  assert.match(X, /role="alert"/, 'a failed delete is not announced');
});
