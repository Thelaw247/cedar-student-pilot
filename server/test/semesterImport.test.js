import test from 'node:test';
import assert from 'node:assert/strict';
import { saveSemesterImport, validateSemesterImport } from '../lib/semesterImport.js';

const valid = {
  semester: { name: 'Fall 2026', start_date: '2026-09-01', end_date: '2026-12-18' },
  classes: [{
    course_code: 'chem 112', name: 'General Chemistry', color: '#123abc',
    meetings: [
      { component: 'Lecture', day: 'Mon', start_time: '09:00', end_time: '10:00', start_date: '2026-09-01', end_date: '2026-12-01' },
      { component: 'Lab', day: 'Thu', start_time: '14:00', end_time: '16:00', start_date: '2026-09-10', end_date: '2026-11-26' },
    ],
  }],
};

test('validates and derives a multi-pattern class for atomic insertion', () => {
  const result = validateSemesterImport(valid);
  assert.equal(result.semester.name, 'Fall 2026');
  assert.equal(result.classes[0].course_code, 'CHEM 112');
  assert.deepEqual(result.classes[0].days_of_week, ['Mon', 'Thu']);
  assert.equal(result.classes[0].class_start_date, '2026-09-01');
  assert.equal(result.classes[0].class_end_date, '2026-12-01');
  assert.equal(result.classes[0].meetings.length, 2);
});

test('defaults missing recurring ranges to the semester boundary', () => {
  const input = structuredClone(valid);
  delete input.classes[0].meetings[0].start_date;
  delete input.classes[0].meetings[0].end_date;
  const result = validateSemesterImport(input);
  assert.equal(result.classes[0].meetings[0].start_date, '2026-09-01');
  assert.equal(result.classes[0].meetings[0].end_date, '2026-12-18');
});

test('rejects schedule dates outside the semester', () => {
  const input = structuredClone(valid);
  input.classes[0].meetings[0].end_date = '2027-01-01';
  assert.throws(() => validateSemesterImport(input), /outside the semester range/);
});

test('rejects invalid time ranges and excessive payloads', () => {
  const input = structuredClone(valid);
  input.classes[0].meetings[0].end_time = '08:59';
  assert.throws(() => validateSemesterImport(input), /end time is not after/);
  assert.throws(() => validateSemesterImport({ ...valid, classes: Array(101).fill(valid.classes[0]) }), /100 courses/);
});

test('preserves an irregular one-off date without a recurring range', () => {
  const input = structuredClone(valid);
  input.classes[0].meetings = [{ specific_date: '2026-10-14', day: 'Wed', start_time: '11:00', end_time: '12:00', replaces_regular_time: true }];
  const result = validateSemesterImport(input);
  assert.deepEqual(result.classes[0].meetings[0], {
    day: 'Wed', start_time: '11:00', end_time: '12:00', specific_date: '2026-10-14', replaces_regular_time: true,
  });
});

function fakeDatabase({ failClass = false } = {}) {
  const statements = [];
  return {
    statements,
    async query(query, params = []) {
      const sql = String(query);
      statements.push(sql.trim().split(/\s+/).slice(0, 3).join(' ').toLowerCase());
      if (sql.includes('insert into semesters')) return { rows: [{ id: 'semester-1', name: params[1] }] };
      if (sql.includes('insert into classes')) {
        if (failClass) throw new Error('simulated class insert failure');
        return { rows: [{ id: 'class-1', name: params[3] }] };
      }
      return { rows: [] };
    },
  };
}

test('commits the semester and all classes as one unit', async () => {
  const db = fakeDatabase();
  const result = await saveSemesterImport(db, 'user-1', validateSemesterImport(valid));
  assert.equal(result.class_count, 1);
  assert.equal(db.statements.at(-1), 'commit');
  assert.equal(db.statements.includes('rollback'), false);
});

test('rolls back the entire import when any class insert fails', async () => {
  const db = fakeDatabase({ failClass: true });
  await assert.rejects(
    saveSemesterImport(db, 'user-1', validateSemesterImport(valid)),
    /simulated class insert failure/,
  );
  assert.equal(db.statements.at(-1), 'rollback');
  assert.equal(db.statements.includes('commit'), false);
});
