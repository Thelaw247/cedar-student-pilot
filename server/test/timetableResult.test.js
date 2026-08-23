import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIsoDate, normalizeTimetableClasses } from '../lib/timetableResult.js';

test('normalizeIsoDate accepts real ISO calendar dates only', () => {
  assert.equal(normalizeIsoDate('2026-09-03'), '2026-09-03');
  assert.equal(normalizeIsoDate('2026-02-30'), '');
  assert.equal(normalizeIsoDate('September 3, 2026'), '');
});

test('normalizeTimetableClasses preserves each class date range', () => {
  const [lecture, lab] = normalizeTimetableClasses([
    {
      name: 'CHEM 112 Lecture',
      instructor: 'Dr. Cedar',
      room: 'ARTS 101',
      days_of_week: ['Mon', 'Wed', 'Mon', 'Invalid'],
      start_time: '09:30',
      end_time: '10:20',
      class_start_date: '2026-09-03',
      class_end_date: '2026-12-04',
      ignored: 'not returned',
    },
    {
      name: 'CHEM 112 Lab',
      class_start_date: '2026-09-10',
      class_end_date: '2026-11-26',
    },
  ]);

  assert.equal(lecture.class_start_date, '2026-09-03');
  assert.equal(lecture.class_end_date, '2026-12-04');
  assert.deepEqual(lecture.days_of_week, ['Mon', 'Wed']);
  assert.equal('ignored' in lecture, false);
  assert.equal(lab.class_start_date, '2026-09-10');
  assert.equal(lab.class_end_date, '2026-11-26');
});

test('normalizeTimetableClasses clears inverted AI date ranges', () => {
  const [result] = normalizeTimetableClasses([{
    name: 'Impossible Range',
    class_start_date: '2026-12-01',
    class_end_date: '2026-09-01',
  }]);

  assert.equal(result.class_start_date, '');
  assert.equal(result.class_end_date, '');
});
