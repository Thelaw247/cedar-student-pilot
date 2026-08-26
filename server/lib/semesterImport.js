const VALID_DAYS = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_TO_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

  let meetingCount = 0;
  const classes = value.classes.map((rawClass) => {
    const item = rawClass && typeof rawClass === 'object' && !Array.isArray(rawClass) ? rawClass : {};
    const name = text(item.name, 200);
    if (!name) throw new TypeError('Every course needs a name.');
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
  return { semester, classes };
}

export async function saveSemesterImport(db, userId, input) {
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
