import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { saveSemesterImport, validateSemesterImport, ClassNotInSemester } from '../lib/semesterImport.js';
import { SemesterNotFound } from '../lib/semesterDelete.js';
import { courseIdentity, matchParsedToExisting, unclaimedClasses } from '../../shared/courseIdentity.js';

/**
 * Re-importing a timetable used to mean a brand-new active semester with
 * none of the student's lectures in it, and the old one hidden. Now the same
 * endpoint, given `semester_id`, updates that semester in place: courses
 * matched to existing classes are updated by id, new ones inserted, and
 * nothing is deleted — so class ids, and everything hanging off them, are
 * stable across an import.
 */

const SEM = '11111111-1111-4111-8111-111111111111';
const CHEM = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MATH = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const STRANGER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const lecture = { component: 'Lecture', day: 'Mon', start_time: '09:00', end_time: '10:00', start_date: '2026-09-01', end_date: '2026-12-01' };
const base = () => ({
  semester_id: SEM,
  semester: { name: 'Fall 2026', start_date: '2026-09-01', end_date: '2026-12-18' },
  classes: [
    { id: CHEM, course_code: 'CHEM 112', name: 'General Chemistry', color: '#123abc', meetings: [lecture] },
    { course_code: 'PHYS 115', name: 'Physics', meetings: [{ ...lecture, day: 'Tue' }] },
  ],
});

function fakeDatabase({ semester = { id: SEM }, owned = [CHEM, MATH], failUpdate = false } = {}) {
  const statements = [];
  const params = [];
  return {
    statements,
    params,
    async query(query, values = []) {
      const sql = String(query).trim().replace(/\s+/g, ' ');
      statements.push(sql.split(' ').slice(0, 3).join(' ').toLowerCase());
      params.push(values);
      if (sql.startsWith('select id from semesters')) return { rows: semester ? [semester] : [] };
      if (sql.startsWith('select id from classes')) return { rows: owned.map((id) => ({ id })) };
      if (sql.startsWith('update semesters set')) return { rows: [{ id: SEM, name: values[0], start_date: values[1], end_date: values[2] }] };
      if (sql.startsWith('insert into semesters')) return { rows: [{ id: 'new-semester', name: values[1] }] };
      if (sql.startsWith('update classes set')) {
        if (failUpdate) throw new Error('simulated update failure');
        return { rows: [{ id: values[0], name: values[3] }] };
      }
      if (sql.startsWith('insert into classes')) return { rows: [{ id: 'new-1', name: values[3] }] };
      return { rows: [] };
    },
  };
}

test('validation passes the target semester and per-class ids through, and only then', () => {
  const input = validateSemesterImport(base());
  assert.equal(input.semester_id, SEM);
  assert.equal(input.classes[0].id, CHEM);
  assert.equal('id' in input.classes[1], false, 'a new course must not carry an id key');
  // A first import: no semester_id anywhere in the validated shape.
  const first = validateSemesterImport({ semester: base().semester, classes: [base().classes[1]] });
  assert.equal('semester_id' in first, false);
  assert.equal('id' in first.classes[0], false);
  // Malformed references are rejected before the database is involved.
  assert.throws(() => validateSemesterImport({ ...base(), semester_id: 'nope' }), /not valid/);
  assert.throws(() => validateSemesterImport({ ...base(), classes: [{ ...base().classes[0], id: '12' }] }), /not valid/);
  const orphanId = { semester: base().semester, classes: [base().classes[0]] };
  assert.throws(() => validateSemesterImport(orphanId), /no semester is being updated/);
});

test('matched classes are updated by id, new ones inserted, nothing deleted, is_active untouched', async () => {
  const db = fakeDatabase();
  const result = await saveSemesterImport(db, 'user-1', validateSemesterImport(base()));
  assert.equal(result.updated_count, 1);
  assert.equal(result.created_count, 1);
  assert.equal(result.class_count, 2);
  assert.equal(db.statements.filter((s) => s.startsWith('delete')).length, 0, 'a re-import deleted something');
  assert.equal(db.statements.filter((s) => s === 'insert into semesters').length, 0, 'a re-import created a semester');
  assert.equal(db.statements.includes('update classes set'), true);
  assert.equal(db.statements.includes('insert into classes'), true);
  // The update names the row by id AND by owner AND by semester.
  const updateAt = db.statements.indexOf('update classes set');
  assert.equal(db.params[updateAt][0], CHEM);
  assert.equal(db.params[updateAt][1], 'user-1');
  assert.equal(db.params[updateAt].at(-1), SEM);
  // Nothing about which semester is active is touched.
  const semesterUpdate = db.params[db.statements.indexOf('update semesters set')];
  assert.deepEqual(semesterUpdate, ['Fall 2026', '2026-09-01', '2026-12-18', SEM, 'user-1']);
  assert.ok(!String(db.statements).includes('is_active'));
  assert.equal(db.statements[0], 'begin');
  assert.ok(db.statements.some((s) => s.startsWith('select pg_advisory_xact_lock')), 'the per-user lock the first import takes is missing');
  assert.equal(db.statements.at(-1), 'commit');
});

test('a class id from outside the semester fails whole, before any write', async () => {
  const db = fakeDatabase({ owned: [MATH] });
  await assert.rejects(saveSemesterImport(db, 'user-1', validateSemesterImport(base())), ClassNotInSemester);
  assert.equal(db.statements.some((s) => s.startsWith('update') || s.startsWith('insert')), false);
  assert.equal(db.statements.at(-1), 'rollback');
  const stranger = fakeDatabase();
  const input = validateSemesterImport({ ...base(), classes: [{ ...base().classes[0], id: STRANGER }] });
  await assert.rejects(saveSemesterImport(stranger, 'user-1', input), ClassNotInSemester);
});

test('another user\'s semester is not found and nothing is written', async () => {
  const db = fakeDatabase({ semester: null });
  await assert.rejects(saveSemesterImport(db, 'user-2', validateSemesterImport(base())), SemesterNotFound);
  assert.equal(db.statements.some((s) => s.startsWith('update') || s.startsWith('insert')), false);
  assert.equal(db.statements.at(-1), 'rollback');
});

test('a failure midway rolls the whole re-import back', async () => {
  const db = fakeDatabase({ failUpdate: true });
  await assert.rejects(saveSemesterImport(db, 'user-1', validateSemesterImport(base())), /simulated update failure/);
  assert.equal(db.statements.at(-1), 'rollback');
  assert.equal(db.statements.includes('commit'), false);
});

test('a first import is untouched by any of this', async () => {
  // Byte-for-byte the statements the first-import tests already pin: no
  // ownership lookups, no update path, the semester deactivation and insert.
  const db = fakeDatabase();
  const first = { semester: base().semester, classes: [base().classes[1]] };
  await saveSemesterImport(db, 'user-1', validateSemesterImport(first));
  assert.deepEqual(db.statements.filter((s) => !s.startsWith('set local')), [
    'begin', 'select pg_advisory_xact_lock(hashtextextended($1::text, 0))', 'update semesters set', 'insert into semesters', 'insert into classes', 'commit',
  ]);
});

test('courses match by code first, then by name with component words stripped', () => {
  assert.equal(courseIdentity({ course_code: 'chem 112' }), 'code:CHEM112');
  assert.equal(courseIdentity({ course_code: 'CHEM-112', name: 'whatever' }), 'code:CHEM112');
  assert.equal(courseIdentity({ course_code: '', name: 'Biology 101 Lecture' }), courseIdentity({ name: 'biology 101 Lab L01' }));
  assert.equal(courseIdentity({ name: '' }), '');
  assert.equal(courseIdentity(null), '');
});

test('matching claims each existing class once, keeps its colour, and never invents an id', () => {
  const existing = [
    { id: CHEM, course_code: 'CHEM 112', name: 'General Chemistry', color: '#111111' },
    { id: MATH, course_code: '', name: 'Engineering Math', color: '#222222' },
  ];
  const parsed = [
    { course_code: 'chem-112', name: 'Gen Chem', color: '#ff0000' },
    { course_code: 'chem 112', name: 'Gen Chem (split)', color: '#ff0000' },
    { course_code: '', name: 'Engineering Math Lab L02' },
    { course_code: 'PHYS 115', name: 'Physics' },
  ];
  const matched = matchParsedToExisting(parsed, existing);
  assert.equal(matched[0].id, CHEM);
  assert.equal(matched[0].color, '#111111', 'the student\'s colour survives the import');
  assert.equal(matched[1].id, undefined, 'a second course with the same identity is new');
  assert.equal(matched[2].id, MATH);
  assert.equal(matched[3].id, undefined);
  assert.deepEqual(unclaimedClasses(matched, existing), []);
  // Drop the CHEM card from the upload: CHEM is kept, not deleted.
  assert.deepEqual(unclaimedClasses(matched.slice(2), existing).map((c) => c.id), [CHEM]);
  // Parsed courses that already carry an id are left alone.
  assert.equal(matchParsedToExisting([{ id: 'keep-me', course_code: 'CHEM 112' }], existing)[0].id, 'keep-me');
});

test('the parser merges rows by the same shared identity', () => {
  const parser = fs.readFileSync(new URL('../lib/timetableResult.js', import.meta.url), 'utf8');
  assert.match(parser, /import \{ courseIdentity, normalizeCourseCode \} from '\.\.\/\.\.\/shared\/courseIdentity\.js';/);
  assert.doesNotMatch(parser, /function courseIdentity/, 'the parser has grown its own copy again');
});

test('the setup screen sends semester_id and ids only in update mode, and never deletes', () => {
  const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
  const SETUP = read('../../src/pages/SemesterSetup.jsx');
  assert.match(SETUP, /const updatingSemesterId = searchParams\.get\('semester'\) \|\| null;/);
  assert.match(SETUP, /\.\.\.\(updatingSemesterId \? \{ semester_id: updatingSemesterId \} : \{\}\),/);
  assert.match(SETUP, /\.\.\.\(updatingSemesterId && id \? \{ id \} : \{\}\),/);
  assert.match(SETUP, /matchParsedToExisting\(classes, existingClasses\)/);
  assert.match(SETUP, /unclaimedClasses\(parsedClasses, existingClasses\)/);
  assert.match(SETUP, /Not in this timetable — kept as they are/);
  assert.doesNotMatch(SETUP, /Class\.delete|Semester\.delete/, 'the setup screen deletes something');
  // A split-off course is new: it must not carry the source's id.
  assert.match(SETUP, /const \{ id: _existingId, \.\.\.withoutId \} = source;/);
  // Pages that read the semester refresh after either kind of import.
  assert.match(SETUP, /announceDataChange\(\['Semester', 'Class'\]\)/);
  const CLASSES = read('../../src/pages/Classes.jsx');
  assert.match(CLASSES, /\/setup\?semester=\$\{encodeURIComponent\(activeSemester\.id\)\}/);
  assert.match(CLASSES, /Update from a new timetable/);
  const ROUTE = read('../routes/createSemesterImport.js');
  assert.match(ROUTE, /error instanceof SemesterNotFound\) return res\.status\(404\)/);
  assert.match(ROUTE, /error instanceof ClassNotInSemester\) return res\.status\(409\)/);
});
