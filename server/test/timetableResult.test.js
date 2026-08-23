import test from 'node:test';
import assert from 'node:assert/strict';
import { consolidateTimetableClasses, normalizeCourseCode, normalizeIsoDate } from '../lib/timetableResult.js';

test('normalizes dates and course codes', () => {
  assert.equal(normalizeIsoDate('2026-09-03'), '2026-09-03');
  assert.equal(normalizeIsoDate('2026-02-30'), '');
  assert.equal(normalizeCourseCode(' chem  112 '), 'CHEM 112');
});

test('merges repeated course rows while preserving different schedule rules', () => {
  const classes = consolidateTimetableClasses([
    { course_code: 'CHEM 112', name: 'General Chemistry', component: 'Lecture', instructor: 'Dr. Cedar', room: 'ARTS 101', days_of_week: ['Mon', 'Wed'], start_time: '09:30', end_time: '10:20', start_date: '2026-09-03', end_date: '2026-12-04' },
    { course_code: 'chem 112', name: 'General Chemistry', component: 'Lab', room: 'THORV 120', days_of_week: ['Thu'], start_time: '14:30', end_time: '17:20', start_date: '2026-09-10', end_date: '2026-11-26' },
  ]);
  assert.equal(classes.length, 1);
  assert.equal(classes[0].course_code, 'CHEM 112');
  assert.equal(classes[0].source_entry_count, 2);
  assert.equal(classes[0].meetings.length, 3);
  assert.deepEqual(classes[0].days_of_week, ['Mon', 'Wed', 'Thu']);
  assert.equal(classes[0].class_start_date, '2026-09-03');
  assert.equal(classes[0].class_end_date, '2026-12-04');
});

test('deduplicates exact repeated schedule rows', () => {
  const row = { course_code: 'MATH 110', name: 'Calculus I', component: 'Lecture', days_of_week: ['Tue'], start_time: '10:00', end_time: '11:20', start_date: '2026-09-01', end_date: '2026-12-01' };
  const [cls] = consolidateTimetableClasses([row, row, { ...row }]);
  assert.equal(cls.source_entry_count, 3);
  assert.equal(cls.meetings.length, 1);
});

test('keeps identical names separate when course codes differ', () => {
  const classes = consolidateTimetableClasses([
    { course_code: 'ENGR 101', name: 'Special Topics', days_of_week: ['Mon'] },
    { course_code: 'ENGR 201', name: 'Special Topics', days_of_week: ['Tue'] },
  ]);
  assert.equal(classes.length, 2);
});

test('uses normalized names as fallback when no course code exists', () => {
  const classes = consolidateTimetableClasses([
    { name: 'Design Studio Lecture A1', days_of_week: ['Mon'], start_time: '09:00' },
    { name: 'Design Studio Lab B2', days_of_week: ['Fri'], start_time: '13:00' },
  ]);
  assert.equal(classes.length, 1);
  assert.equal(classes[0].meetings.length, 2);
});

test('preserves one-off replacement dates as explicit rules', () => {
  const [cls] = consolidateTimetableClasses([{
    course_code: 'PHYS 115', name: 'Physics', component: 'Lecture', specific_dates: ['2026-10-14', 'bad-date'],
    start_time: '11:30', end_time: '12:20', replaces_regular_time: true,
  }]);
  assert.equal(cls.meetings.length, 1);
  assert.deepEqual(cls.meetings[0], { component: 'Lecture', start_time: '11:30', end_time: '12:20', day: 'Wed', specific_date: '2026-10-14', replaces_regular_time: true });
});
