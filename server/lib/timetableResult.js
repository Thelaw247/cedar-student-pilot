const VALID_DAYS = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
const DAY_ALIASES = new Map([
  ['sun', 'Sun'], ['sunday', 'Sun'], ['mon', 'Mon'], ['monday', 'Mon'],
  ['tue', 'Tue'], ['tues', 'Tue'], ['tuesday', 'Tue'], ['wed', 'Wed'], ['wednesday', 'Wed'],
  ['thu', 'Thu'], ['thur', 'Thu'], ['thurs', 'Thu'], ['thursday', 'Thu'],
  ['fri', 'Fri'], ['friday', 'Fri'], ['sat', 'Sat'], ['saturday', 'Sat'],
]);
const DATE_TO_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function cleanString(value, maxLength = 200) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : '';
}

export function normalizeIsoDate(value) {
  const date = cleanString(value, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return '';
  const [, year, month, day] = match.map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return '';
  return date;
}

function normalizeTime(value) {
  const time = cleanString(value, 5);
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return '';
  const [, hour, minute] = match.map(Number);
  return hour <= 23 && minute <= 59 ? time : '';
}

function normalizeDay(value) {
  const raw = cleanString(value, 12);
  if (VALID_DAYS.has(raw)) return raw;
  return DAY_ALIASES.get(raw.toLowerCase()) || '';
}

export function normalizeCourseCode(value) {
  return cleanString(value, 40).toUpperCase().replace(/[–—]/g, '-').replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ');
}

function courseIdentity(entry) {
  if (entry.course_code) return `code:${entry.course_code.replace(/[^A-Z0-9]/g, '')}`;
  const normalizedName = entry.name.toLowerCase()
    .replace(/\b(lecture|lect|lab|laboratory|tutorial|seminar|section|sec)\b\s*[a-z0-9-]*/gi, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim();
  return normalizedName ? `name:${normalizedName}` : '';
}

function dateDay(date) {
  return DATE_TO_DAY[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

function normalizeEntry(raw) {
  const item = raw && typeof raw === 'object' ? raw : {};
  let startDate = normalizeIsoDate(item.start_date ?? item.class_start_date);
  let endDate = normalizeIsoDate(item.end_date ?? item.class_end_date);
  if (startDate && endDate && startDate > endDate) { startDate = ''; endDate = ''; }
  const specificDates = Array.isArray(item.specific_dates)
    ? [...new Set(item.specific_dates.map(normalizeIsoDate).filter(Boolean))].sort()
    : [];
  return {
    course_code: normalizeCourseCode(item.course_code), name: cleanString(item.name || item.course_name),
    section: cleanString(item.section, 80), component: cleanString(item.component, 80),
    instructor: cleanString(item.instructor), room: cleanString(item.room),
    days_of_week: Array.isArray(item.days_of_week) ? [...new Set(item.days_of_week.map(normalizeDay).filter(Boolean))] : [],
    start_time: normalizeTime(item.start_time), end_time: normalizeTime(item.end_time),
    start_date: startDate, end_date: endDate, specific_dates: specificDates,
    replaces_regular_time: item.replaces_regular_time === true,
  };
}

function compactRule(rule) {
  return Object.fromEntries(Object.entries(rule).filter(([, value]) => value !== '' && value !== null && value !== undefined));
}

function entryRules(entry) {
  const common = {
    component: entry.component, section: entry.section, start_time: entry.start_time, end_time: entry.end_time,
    room: entry.room, instructor: entry.instructor,
  };
  const rules = entry.specific_dates.map((specificDate) => compactRule({
    ...common, day: dateDay(specificDate), specific_date: specificDate,
    replaces_regular_time: entry.replaces_regular_time || undefined,
  }));
  if (entry.specific_dates.length === 0) {
    for (const day of entry.days_of_week) {
      rules.push(compactRule({ ...common, day, start_date: entry.start_date, end_date: entry.end_date }));
    }
  }
  if (rules.length === 0 && entry.start_date && entry.start_date === entry.end_date) {
    rules.push(compactRule({
      ...common, day: dateDay(entry.start_date), specific_date: entry.start_date,
      replaces_regular_time: entry.replaces_regular_time || undefined,
    }));
  }
  return rules;
}

function ruleSignature(rule) {
  return JSON.stringify([
    rule.component || '', rule.section || '', rule.day || '', rule.start_time || '', rule.end_time || '',
    rule.start_date || '', rule.end_date || '', rule.specific_date || '', rule.room || '', rule.instructor || '',
    rule.replaces_regular_time === true,
  ]);
}

function preferredName(current, incoming) {
  if (!current) return incoming;
  if (!incoming) return current;
  return incoming.length > current.length ? incoming : current;
}

export function consolidateTimetableClasses(value) {
  if (!Array.isArray(value)) return [];
  const grouped = new Map();
  for (const raw of value.slice(0, 250)) {
    const entry = normalizeEntry(raw);
    const identity = courseIdentity(entry);
    if (!identity || !entry.name) continue;
    if (!grouped.has(identity)) {
      grouped.set(identity, {
        course_code: entry.course_code, name: entry.name, instructor: entry.instructor, room: entry.room,
        meetings: [], source_entry_count: 0, _signatures: new Set(), _dates: [],
      });
    }
    const cls = grouped.get(identity);
    cls.source_entry_count += 1;
    cls.name = preferredName(cls.name, entry.name);
    if (!cls.course_code) cls.course_code = entry.course_code;
    if (!cls.instructor) cls.instructor = entry.instructor;
    if (!cls.room) cls.room = entry.room;
    for (const date of [entry.start_date, entry.end_date, ...entry.specific_dates]) if (date) cls._dates.push(date);
    for (const rule of entryRules(entry)) {
      const signature = ruleSignature(rule);
      if (!cls._signatures.has(signature)) { cls._signatures.add(signature); cls.meetings.push(rule); }
    }
  }
  return [...grouped.values()].map((cls) => {
    const dates = [...new Set(cls._dates)].sort();
    const days = [...new Set(cls.meetings.map((meeting) => meeting.day).filter(Boolean))];
    const earliest = [...cls.meetings].filter((meeting) => meeting.start_time)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
    return {
      course_code: cls.course_code, name: cls.name, instructor: cls.instructor, room: cls.room,
      days_of_week: days, start_time: earliest?.start_time || '', end_time: earliest?.end_time || '',
      class_start_date: dates[0] || '', class_end_date: dates.at(-1) || '',
      meetings: cls.meetings, source_entry_count: cls.source_entry_count,
    };
  });
}

export const normalizeTimetableClasses = consolidateTimetableClasses;
