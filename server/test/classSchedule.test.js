import test from 'node:test';
import assert from 'node:assert/strict';
import { classesOnDate, getClassMeetingsForDate, getMeetingRoom } from '../../src/lib/classSchedule.js';

const cls = {
  id: 'chem', name: 'Chemistry', class_start_date: '2026-09-01', class_end_date: '2026-12-10',
  meetings: [
    { component: 'Lecture', day: 'Wed', start_time: '09:00', end_time: '10:00', start_date: '2026-09-01', end_date: '2026-12-10' },
    { component: 'Lab', day: 'Wed', start_time: '14:00', end_time: '16:00', start_date: '2026-09-10', end_date: '2026-11-30' },
    { component: 'Lecture', day: 'Wed', specific_date: '2026-10-14', start_time: '11:00', end_time: '12:00', replaces_regular_time: true },
  ],
};

test('returns all recurring components that apply on a concrete date', () => {
  const meetings = getClassMeetingsForDate(cls, '2026-09-16');
  assert.deepEqual(meetings.map(m => m.component), ['Lecture', 'Lab']);
});

test('specific replacement suppresses only the matching component', () => {
  const meetings = getClassMeetingsForDate(cls, '2026-10-14');
  assert.deepEqual(meetings.map(m => [m.component, m.start_time]), [['Lecture', '11:00'], ['Lab', '14:00']]);
});

test('date ranges prevent classes outside their active period', () => {
  assert.equal(getClassMeetingsForDate(cls, '2026-08-26').length, 0);
  assert.equal(getClassMeetingsForDate(cls, '2026-12-16').length, 0);
});

test('legacy schedules remain supported', () => {
  const legacy = { id: 'old', room: 'Legacy 101', days_of_week: ['Mon'], start_time: '08:30', end_time: '09:20' };
  const occurrences = classesOnDate([legacy], '2026-09-07');
  assert.equal(occurrences.length, 1);
  assert.equal(occurrences[0].start_time, '08:30');
  assert.equal(occurrences[0].room, 'Legacy 101');
});

test('rule-based meetings do not inherit another component room', () => {
  const splitLocation = {
    id: 'physics',
    room: 'Physics 131',
    meetings: [
      { component: 'Lecture', day: 'Tue', start_time: '13:00', end_time: '14:20' },
      { component: 'Lab', day: 'Tue', start_time: '08:30', end_time: '11:20', room: 'Physics 131' },
    ],
  };

  assert.equal(getMeetingRoom(splitLocation, splitLocation.meetings[0]), '');
  assert.equal(getMeetingRoom(splitLocation, splitLocation.meetings[1]), 'Physics 131');

  const occurrences = classesOnDate([splitLocation], '2026-09-08');
  assert.deepEqual(occurrences.map(o => [o.component, o.room]), [
    ['Lab', 'Physics 131'],
    ['Lecture', ''],
  ]);
});
