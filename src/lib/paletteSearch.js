/**
 * Matching rules for the ⌘K command palette.
 *
 * Pure and React-free so the behaviour can be tested directly. It lives apart
 * from the component because the palette shipped for a long time unable to
 * match anything at all — Layout rendered it with no data — and a silent
 * search that always answers "No results found" is not something a rendered
 * component test would have caught either. The rules are now the thing under
 * test, and the component only supplies data and draws rows.
 *
 * Class fields match the Classes page's own search box (name, course code,
 * instructor) so the two can never disagree about what counts as a match.
 */

/** @param {unknown} value @param {string} q */
function contains(value, q) {
  return String(value ?? '').toLowerCase().includes(q);
}

/** True if any field contains the (already lower-cased) query. */
export function matchesAny(q, ...fields) {
  return fields.some((f) => contains(f, q));
}

export const PALETTE_LIMITS = { classes: 3, lectures: 5, assignments: 3 };

/**
 * @param {string} query raw user input
 * @param {{classes?: any[], lectures?: any[], assignments?: any[]}} data
 * @returns {{classes: any[], lectures: any[], assignments: any[]}}
 */
export function searchPalette(query, { classes = [], lectures = [], assignments = [] } = {}) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return { classes: [], lectures: [], assignments: [] };

  const classById = new Map((classes || []).map((c) => [c.id, c]));
  const className = (id) => classById.get(id)?.name;

  return {
    classes: (classes || [])
      .filter((c) => matchesAny(q, c.name, c.course_code, c.instructor))
      .slice(0, PALETTE_LIMITS.classes),
    // A lecture matches on its class name too: someone typing a class expects
    // that class's recordings, not just the class row itself.
    lectures: (lectures || [])
      .filter((l) => matchesAny(q, l.ai_title, l.transcript, className(l.class_id)))
      .slice(0, PALETTE_LIMITS.lectures),
    assignments: (assignments || [])
      .filter((a) => matchesAny(q, a.title, className(a.class_id)))
      .slice(0, PALETTE_LIMITS.assignments),
  };
}

/** Class name for a record that carries a class_id, for result sub-lines. */
export function classNameFor(classes, classId) {
  return (classes || []).find((c) => c.id === classId)?.name;
}
