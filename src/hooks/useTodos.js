import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { fetchWithCache } from '@/hooks/useEntityData';
import { invalidateEntity } from '@/lib/cache';
import { enqueueOperation } from '@/lib/syncQueue';

/**
 * The to-do list, shared by the To-Do tab and the per-lecture checklist.
 *
 * Reads go through the entity cache like every other list in the app;
 * writes are optimistic (the checkbox flips immediately) and queue for
 * sync when offline, the same contract notes use. Every change fires
 * `cedar-data-changed` so the other surface showing the same items — the
 * lecture page, the tab, the rail — refreshes without a reload.
 *
 * `filter` narrows the query: `{ lecture_id }` for one lecture's items,
 * nothing for the whole list.
 */
export function useTodos(filter = undefined) {
  const [todos, setTodos] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const key = JSON.stringify(filter || {});

  const load = useCallback(async () => {
    try {
      const rows = filter
        ? await fetchWithCache('Todo', 'filter', [filter])
        : await fetchWithCache('Todo', 'list', ['-created_date', 500]);
      setTodos(Array.isArray(rows) ? rows : []);
    } catch {
      // Keep whatever is on screen.
    }
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    load();
    window.addEventListener('cedar-data-changed', load);
    return () => window.removeEventListener('cedar-data-changed', load);
  }, [load]);

  const announce = () => {
    invalidateEntity('Todo');
    window.dispatchEvent(new Event('cedar-data-changed'));
  };

  const write = async (operation, args, optimistic) => {
    setTodos(optimistic);
    if (!navigator.onLine) {
      enqueueOperation({ entity: 'Todo', operation, args });
      invalidateEntity('Todo');
      return { queued: true };
    }
    try {
      const result = await base44.entities.Todo[operation](...args);
      announce();
      return result;
    } catch (e) {
      // Roll back to the server's truth.
      await load();
      throw e;
    }
  };

  const toggle = useCallback((todo) => {
    const done = !todo.done;
    const patch = { done, done_at: done ? new Date().toISOString() : null };
    return write('update', [todo.id, patch], todos.map((t) => (t.id === todo.id ? { ...t, ...patch } : t)));
  }, [todos]);

  const create = useCallback(async (fields) => {
    const draft = { title: '', kind: 'task', source: 'manual', done: false, ...fields };
    if (!draft.title.trim()) return null;
    const temp = { ...draft, id: `temp-${Date.now()}`, created_at: new Date().toISOString() };
    const result = await write('create', [draft], [temp, ...todos]);
    if (result && !result.queued) setTodos((list) => list.map((t) => (t.id === temp.id ? result : t)));
    return result;
  }, [todos]);

  const update = useCallback((id, patch) => write('update', [id, patch], todos.map((t) => (t.id === id ? { ...t, ...patch } : t))),
    [todos]);

  const remove = useCallback((id) => write('delete', [id], todos.filter((t) => t.id !== id)),
    [todos]);

  return { todos, loaded, reload: load, toggle, create, update, remove };
}

/** Local calendar day as YYYY-MM-DD — to-dos are dated in the student's day. */
export function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
