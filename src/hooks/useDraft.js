import { useCallback, useEffect, useRef, useState } from 'react';

const PREFIX = 'praelecta:draft:';

function readDraft(key) {
  if (key == null) return undefined;
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function writeDraft(key, value) {
  if (key == null) return;
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the form still works, it just isn't kept.
  }
}

function removeDraft(key) {
  if (key == null) return;
  try {
    sessionStorage.removeItem(PREFIX + key);
  } catch {
    // Blocked: nothing was kept either.
  }
}

/** Every draft in this tab. Called at sign-out, so the next person to use
 *  the tab never opens a form with someone else's words in it. */
export function clearAllDrafts() {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(PREFIX)) sessionStorage.removeItem(key);
    }
  } catch {
    // Blocked: there are none.
  }
}

const here = () => `${window.location.pathname}${window.location.search}`;

/**
 * useState for a form that should survive the back button.
 *
 * Going back, swiping back, or tapping the bottom nav takes the page or sheet
 * a student was typing in off the screen, and what they had typed went with
 * it: a deadline half entered, a review half written, a semester's classes
 * corrected one by one. This keeps the value in this tab (sessionStorage:
 * gone when the tab closes, and at sign-out) until the form is done with,
 * and the form opens with it next time.
 *
 * Done with means one of two things:
 *  - the form says so, with `discard` (the third element), the moment what
 *    was typed has been saved; from then on this form keeps nothing, so an
 *    edit after the save can never bring the saved record back as a draft;
 *  - it is closed where it was opened (Cancel, ✕, Escape, a tap outside):
 *    it unmounts while the address is still the one it opened at. Leaving by
 *    navigation changes the address first, so that keeps the draft.
 *
 * Nothing is stored until the value changes, so a form opened with new
 * starting values (another day, another class) is never overridden by an
 * untouched old one. `key` names the form and what it is for, and stays the
 * same for the life of the component; null keeps nothing (plain useState),
 * for a form that already saves as it goes. The fourth element says whether
 * the value came back from a draft.
 */
export function useDraft(key, initial) {
  const restored = useRef(false);
  const [value, setValue] = useState(() => {
    const saved = readDraft(key);
    restored.current = saved !== undefined;
    return restored.current ? saved : (typeof initial === 'function' ? initial() : initial);
  });
  const changed = useRef(restored.current);
  // Once discarded, never kept again by this form: after a save, an edit to
  // what is still on screen must not bring the saved thing back as a draft.
  const discarded = useRef(false);

  const set = useCallback((next) => {
    changed.current = true;
    setValue(next);
  }, []);

  useEffect(() => {
    if (changed.current && !discarded.current) writeDraft(key, value);
  }, [key, value]);

  useEffect(() => {
    const openedAt = here();
    return () => {
      if (here() === openedAt) removeDraft(key);
    };
  }, [key]);

  const discard = useCallback(() => {
    discarded.current = true;
    removeDraft(key);
  }, [key]);

  return [value, set, discard, restored.current];
}
