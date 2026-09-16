import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { visibleWeekColumns, weekDates } from '../../src/lib/eventSchedule.js';
import { getClassMeetingsForDate } from '../../src/lib/classSchedule.js';

/**
 * "tim.li doesn't have a Monday on his calendar." He did — seven of his
 * thirteen courses meet on Mondays. What he was looking at was the week of
 * 7 September 2026, whose Monday was Labour Day, and the week grid trimmed
 * empty days off both ends of the week. Mid-week holes had already been fixed
 * (a Saturday between a Friday class and a Sunday event stayed); the front of
 * the week had not.
 */

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const byDay = (populated) => Object.fromEntries(DAYS.map((d) => [d, populated.includes(d) ? ['x'] : []]));

test('Monday to Friday are always drawn', () => {
  assert.deepEqual(visibleWeekColumns(DAYS, byDay(['Tue', 'Wed', 'Thu', 'Fri'])), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  assert.deepEqual(visibleWeekColumns(DAYS, byDay(['Wed'])), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  assert.deepEqual(visibleWeekColumns(DAYS, byDay([])), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
});

test('the weekend joins only when something is on it, and never with a hole', () => {
  assert.deepEqual(visibleWeekColumns(DAYS, byDay(['Mon', 'Sat'])), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  // A Sunday event keeps an empty Saturday between Friday and itself.
  assert.deepEqual(visibleWeekColumns(DAYS, byDay(['Fri', 'Sun'])), DAYS);
  assert.deepEqual(visibleWeekColumns(DAYS, byDay(['Sun'])), DAYS);
});

test('the Labour Day week renders a Monday with the real schedule helpers', () => {
  // Two of his real Monday rules: MATH 133 starts on the 14th, GE 140 meets
  // on specific Mondays. Neither applies on Monday 7 Sep. The grid used to
  // conclude the week began on Tuesday.
  const classes = [
    { id: 'math133', meetings: [
      { day: 'Mon', start_time: '09:30', end_time: '10:50', start_date: '2026-09-14', end_date: '2026-10-05' },
      { day: 'Wed', start_time: '09:30', end_time: '10:50', start_date: '2026-09-02', end_date: '2026-09-23' },
      { day: 'Fri', start_time: '09:30', end_time: '10:50', start_date: '2026-09-04', end_date: '2026-11-27' } ] },
    { id: 'ge140', meetings: [
      { day: 'Mon', start_time: '13:30', end_time: '16:20', specific_date: '2026-09-14' },
      { day: 'Tue', start_time: '10:00', end_time: '11:20', specific_date: '2026-09-01' } ] },
  ];
  const weekOf = (sundayOrAny) => {
    const dates = weekDates(sundayOrAny, 0);
    const items = Object.fromEntries(DAYS.map((d, i) => [d, classes.flatMap((c) => getClassMeetingsForDate(c, dates[i]))]));
    return { dates, columns: visibleWeekColumns(DAYS, items), items };
  };

  // Sunday 13 Sep, the evening he set up: the week on screen is 7–13 Sep.
  const setupWeek = weekOf(new Date(2026, 8, 13, 19, 40));
  assert.equal(setupWeek.dates[0], '2026-09-07');
  assert.equal(setupWeek.items.Mon.length, 0, 'Labour Day has nothing on it');
  assert.deepEqual(setupWeek.columns, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);

  // The following week his Monday classes begin, and the column is the same one.
  const nextWeek = weekOf(new Date(2026, 8, 14, 9, 0));
  assert.equal(nextWeek.items.Mon.length, 2);
  assert.deepEqual(nextWeek.columns, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
});

test('the calendar draws its columns through the helper', () => {
  const CAL = fs.readFileSync(new URL('../../src/components/WeeklyCalendar.jsx', import.meta.url), 'utf8');
  assert.match(CAL, /const displayDays = visibleWeekColumns\(DAYS, itemsByDay\);/);
  assert.doesNotMatch(CAL, /Math\.min\(\.\.\.activeIdx\)/, 'the front-trimming expression is back');
});
