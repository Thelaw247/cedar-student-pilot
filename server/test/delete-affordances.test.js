import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Opening an exam or a project put two ✕ glyphs in the same header row, eight
 * pixels apart and the same size: a destructive one that deleted the
 * assignment and every session booked for it, and the grey one that closed the
 * modal. Colour was the only thing telling them apart, and the destructive one
 * came first in reading order.
 *
 * Delete now lives at the end of the modal as a labelled button, which is what
 * EditClassModal already did. DeleteXButton itself is unchanged and still
 * correct where it started: a corner ✕ on a card with no close button anywhere
 * near it.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const MODAL = read('../../src/components/AssignmentEditModal.jsx');
const PLANNER = read('../../src/pages/StudyPlanner.jsx');
const TIMELINE = read('../../src/components/Timeline.jsx');
const HOME = read('../../src/pages/Home.jsx');

test('the assignment modal header holds one control, and it closes the modal', () => {
  const header = MODAL.slice(MODAL.indexOf('<div className="flex items-start justify-between mb-1 gap-3">'), MODAL.indexOf('<AutosaveIndicator'));
  assert.ok(header.length > 100, 'the modal header moved');
  assert.doesNotMatch(header, /DeleteXButton/, 'a destructive control is back beside the close button');
  assert.doesNotMatch(header, /Trash2/, 'a destructive control is back beside the close button');
  assert.equal((header.match(/aria-label="Close"/g) || []).length, 1);
});

test('delete is a labelled button at the end of the modal', () => {
  const deleteAt = MODAL.indexOf('Delete this {typeLabel}');
  const headerAt = MODAL.indexOf('aria-label="Close"');
  assert.ok(deleteAt > -1, 'the assignment can no longer be deleted at all');
  assert.ok(deleteAt > headerAt, 'delete must sit far from the close button, not next to it');
  // Still two deliberate actions, and the confirm still names what goes.
  assert.match(MODAL, /confirmingDelete \?/);
  assert.match(MODAL, /Delete permanently/);
  assert.match(MODAL, /scheduled session\$\{sessions\.length !== 1 \? 's' : ''\}/);
  assert.match(MODAL, /This can’t be undone/);
});

test('a failed delete is reported rather than thrown into nothing', () => {
  // It used to `throw e` for DeleteXButton to catch. Nothing catches it now.
  assert.doesNotMatch(MODAL, /throw e; \/\/ DeleteXButton/);
  assert.match(MODAL, /setDeleteError\(/);
  assert.match(MODAL, /\{deleteError && /);
});

test('DeleteXButton keeps the usages it was designed for', () => {
  // Corner ✕ on cards with no competing close button: the planner's two lists
  // and the per-session rows inside the modal.
  assert.match(MODAL, /<DeleteXButton/, 'the per-session ✕ was removed too — it was not the problem');
  assert.match(PLANNER, /<DeleteXButton/);
  assert.equal((PLANNER.match(/<DeleteXButton/g) || []).length, 2);
});

test('a calendar event can actually be deleted, with an undo', () => {
  // handleDeleteEvent existed with undo already wired and was never passed to
  // anything, so events were the one item on the timeline with no way to
  // remove them.
  assert.match(HOME, /onDeleteItem=\{\(item\) => handleDeleteEvent\(item\.id, item\.source\)\}/);
  assert.match(HOME, /showUndo\('Event deleted'/, 'deleting an event must stay undoable');
  assert.match(TIMELINE, /onDeleteItem/);
  // Only events opt in: a class is edited from its class page and a study
  // session from the planner, so neither should sprout a delete here.
  assert.match(HOME, /deletable: true/);
  assert.match(TIMELINE, /!!item\.deletable/);
  const classItems = HOME.slice(HOME.indexOf('...todayClasses.map'), HOME.indexOf('...todayEvents.map'));
  assert.doesNotMatch(classItems, /deletable/);
  const studyItems = HOME.slice(HOME.indexOf('...studySessions.filter'));
  assert.doesNotMatch(studyItems.slice(0, 600), /deletable/);
});

test('the timeline delete never swallows the block it sits on', () => {
  // The block can be a Link; a click on the control must not navigate.
  assert.match(TIMELINE, /e\.preventDefault\(\); e\.stopPropagation\(\); onDeleteItem\(item\)/);
  // Reachable by keyboard, not hover-only.
  assert.match(TIMELINE, /focus-visible:opacity-100/);
  assert.match(TIMELINE, /aria-label=\{`Delete \$\{item\.title\}`\}/);
});
