const VALID_DAYS = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

function cleanString(value, maxLength = 200) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function normalizeIsoDate(value) {
  const date = cleanString(value, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return '';

  const [, year, month, day] = match.map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) return '';

  return date;
}

export function normalizeTimetableClasses(value) {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 100).map((raw) => {
    const item = raw && typeof raw === 'object' ? raw : {};
    let classStartDate = normalizeIsoDate(item.class_start_date);
    let classEndDate = normalizeIsoDate(item.class_end_date);

    // An inverted model-produced range is not safe to persist. Leave it blank
    // so the review screen visibly falls back to the semester range instead.
    if (classStartDate && classEndDate && classStartDate > classEndDate) {
      classStartDate = '';
      classEndDate = '';
    }

    return {
      name: cleanString(item.name),
      instructor: cleanString(item.instructor),
      room: cleanString(item.room),
      days_of_week: Array.isArray(item.days_of_week)
        ? [...new Set(item.days_of_week.filter((day) => VALID_DAYS.has(day)))]
        : [],
      start_time: cleanString(item.start_time, 5),
      end_time: cleanString(item.end_time, 5),
      class_start_date: classStartDate,
      class_end_date: classEndDate,
    };
  });
}
