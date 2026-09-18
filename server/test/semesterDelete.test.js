import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { deleteSemester, SemesterNotFound, recordingRefsFor } from '../lib/semesterDelete.js';

/**
 * A semester delete has to do three things in one transaction and one order:
 * remove the recordings and files from storage, remove the row (the cascade
 * takes the classes, lectures, materials, attendance and the rest), and — if
 * that was the active semester — hand the "active" flag to the newest
 * remaining one. The import and the delete share a per-user advisory lock so
 * neither can interleave with the other.
 */

const SEM = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

function fakeDatabase({ semester = { id: SEM, name: 'Fall 2026', is_active: true }, classes = ['c1', 'c2'], lectures = [], materials = [], remaining = null, failDelete = false } = {}) {
  const statements = [];
  const params = [];
  return {
    statements,
    params,
    async query(query, values = []) {
      const sql = String(query).trim().replace(/\s+/g, ' ');
      statements.push(sql.split(' ').slice(0, 3).join(' ').toLowerCase());
      params.push(values);
      if (sql.startsWith('select id, name, is_active from semesters')) return { rows: semester ? [semester] : [] };
      if (sql.startsWith('select id from classes')) return { rows: classes.map((id) => ({ id })) };
      if (sql.startsWith('select id, recording_url, recording_parts from lectures')) return { rows: lectures };
      if (sql.startsWith('select storage_ref from lecture_materials')) return { rows: materials };
      if (sql.startsWith('delete from semesters')) {
        if (failDelete) throw new Error('simulated delete failure');
        return { rows: [] };
      }
      if (sql.startsWith('select id, name from semesters')) return { rows: remaining ? [remaining] : [] };
      return { rows: [] };
    },
  };
}

const deleter = () => {
  const calls = [];
  return { calls, deleteObjects: async (refs) => { calls.push(refs); } };
};

test('objects go first, then the row, and the cascade is trusted with the rest', async () => {
  const db = fakeDatabase({
    lectures: [
      { id: 'l1', recording_url: 'r2://b/users/u/recordings/a.webm', recording_parts: ['r2://b/users/u/recordings/a.webm', 'r2://b/users/u/recordings/a-2.webm'] },
      { id: 'l2', recording_url: null, recording_parts: [] },
    ],
    materials: [{ storage_ref: 'r2://b/users/u/materials/slides.pdf' }, { storage_ref: null }],
  });
  const { calls, deleteObjects } = deleter();
  const result = await deleteSemester(db, 'user-1', SEM, { deleteObjects });

  // Every ref once: recording_url duplicates the first part.
  assert.deepEqual(calls, [[
    'r2://b/users/u/recordings/a.webm', 'r2://b/users/u/recordings/a-2.webm', 'r2://b/users/u/materials/slides.pdf',
  ]]);
  const deleteAt = db.statements.indexOf('delete from semesters');
  assert.ok(deleteAt > -1, 'the semester row was never deleted');
  // No class, lecture or material delete statement: the foreign keys cascade.
  assert.equal(db.statements.filter((s) => s.startsWith('delete from')).length, 1);
  assert.equal(db.statements.at(-1), 'commit');
  assert.equal(db.statements[0], 'begin');
  assert.ok(db.statements.some((s) => s.startsWith('select pg_advisory_xact_lock')), 'the per-user lock the import takes is missing');
  assert.deepEqual(result.counts, { classes: 2, lectures: 2, materials: 2, objects: 3 });
  assert.deepEqual(result.deleted, { id: SEM, name: 'Fall 2026', was_active: true });
});

test('materials are collected by class, so class-level files are not stranded', async () => {
  const db = fakeDatabase();
  await deleteSemester(db, 'user-1', SEM, deleter());
  const materialsQuery = db.params[db.statements.indexOf('select storage_ref from')];
  assert.deepEqual(materialsQuery, [['c1', 'c2'], 'user-1']);
});

test('deleting the active semester activates the newest remaining one, in the same transaction', async () => {
  const db = fakeDatabase({ remaining: { id: OTHER, name: 'Winter 2027' } });
  const result = await deleteSemester(db, 'user-1', SEM, deleter());
  const activateAt = db.statements.indexOf('update semesters set');
  const commitAt = db.statements.indexOf('commit');
  assert.ok(activateAt > -1 && activateAt < commitAt, 'activation must happen before commit');
  assert.deepEqual(db.params[activateAt], [OTHER, 'user-1']);
  assert.deepEqual(result.activated, { id: OTHER, name: 'Winter 2027' });
});

test('deleting an inactive semester leaves the active one alone', async () => {
  const db = fakeDatabase({ semester: { id: SEM, name: 'Old', is_active: false }, remaining: { id: OTHER, name: 'Current' } });
  const result = await deleteSemester(db, 'user-1', SEM, deleter());
  assert.equal(db.statements.includes('update semesters set'), false);
  assert.equal(result.activated, null);
});

test('the last semester can go; nothing is activated and the app shows its setup screen', async () => {
  const db = fakeDatabase({ remaining: null });
  const result = await deleteSemester(db, 'user-1', SEM, deleter());
  assert.equal(result.activated, null);
  assert.equal(db.statements.at(-1), 'commit');
});

test('another user\'s semester, or a malformed id, is not found and nothing is touched', async () => {
  const db = fakeDatabase({ semester: null });
  const { calls, deleteObjects } = deleter();
  await assert.rejects(deleteSemester(db, 'user-2', SEM, { deleteObjects }), SemesterNotFound);
  assert.deepEqual(calls, []);
  assert.equal(db.statements.at(-1), 'rollback');
  // A non-uuid never reaches the database at all.
  const untouched = fakeDatabase();
  await assert.rejects(deleteSemester(untouched, 'user-1', 'not-a-uuid', { deleteObjects }), SemesterNotFound);
  assert.deepEqual(untouched.statements, []);
});

test('a failure after the objects are gone rolls the rows back', async () => {
  const db = fakeDatabase({ failDelete: true });
  await assert.rejects(deleteSemester(db, 'user-1', SEM, deleter()), /simulated delete failure/);
  assert.equal(db.statements.at(-1), 'rollback');
  assert.equal(db.statements.includes('commit'), false);
});

test('recording refs are deduplicated and null-safe', () => {
  assert.deepEqual(recordingRefsFor({ recording_url: 'a', recording_parts: ['a', 'b', null] }), ['a', 'b']);
  assert.deepEqual(recordingRefsFor({ recording_url: null, recording_parts: null }), []);
  assert.deepEqual(recordingRefsFor(null), []);
});

test('the route and the client both use it, and the client never deletes a semester directly', () => {
  const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
  const route = read('../routes/deleteAcademicData.js');
  assert.match(route, /router\.delete\('\/semesters\/:id', requireAuth/);
  assert.match(route, /deleteObjects: \(refs\) => deleteRecordingRefs\(req\.user\.id, refs\)/);
  assert.match(route, /error instanceof SemesterNotFound\) return res\.status\(404\)/);
  // The class route collects materials by class now too, for the same reason.
  const classRoute = route.slice(route.indexOf("router.delete('/classes/:id'"), route.indexOf("router.delete('/semesters/:id'"));
  assert.match(classRoute, /from lecture_materials where class_id = \$1 and user_id = \$2/);

  const client = read('../../src/lib/cedarClient.js');
  assert.match(client, /entityName === 'Lecture' \|\| entityName === 'Class' \|\| entityName === 'Semester'/);

  const section = read('../../src/components/SemestersSection.jsx');
  assert.match(section, /base44\.entities\.Semester\.delete\(semester\.id\)/);
  assert.match(section, /Delete permanently/);
  assert.match(section, /This can’t be undone/);
  assert.doesNotMatch(section, /showUndo|UndoToast/, 'there is no undo for a delete that removes storage objects');
  const settings = read('../../src/pages/Settings.jsx');
  assert.match(settings, /<SettingsSection icon=\{CalendarRange\} title="Semesters">/);
});
