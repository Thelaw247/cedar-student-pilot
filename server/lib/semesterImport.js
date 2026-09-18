import { SemesterNotFound } from './semesterDelete.js';

const VALID_DAYS = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_TO_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** A class id in an update that is not one of that semester's classes. */
export class ClassNotInSemester extends Error {
  constructor(id) {
    super('One of the courses in this upload no longer belongs to this semester. Reload and try again.');
    this.name = 'ClassNotInSemester';
    this.classId = id;
  }
}

function text(value, maxLength) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : '';
}

function optionalText(value, maxLength) {
  return text(value, maxLength) || null;
}

function validDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

function assertDate(value, label) {
  if (!validDate(value)) throw new TypeError(`${label} must be a real date in YYYY-MM-DD format.`);
  return value;
}

function dayForDate(value) {
  return DATE_TO_DAY[new Date(`${value}T00:00:00Z`).getUTCDay()];
}

function normalizeMeeting(value, semester, className) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${className} has an invalid schedule entry.`);
  }
  const specificDate = value.specific_date ? assertDate(value.specific_date, `${className} schedule date`) : null;
  const day = text(value.day, 3);
  if (!specificDate && !VALID_DAYS.has(day)) {
    throw new TypeError(`${className} schedule entries need a weekday or a specific date.`);
  }
  const startDate = specificDate ? null : (value.start_date ? assertDate(value.start_date, `${className} start date`) : semester.start_date);
  const endDate = specificDate ? null : (value.end_date ? assertDate(value.end_date, `${className} end date`) : semester.end_date);
  for (const date of [specificDate, startDate, endDate].filter(Boolean)) {
    if (date < semester.start_date || date > semester.end_date) {
      throw new RangeError(`${className} has a schedule date outside the semester range.`);
    }
  }
  if (startDate && endDate && startDate > endDate) {
    throw new RangeError(`${className} has a schedule ending before it starts.`);
  }
  const startTime = value.start_time ? text(value.start_time, 5) : null;
  const endTime = value.end_time ? text(value.end_time, 5) : null;
  if ((startTime && !TIME.test(startTime)) || (endTime && !TIME.test(endTime))) {
    throw new TypeError(`${className} schedule times must use 24-hour HH:MM format.`);
  }
  if ((startTime && !endTime) || (!startTime && endTime) || (startTime && startTime >= endTime)) {
    throw new RangeError(`${className} has a schedule whose end time is not after its start time.`);
  }
  return Object.fromEntries(Object.entries({
    component: optionalText(value.component, 80),
    section: optionalText(value.section, 80),
    day: specificDate ? (VALID_DAYS.has(day) ? day : dayForDate(specificDate)) : day,
    start_time: startTime,
    end_time: endTime,
    start_date: startDate,
    end_date: endDate,
    specific_date: specificDate,
    room: optionalText(value.room, 200),
    instructor: optionalText(value.instructor, 200),
    replaces_regular_time: specificDate && value.replaces_regular_time === true ? true : null,
  }).filter(([, item]) => item !== null));
}

export function validateSemesterImport(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Import data is required.');
  const rawSemester = value.semester;
  if (!rawSemester || typeof rawSemester !== 'object' || Array.isArray(rawSemester)) {
    throw new TypeError('Semester details are required.');
  }
  const semester = {
    name: text(rawSemester.name, 120),
    start_date: assertDate(rawSemester.start_date, 'Semester start date'),
    end_date: assertDate(rawSemester.end_date, 'Semester end date'),
  };
  if (!semester.name) throw new TypeError('Semester name is required.');
  if (semester.start_date > semester.end_date) {
    throw new RangeError('Semester start date must be on or before its end date.');
  }
  if (!Array.isArray(value.classes) || value.classes.length === 0) {
    throw new TypeError('At least one course is required.');
  }
  if (value.classes.length > 100) throw new RangeError('A semester cannot contain more than 100 courses.');

  // Re-import: the semester to update in place, and per class the existing
  // row it replaces. Both optional; a first import carries neither and is
  // validated and saved exactly as before.
  const semesterId = value.semester_id == null || value.semester_id === '' ? null : String(value.semester_id);
  if (semesterId !== null && !UUID.test(semesterId)) throw new TypeError('The semester to update is not valid.');

  let meetingCount = 0;
  const classes = value.classes.map((rawClass) => {
    const item = rawClass && typeof rawClass === 'object' && !Array.isArray(rawClass) ? rawClass : {};
    const name = text(item.name, 200);
    if (!name) throw new TypeError('Every course needs a name.');
    const id = item.id == null || item.id === '' ? null : String(item.id);
    if (id !== null && !UUID.test(id)) throw new TypeError(`${name} refers to a class that is not valid.`);
    if (id !== null && semesterId === null) throw new TypeError(`${name} refers to an existing class, but no semester is being updated.`);
    if (!Array.isArray(item.meetings) || item.meetings.length === 0) {
      throw new TypeError(`${name} needs at least one schedule entry.`);
    }
    meetingCount += item.meetings.length;
    if (meetingCount > 500) throw new RangeError('A semester cannot contain more than 500 schedule entries.');
    const meetings = item.meetings.map((meeting) => normalizeMeeting(meeting, semester, name));
    const days = [...new Set(meetings.map((meeting) => meeting.day).filter(Boolean))];
    const dates = meetings.flatMap((meeting) => [meeting.start_date, meeting.end_date, meeting.specific_date]).filter(Boolean).sort();
    const earliest = meetings.filter((meeting) => meeting.start_time).sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
    return {
      ...(id !== null ? { id } : {}),
      course_code: optionalText(item.course_code, 40)?.toUpperCase() || null,
      name,
      instructor: optionalText(item.instructor, 200),
      room: optionalText(item.room, 200),
      color: /^#[0-9a-f]{6}$/i.test(item.color || '') ? item.color : '#3B82F6',
      days_of_week: days,
      start_time: earliest?.start_time || null,
      end_time: earliest?.end_time || null,
      class_start_date: dates[0] || semester.start_date,
      class_end_date: dates.at(-1) || semester.end_date,
      meetings,
    };
  });
  return semesterId === null ? { semester, classes } : { semester, classes, semester_id: semesterId };
}

export async function saveSemesterImport(db, userId, input) {
  if (input.semester_id) return updateSemesterImport(db, userId, input);
  await db.query('begin');
  try {
    await db.query("set local lock_timeout = '5s'");
    await db.query("set local statement_timeout = '30s'");
    // Keeps active-semester switching deterministic if the same user submits
    // from two tabs at once, without blocking imports for other users.
    await db.query('select pg_advisory_xact_lock(hashtextextended($1::text, 0))', [userId]);
    await db.query(
      'update semesters set is_active = false where user_id = $1 and is_active = true',
      [userId],
    );
    const semester = (await db.query(
      `insert into semesters (user_id, name, start_date, end_date, is_active)
       values ($1, $2, $3, $4, true)
       returning *`,
      [userId, input.semester.name, input.semester.start_date, input.semester.end_date],
    )).rows[0];

    const classes = [];
    for (const item of input.classes) {
      const created = (await db.query(
        `insert into classes (
           user_id, semester_id, course_code, name, instructor, room, color,
           days_of_week, start_time, end_time, class_start_date, class_end_date, meetings
         ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
         returning *`,
        [
          userId, semester.id, item.course_code, item.name, item.instructor, item.room, item.color,
          item.days_of_week, item.start_time, item.end_time, item.class_start_date, item.class_end_date,
          JSON.stringify(item.meetings),
        ],
      )).rows[0];
      classes.push(created);
    }
    await db.query('commit');
    return { semester, classes, class_count: classes.length };
  } catch (error) {
    await db.query('rollback').catch(() => {});
    throw error;
  }
}

const CLASS_UPDATE_SQL = `update classes set
     course_code = $3, name = $4, instructor = $5, room = $6, color = $7,
     days_of_week = $8, start_time = $9, end_time = $10, class_start_date = $11, class_end_date = $12,
     meetings = $13::jsonb
   where id = $1 and user_id = $2 and semester_id = $14
   returning *`;

/**
 * Re-import into an existing semester. Same transaction and per-user lock as
 * a first import, with one difference in what happens to the rows: classes
 * that carry an `id` are UPDATED in place, classes without one are inserted,
 * and nothing is ever deleted. Class ids are therefore stable, so every
 * lecture, recording, attendance row, flashcard, material and study session
 * stays attached to the course it belongs to. A student who imported a
 * corrected timetable used to get a brand-new semester with none of that in
 * it, and the old one hidden.
 *
 * `is_active` is deliberately not touched: updating a semester's schedule is
 * not a statement about which semester the app should show.
 */
async function updateSemesterImport(db, userId, input) {
  await db.query('begin');
  try {
    await db.query("set local lock_timeout = '5s'");
    await db.query("set local statement_timeout = '30s'");
    await db.query('select pg_advisory_xact_lock(hashtextextended($1::text, 0))', [userId]);

    const existing = (await db.query(
      'select id from semesters where id = $1 and user_id = $2 for update',
      [input.semester_id, userId],
    )).rows[0];
    if (!existing) throw new SemesterNotFound();

    // Every referenced class must be one of this semester's, checked before a
    // single row is written: a stale review screen (a class deleted in another
    // tab) fails whole, not halfway.
    const owned = new Set((await db.query(
      'select id from classes where semester_id = $1 and user_id = $2',
      [input.semester_id, userId],
    )).rows.map((row) => row.id));
    for (const item of input.classes) {
      if (item.id && !owned.has(item.id)) throw new ClassNotInSemester(item.id);
    }

    const semester = (await db.query(
      `update semesters set name = $1, start_date = $2, end_date = $3
       where id = $4 and user_id = $5
       returning *`,
      [input.semester.name, input.semester.start_date, input.semester.end_date, input.semester_id, userId],
    )).rows[0];

    const classes = [];
    let updated = 0;
    let created = 0;
    for (const item of input.classes) {
      const values = [
        item.course_code, item.name, item.instructor, item.room, item.color,
        item.days_of_week, item.start_time, item.end_time, item.class_start_date, item.class_end_date,
        JSON.stringify(item.meetings),
      ];
      if (item.id) {
        const row = (await db.query(CLASS_UPDATE_SQL, [item.id, userId, ...values, semester.id])).rows[0];
        if (!row) throw new ClassNotInSemester(item.id);
        classes.push(row);
        updated += 1;
      } else {
        const row = (await db.query(
          `insert into classes (
             user_id, semester_id, course_code, name, instructor, room, color,
             days_of_week, start_time, end_time, class_start_date, class_end_date, meetings
           ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
           returning *`,
          [userId, semester.id, ...values],
        )).rows[0];
        classes.push(row);
        created += 1;
      }
    }
    await db.query('commit');
    return { semester, classes, class_count: classes.length, updated_count: updated, created_count: created };
  } catch (error) {
    await db.query('rollback').catch(() => {});
    throw error;
  }
}
