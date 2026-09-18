/**
 * What makes two timetable rows the same course.
 *
 * The parser merges repeated rows of one course by this identity
 * (server/lib/timetableResult.js), and re-importing a timetable matches the
 * parsed courses to the classes a student already has by the same identity
 * (src/pages/SemesterSetup.jsx) — so the lecture recorded under "CHEM 142"
 * last week stays attached to the CHEM 142 whose lab time just changed. One
 * definition, shared, so the two can never disagree.
 *
 * A course code wins when there is one ("CHEM 142", however it was spaced or
 * dashed). Without a code, the name is used with the component words
 * (Lecture, Lab, Tutorial, Section …) and their labels stripped, so
 * "Biology 101 Lecture" and "Biology 101 Lab L01" are one course.
 */

function cleanString(value, maxLength = 200) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : '';
}

export function normalizeCourseCode(value) {
  return cleanString(value, 40).toUpperCase().replace(/[–—]/g, '-').replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ');
}

/**
 * @param {{course_code?: string|null, name?: string|null}} entry
 * @returns {string} 'code:CHEM142' | 'name:biology 101' | '' when there is nothing to go on
 */
export function courseIdentity(entry) {
  const code = normalizeCourseCode(entry?.course_code);
  if (code) return `code:${code.replace(/[^A-Z0-9]/g, '')}`;
  const normalizedName = cleanString(entry?.name).toLowerCase()
    .replace(/\b(lecture|lect|lab|laboratory|tutorial|seminar|section|sec)\b\s*[a-z0-9-]*/gi, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim();
  return normalizedName ? `name:${normalizedName}` : '';
}

/**
 * Re-import: match the parsed courses to the classes the semester already
 * has. A match carries the existing class id, so the server updates that row
 * in place and everything attached to it — lectures, recordings, attendance,
 * flashcards, files — stays put. A match also keeps the class's colour: the
 * student chose it, the timetable did not. Each existing class can be claimed
 * once; a second parsed course with the same identity (a course the student
 * split earlier) is new. Parsed courses never lose an id they already carry.
 *
 * @param {Array<{id?: string, course_code?: string, name?: string, color?: string}>} parsed
 * @param {Array<{id: string, course_code?: string, name?: string, color?: string}>} existing
 */
export function matchParsedToExisting(parsed, existing) {
  const byIdentity = new Map();
  for (const cls of existing || []) {
    const key = courseIdentity(cls);
    if (key && !byIdentity.has(key)) byIdentity.set(key, cls);
  }
  const claimed = new Set((parsed || []).map((cls) => cls?.id).filter(Boolean));
  return (parsed || []).map((cls) => {
    if (cls?.id) return cls;
    const key = courseIdentity(cls);
    const match = key ? byIdentity.get(key) : null;
    if (!match || claimed.has(match.id)) return cls;
    claimed.add(match.id);
    return { ...cls, id: match.id, color: match.color || cls.color };
  });
}

/** Existing classes no parsed course claims — kept exactly as they are; a re-import never deletes. */
export function unclaimedClasses(parsed, existing) {
  const claimed = new Set((parsed || []).map((cls) => cls?.id).filter(Boolean));
  return (existing || []).filter((cls) => !claimed.has(cls.id));
}
