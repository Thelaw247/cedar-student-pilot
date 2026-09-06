/**
 * "Something changed" — and, now, what.
 *
 * One window event keeps every surface showing the same rows in step: finish a
 * recording and the rail, the class page and the home screen all pick it up
 * without a reload. That part works. The problem was that the event said
 * nothing about WHAT changed, so every listener answered every event the only
 * way it could — by refetching everything it owns.
 *
 * Ticking a to-do on a lecture page went: flip the checkbox (instantly, and
 * correctly), write it, announce, and then four separate surfaces refetched
 * from scratch — including the page the student was reading, which sets
 * `loading` and renders a spinner over itself. From the outside that is the
 * page reloading because you ticked a box.
 *
 * So an announcement can name the entities it touched, and a listener can name
 * the ones it reads. An announcement that names nothing still reaches
 * everyone, which is right for the events that mean "a sync just finished, any
 * of this could be stale" — and it means an un-migrated caller keeps behaving
 * exactly as it did.
 */

export const DATA_CHANGED = 'cedar-data-changed';

/**
 * Tell the app some rows changed.
 *
 * @param {string[]} [entities] Entity names ('Todo', 'Lecture', …). Omit for a
 *   broad change — reconnection sync, a finished recording — where a listener
 *   cannot know whether its own data moved.
 */
export function announceDataChange(entities) {
  const detail = Array.isArray(entities) && entities.length > 0 ? { entities } : null;
  window.dispatchEvent(new CustomEvent(DATA_CHANGED, { detail }));
}

/**
 * Does this event concern a listener that reads `entities`?
 *
 * Exported for the tests, because the interesting cases are the two defaults:
 * an announcement with no entities reaches everyone, and a listener with no
 * declared entities hears everything.
 */
export function dataChangeAffects(event, entities) {
  const changed = event?.detail?.entities;
  if (!Array.isArray(changed) || changed.length === 0) return true;
  if (!Array.isArray(entities) || entities.length === 0) return true;
  return changed.some((name) => entities.includes(name));
}

/**
 * Subscribe to data changes, optionally only the ones you care about.
 *
 * @param {() => void} handler
 * @param {string[]} [entities] What this listener reads. Omit to hear everything.
 * @returns {() => void} unsubscribe, shaped for a useEffect cleanup.
 */
export function onDataChange(handler, entities) {
  const listener = (event) => { if (dataChangeAffects(event, entities)) handler(); };
  window.addEventListener(DATA_CHANGED, listener);
  return () => window.removeEventListener(DATA_CHANGED, listener);
}
