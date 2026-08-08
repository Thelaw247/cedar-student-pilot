/**
 * Single source of truth for what a StudySession is *called*.
 *
 * History: StudySession originally had no `title` field, so every display
 * surface fell back to `notes` — which is meant to be the longer description
 * of what to do in the session. That's why AI-generated exam sessions showed
 * either nothing at all (no notes written) or the description text
 * ("Light review session — skim key concepts…") where a title belongs.
 *
 * `title` now exists. These helpers keep older rows (created before the field
 * existed) rendering sensibly without needing a data migration:
 *
 *   1. `title` if the row has one.
 *   2. For legacy PROJECT sessions only, `notes` — those were written as
 *      "Project Step 1: Draft outline", i.e. a title stuffed into notes.
 *      Study sessions are NOT given this fallback, because for them `notes`
 *      really is a description and using it as a title is the original bug.
 *   3. The parent assignment's title, optionally numbered.
 *   4. A generic label.
 */

/** Does this row carry a real, user-facing title? */
export function hasRealTitle(session) {
  return !!(session && typeof session.title === 'string' && session.title.trim());
}

/**
 * Resolve the display title for a session.
 *
 * @param {object} session     the StudySession row
 * @param {object} [assignment] the Assignment it belongs to, if known
 * @param {object} [opts]
 * @param {number} [opts.index] 0-based position among its sibling sessions;
 *                              when given, legacy rows fall back to a numbered
 *                              name ("Midterm — Session 3") instead of every
 *                              session sharing the assignment's title.
 */
export function sessionTitle(session, assignment, opts = {}) {
  if (!session) return 'Study session';
  if (hasRealTitle(session)) return session.title.trim();

  const isProject = session.session_type === 'project';

  // Legacy project rows kept their step name in `notes`.
  if (isProject && session.notes && session.notes.trim()) {
    return session.notes.trim();
  }

  const base = assignment?.title?.trim();
  const { index } = opts;

  if (base) {
    if (typeof index === 'number') {
      return `${base} — ${isProject ? 'Step' : 'Session'} ${index + 1}`;
    }
    return base;
  }

  if (typeof index === 'number') {
    return `${isProject ? 'Project step' : 'Study session'} ${index + 1}`;
  }
  return isProject ? 'Project session' : 'Study session';
}

/**
 * The description shown *under* the title.
 *
 * Legacy project rows use `notes` as their title, so echoing it again as the
 * description would duplicate the same string twice on the card.
 */
export function sessionDescription(session) {
  if (!session || !session.notes || !session.notes.trim()) return '';
  const usedAsTitle = !hasRealTitle(session) && session.session_type === 'project';
  return usedAsTitle ? '' : session.notes.trim();
}

/**
 * Title to seed an edit field with, so the box is never mysteriously blank.
 * Same resolution as `sessionTitle`, always numbered when we know the index.
 */
export function defaultSessionTitle(session, assignment, index) {
  return sessionTitle(session, assignment, { index });
}
