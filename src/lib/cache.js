/**
 * Client-side caching layer for entity reads.
 * Stores list/filter results in localStorage with TTL so data
 * is available instantly on reload and when offline.
 */

import { userStorageKey } from './currentUser';

const CACHE_NAMESPACE = 'cache:';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

function key(entity, op, params) {
  return userStorageKey(`${CACHE_NAMESPACE}${entity}:${op}:${JSON.stringify(params || {})}`);
}

export function cacheGet(entity, op, params) {
  try {
    const storageKey = key(entity, op, params);
    if (!storageKey) return null;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const { data, expiresAt } = JSON.parse(raw);
    if (Date.now() > expiresAt) {
      localStorage.removeItem(storageKey);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function cacheSet(entity, op, params, data, ttl = DEFAULT_TTL) {
  try {
    const storageKey = key(entity, op, params);
    if (!storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify({
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
    const prefix = userStorageKey(entity ? `${CACHE_NAMESPACE}${entity}:` : CACHE_NAMESPACE);
    if (!prefix) return;
    for (const storageKey of Object.keys(localStorage)) {
      if (storageKey.startsWith(prefix)) localStorage.removeItem(storageKey);
    }
  } catch {
    // ignore
  }
}

/** Invalidate cache entries matching an entity so the next read fetches fresh data. */
export function invalidateEntity(entity) {
  cacheClear(entity);
}