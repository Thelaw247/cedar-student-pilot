// Tiny module that caches the signed-in user's id so the SDK client wrapper in
// src/api/base44Client.js can stamp `user_id` on every create synchronously,
// without each component having to thread the user through. AuthContext is the
// only writer — it sets the id once auth resolves and clears it on logout.
let _userId = null;

const USER_STORAGE_PREFIX = 'cedar-user:';

export const setCachedUserId = (id) => {
  _userId = id || null;
};

export const getCachedUserId = () => _userId;

/** Build a localStorage key that cannot collide with another signed-in user. */
export const userStorageKey = (namespace, userId = _userId) => {
  if (!userId || !namespace) return null;
  return `${USER_STORAGE_PREFIX}${encodeURIComponent(userId)}:${namespace}`;
};

/** Remove every localStorage value owned by one user, preserving device theme. */
export function clearUserStorage(userId = _userId) {
  if (!userId || typeof localStorage === 'undefined') return;
  const prefix = `${USER_STORAGE_PREFIX}${encodeURIComponent(userId)}:`;
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(prefix)) localStorage.removeItem(key);
    }
  } catch {
    // Storage may be unavailable in privacy mode; logout must still continue.
  }
}

/** Remove scoped values that belong to anyone except the active user. */
export function clearOtherUserStorage(activeUserId) {
  if (typeof localStorage === 'undefined') return;
  const activePrefix = activeUserId
    ? `${USER_STORAGE_PREFIX}${encodeURIComponent(activeUserId)}:`
    : null;
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(USER_STORAGE_PREFIX) && (!activePrefix || !key.startsWith(activePrefix))) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Best effort; active-user reads still use an isolated namespace.
  }
}

/**
 * Old builds wrote user data without an owner. It cannot be attributed safely,
 * so remove it once instead of exposing or replaying it under the next account.
 */
export function clearLegacyUserStorage() {
  if (typeof localStorage === 'undefined') return;
  try {
    for (const key of Object.keys(localStorage)) {
      if (
        key.startsWith('cedar-cache:') ||
        key.startsWith('cedar-dismiss-') ||
        key === 'cedar-sync-queue' ||
        key === 'cedar-settings' ||
        key === 'cedar-autoprint-dismissed' ||
        key === 'cedar-custom-music'
      ) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Best-effort migration; scoped storage is still enforced for new writes.
  }
}