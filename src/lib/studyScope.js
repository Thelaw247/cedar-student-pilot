import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * What you are studying, in the URL, once.
 *
 * Every door into studying knew something — this lecture, this class, this
 * deadline — and most of them threw it away on the way through. The class
 * page's Focus button opened a picker asking which class. The Practice tab and
 * the review tools each kept their own class and lecture selection in local
 * state, so choosing a class in one and switching to the other asked again.
 *
 * The URL is the one place a scope can live that survives a tab switch, a
 * refresh, a deep link from a lecture page, and the back button. So it lives
 * there, and both tabs read it.
 *
 *   /study?tab=now&classId=<uuid>&ids=<uuid,uuid>&assignmentId=<uuid>&sessionId=<uuid>
 *
 * `ids` empty means the whole class, which is what LectureScopePicker has
 * always meant by an empty selection — the same convention, not a new one.
 *
 * `assignmentId` is read and written here but not yet shown. It is how "study
 * for Midterm 2" becomes part of the scope instead of a question a wizard
 * asks, and resolveAssignmentLectures already turns it into lectures.
 *
 * `sessionId` is the booked session this sitting belongs to. It is what
 * /focus/:id redirects into, and it is what makes the timer close the session
 * and tick its lectures off when it stops.
 */

export const STUDY_TABS = ['now', 'schedule'];

/**
 * The old names, kept working.
 *
 * Links to `?tab=practice` are in the wild — on the lecture page, on the class
 * page, in the risk card on Home — and some of them are in a student's history
 * or a bookmark. They map rather than break.
 */
const TAB_ALIASES = { practice: 'now', plan: 'schedule' };

function normalizeTab(raw) {
  if (!raw) return null;
  if (STUDY_TABS.includes(raw)) return raw;
  return TAB_ALIASES[raw] || null;
}

/** Parse a scope out of the query string. Never throws; unknown values drop. */
export function readStudyScope(searchParams) {
  const get = (k) => (typeof searchParams?.get === 'function' ? searchParams.get(k) : null);
  return {
    tab: normalizeTab(get('tab')) || 'schedule',
    classId: get('classId') || '',
    lectureIds: (get('ids') || '').split(',').map((s) => s.trim()).filter(Boolean),
    assignmentId: get('assignmentId') || '',
    sessionId: get('sessionId') || '',
  };
}

/**
 * A scope as query params, with the empty parts left out.
 *
 * Omitting empties matters: a URL carrying `ids=` reads as "an empty
 * selection", and an empty selection already means something else here —
 * the whole class.
 */
export function studyScopeParams(scope = {}) {
  /** @type {Record<string, string>} */
  const out = {};
  const tab = normalizeTab(scope.tab);
  if (tab) out.tab = tab;
  if (scope.classId) out.classId = scope.classId;
  if (Array.isArray(scope.lectureIds) && scope.lectureIds.length > 0) out.ids = scope.lectureIds.join(',');
  if (scope.assignmentId) out.assignmentId = scope.assignmentId;
  if (scope.sessionId) out.sessionId = scope.sessionId;
  return out;
}

/** The path a study link should point at, scope included. */
export function studyPath(scope = {}) {
  const params = new URLSearchParams(studyScopeParams(scope));
  const query = params.toString();
  return query ? `/study?${query}` : '/study';
}

/**
 * Where a booked session opens.
 *
 * Almost every session is the study page, carrying its id — the scope, the
 * goal and the labels all come off the row. A project session is the one
 * exception: it works through a roadmap step rather than a set of lectures,
 * so it keeps its own screen.
 *
 * Written once because five callers make this decision — the planner's session
 * row, the due-session notifier, Rebook's "Start now", and the redirects — and
 * four of them used to send everything to /focus regardless.
 */
export function sessionStudyPath(session) {
  if (!session?.id) return studyPath({ tab: 'now' });
  if (session.session_type === 'project') return `/focus/${session.id}`;
  return studyPath({ tab: 'now', sessionId: session.id });
}

/**
 * The scope, live, backed by the URL.
 *
 * `replace` on write, deliberately: a student changing which lectures they
 * want is adjusting one intention, not navigating. Pushing every picker change
 * would make Back walk through each of them instead of leaving the page.
 *
 * @returns {[ReturnType<typeof readStudyScope>, (patch: object) => void]}
 */
export function useStudyScope() {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.toString();

  const scope = useMemo(() => readStudyScope(new URLSearchParams(raw)), [raw]);

  const setScope = useCallback((patch) => {
    setSearchParams((current) => {
      const next = readStudyScope(current);
      const merged = { ...next, ...patch };
      const params = new URLSearchParams(current);
      // Rewrite only the scope keys, so anything else on the URL survives.
      for (const key of ['tab', 'classId', 'ids', 'assignmentId', 'sessionId']) params.delete(key);
      for (const [key, value] of Object.entries(studyScopeParams(merged))) params.set(key, value);
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  return [scope, setScope];
}
