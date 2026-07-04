/**
 * Client-side caching layer for entity reads.
 * Stores list/filter results in localStorage with TTL so data
 * is available instantly on reload and when offline.
 */

const CACHE_PREFIX = 'cedar-cache:';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

function key(entity, op, params) {
  return `${CACHE_PREFIX}${entity}:${op}:${JSON.stringify(params || {})}`;
}

export function cacheGet(entity, op, params) {
  try {
    const raw = localStorage.getItem(key(entity, op, params));
    if (!raw) return null;
    const { data, expiresAt } = JSON.parse(raw);
    if (Date.now() > expiresAt) {
      localStorage.removeItem(key(entity, op, params));
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function cacheSet(entity, op, params, data, ttl = DEFAULT_TTL) {
  try {
    localStorage.setItem(key(entity, op, params), JSON.stringify({
      data,
      expiresAt: Date.now() + ttl,
      cachedAt: Date.now(),
    }));
  } catch {
    // storage full or unavailable — silently skip
  }
}

export function cacheClear(entity) {
  try {
    const keys = Object.keys(localStorage);
    for (const k of keys) {
      if (entity) {
        if (k.startsWith(`${CACHE_PREFIX}${entity}:`)) localStorage.removeItem(k);
      } else if (k.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    // ignore
  }
}

/** Invalidate cache entries matching an entity so the next read fetches fresh data. */
export function invalidateEntity(entity) {
  cacheClear(entity);
}