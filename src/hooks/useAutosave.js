import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { enqueueOperation } from '@/lib/syncQueue';
import { invalidateEntity } from '@/lib/cache';

/**
 * Debounced autosave for editing an entity record that already exists.
 *
 * Replaces the "type, then remember to hit Save" pattern. Every edit surface
 * in the app funnels through this so the save behaviour (timing, coalescing,
 * offline handling, status reporting) is identical everywhere.
 *
 * Deliberately NOT used for creation forms: autosave needs a record id to
 * write to, and firing it on a blank "Add" modal would create half-filled
 * rows the moment the modal opened. Those keep an explicit submit button.
 *
 * Behaviour:
 *  - Coalesces rapid edits into one write after `delay` ms of quiet.
 *  - Never runs two writes for the same record at once; if edits land while a
 *    write is in flight, the newest values are saved immediately after.
 *  - Offline edits go to the existing sync queue and replay on reconnect.
 *  - `flush()` forces a pending write immediately (used on modal close).
 *
 * Status: 'idle' | 'saving' | 'saved' | 'error'
 */
/**
 * @param {{entity?: string, delay?: number, onSaved?: () => void, onError?: (error: any, id: string) => void}} options
 */
export function useAutosave({ entity, delay = 700, onSaved, onError } = {}) {
  const [status, setStatus] = useState('idle');

  const timerRef = useRef(null);
  // Newest unsaved values, keyed by record id: { [id]: {field: value} }
  const pendingRef = useRef({});
  // Ids currently being written, so we never overlap writes on one record.
  const inFlightRef = useRef(new Set());
  const savedTimerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
  }, []);

  const setStatusSafe = useCallback((s) => {
    if (mountedRef.current) setStatus(s);
  }, []);

  /** Write everything currently pending. */
  const writePending = useCallback(async () => {
    const batch = pendingRef.current;
    const ids = Object.keys(batch).filter(id => !inFlightRef.current.has(id));
    if (ids.length === 0) return;

    // Claim these ids and clear them from pending so edits arriving during the
    // write are collected for the next pass rather than lost.
    const payloads = {};
    for (const id of ids) {
      payloads[id] = batch[id];
      delete batch[id];
      inFlightRef.current.add(id);
    }

    setStatusSafe('saving');

    // Offline: hand off to the sync queue, which replays on reconnect.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      for (const id of ids) {
        enqueueOperation({ entity, operation: 'update', args: [id, payloads[id]] });
        inFlightRef.current.delete(id);
      }
      invalidateEntity(entity);
      setStatusSafe('saved');
      onSaved?.();
      return;
    }

    let failed = false;
    await Promise.all(ids.map(async (id) => {
      try {
        await base44.entities[entity].update(id, payloads[id]);
      } catch (err) {
        // Network blips go to the queue; real errors surface to the user.
        const msg = err?.message || '';
        if (/network|fetch|timeout/i.test(msg)) {
          enqueueOperation({ entity, operation: 'update', args: [id, payloads[id]] });
        } else {
          failed = true;
          onError?.(err, id);
        }
      } finally {
        inFlightRef.current.delete(id);
      }
    }));

    invalidateEntity(entity);

    if (failed) {
      setStatusSafe('error');
    } else {
      setStatusSafe('saved');
      onSaved?.();
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setStatusSafe('idle'), 2000);
    }

    // Edits that arrived mid-write — save them now.
    if (Object.keys(pendingRef.current).length > 0) {
      writePending();
    }
  }, [entity, onSaved, onError, setStatusSafe]);

  /**
   * Queue a change. `patch` holds only the fields that changed.
   * Repeated calls for the same id merge together.
   */
  const save = useCallback((id, patch) => {
    if (!id || !patch || Object.keys(patch).length === 0) return;
    pendingRef.current[id] = { ...(pendingRef.current[id] || {}), ...patch };
    setStatusSafe('saving');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => writePending(), delay);
  }, [delay, writePending, setStatusSafe]);

  /** Force any pending write to happen now (e.g. the user is closing the modal). */
  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await writePending();
  }, [writePending]);

  /** Drop a record's queued edits — used when the record is being deleted. */
  const discard = useCallback((id) => {
    delete pendingRef.current[id];
  }, []);

  const hasPendingEdits = useCallback(
    () => Object.keys(pendingRef.current).length > 0 || inFlightRef.current.size > 0,
    []
  );

  return { save, flush, discard, status, hasPendingEdits };
}

export default useAutosave;
