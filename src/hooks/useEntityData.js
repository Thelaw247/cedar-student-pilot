import { useCallback, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { cacheGet, cacheSet, invalidateEntity } from '@/lib/cache';
import { enqueueOperation } from '@/lib/syncQueue';

/**
 * Fetch entity data with localStorage cache fallback.
 * When online: fetch fresh, update cache, return.
 * When offline: return cached data (or empty array).
 */
export async function fetchWithCache(entity, op, params = [], options = {}) {
  const { ttl } = /** @type {{ttl?: number}} */ (options);
  const cached = cacheGet(entity, op, params);
  if (!navigator.onLine) {
    return cached || [];
  }
  try {
    const e = base44.entities[entity];
    const result = await e[op](...params);
    cacheSet(entity, op, params, result, ttl);
    return result;
  } catch {
    // network failed — fall back to cache
    return cached || [];
  }
}

/**
 * Perform an entity mutation with optimistic cache update + offline queue fallback.
 * Returns the result if online, or a placeholder if queued for later sync.
 */
export function useMutation(entity) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mutate = useCallback(async (operation, ...args) => {
    setLoading(true);
    setError(null);

    // If offline, queue the operation for later sync
    if (!navigator.onLine) {
      enqueueOperation({ entity, operation, args });
      // Optimistically update cache for reads
      const params = operation === 'create' ? [] : (operation === 'update' ? [args[0]] : [args[0]]);
      invalidateEntity(entity);
      setLoading(false);
      return { queued: true };
    }

    try {
      const e = base44.entities[entity];
      let result;
      switch (operation) {
        case 'create': result = await e.create(...args); break;
        case 'update': result = await e.update(...args); break;
        case 'delete': result = await e.delete(...args); break;
        case 'bulkCreate': result = await e.bulkCreate(...args); break;
        case 'updateMany': result = await e.updateMany(...args); break;
        case 'deleteMany': result = await e.deleteMany(...args); break;
        default: throw new Error(`Unsupported operation: ${operation}`);
      }
      invalidateEntity(entity);
      setLoading(false);
      return result;
    } catch (err) {
      // If network error mid-flight, queue for retry
      if (err?.message?.includes('network') || err?.message?.includes('fetch')) {
        enqueueOperation({ entity, operation, args });
        invalidateEntity(entity);
        setLoading(false);
        return { queued: true };
      }
      setError(err.message || 'Operation failed');
      setLoading(false);
      throw err;
    }
  }, [entity]);

  return { mutate, loading, error };
}
