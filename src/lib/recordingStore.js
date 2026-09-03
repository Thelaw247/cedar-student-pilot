/**
 * recordingStore — durable local storage for in-progress lecture recordings.
 *
 * Lecture audio is the one thing in this app a student cannot recreate: if a
 * tab crashes, the phone locks, or an upload fails, losing the recording is
 * catastrophic. localStorage can't help (it can't hold binary and caps at a
 * few MB), so we persist the actual audio Blob to IndexedDB.
 *
 * During recording we flush the accumulated audio here every few seconds, so
 * at any moment there is a recoverable copy on disk that is at most one flush
 * behind. On the next visit, an interrupted recording can be recovered as REAL
 * audio (not just a "you missed a lecture" note), and a save that failed
 * mid-upload can be retried from the persisted copy.
 *
 * One record per user + class: a class only has one active recording at a
 * time, while a shared device can never expose one user's audio to another.
 */

import { getCachedUserId } from './currentUser.js';

const DB_NAME = 'cedar-recordings';
const STORE = 'recordings';
const USER_INDEX = 'by-user';
const VERSION = 2;

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      // Version 1 records were keyed only by classId and have no trustworthy
      // owner. Delete that unsafe store once rather than expose it to whoever
      // signs in next on the device.
      if (event.oldVersion < 2 && db.objectStoreNames.contains(STORE)) {
        db.deleteObjectStore(STORE);
      }
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: ['userId', 'classId'] });
        store.createIndex(USER_INDEX, 'userId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

/**
 * Persist (or overwrite) the current recording for a class.
 * @param {string} classId
 * @param {Blob}   blob     the audio captured so far
 * @param {object} meta     { seconds, timestamp }
 */
export async function saveRecording(classId, blob, meta = {}) {
  try {
    const userId = getCachedUserId();
    if (!userId) return false;
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const store = tx(db, 'readwrite');
      const req = store.put({
        userId,
        classId,
        blob,
        seconds: meta.seconds ?? 0,
        timestamp: meta.timestamp ?? Date.now(),
        mimeType: blob?.type || 'audio/webm',
        // The Lecture row this recording already created, if it got that far.
        // Without this a retry after a refresh cannot tell that the work is
        // already done (or already queued) and creates a duplicate lecture,
        // charging the student a second time for the same audio.
        lectureId: meta.lectureId ?? null,
        // Segments already uploaded to R2 for a recording that has been
        // rotated (see ClassDetail's chunking logic). Lets a crash-recovered
        // recording resume without re-uploading segments it already has.
        parts: Array.isArray(meta.parts) ? meta.parts : [],
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
    return true;
  } catch (e) {
    // Non-fatal: recording continues in memory even if the durable copy fails.
    return false;
  }
}

/** Retrieve the persisted recording for a class, or null. */
export async function getRecording(classId) {
  try {
    const userId = getCachedUserId();
    if (!userId) return null;
    const db = await openDB();
    const rec = await new Promise((resolve, reject) => {
      const req = tx(db, 'readonly').get([userId, classId]);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    // Recoverable means "there is still something to save": either local
    // bytes that never reached R2, or segments that did but were never
    // attached to a lecture. Requiring local bytes used to strand a
    // recording that had uploaded every segment and then failed at the
    // final step — exactly the case where the audio is most at risk.
    if (!rec) return null;
    const parts = Array.isArray(rec.parts) ? rec.parts : [];
    const hasBytes = !!rec.blob && rec.blob.size > 0;
    if (hasBytes || parts.length > 0) return { ...rec, parts };
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Every recoverable recording this user owns, newest first.
 *
 * getRecording needs a classId, which you can only have if you are already
 * looking at that class — so recovery used to be reachable only by opening the
 * Record modal on exactly the right class page. A student who refreshed
 * mid-lecture saw the recording pill vanish and had no way to learn the audio
 * was still here. Walking the by-user index removes that requirement: the
 * provider can find an interrupted session on boot, from anywhere in the app.
 */
export async function listRecoverableRecordings() {
  try {
    const userId = getCachedUserId();
    if (!userId) return [];
    const db = await openDB();
    const rows = await new Promise((resolve, reject) => {
      const out = [];
      const request = tx(db, 'readonly').index(USER_INDEX).openCursor(IDBKeyRange.only(userId));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(out);
          return;
        }
        out.push(cursor.value);
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
    db.close();
    return rows
      .map((rec) => ({ ...rec, parts: Array.isArray(rec.parts) ? rec.parts : [] }))
      // Same definition of "recoverable" as getRecording: local bytes that
      // never reached R2, or segments that did but were never attached to a
      // lecture. Anything else is a finished save waiting to be cleared.
      .filter((rec) => (rec.blob && rec.blob.size > 0) || rec.parts.length > 0)
      .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
  } catch (e) {
    return [];
  }
}

/** Remove the persisted recording for a class (after a clean save or discard). */
export async function clearRecording(classId) {
  try {
    const userId = getCachedUserId();
    if (!userId) return false;
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const req = tx(db, 'readwrite').delete([userId, classId]);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
    return true;
  } catch (e) {
    return false;
  }
}

/** Remove every crash-recovery recording owned by one user. */
export async function clearAllRecordings(userId = getCachedUserId()) {
  if (!userId) return true;
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      const request = transaction.objectStore(STORE).index(USER_INDEX).openCursor(IDBKeyRange.only(userId));
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    db.close();
    return true;
  } catch {
    return false;
  }
}

/** Purge recordings that do not belong to the active account. */
export async function clearOtherRecordings(activeUserId) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      const request = transaction.objectStore(STORE).openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          if (!activeUserId || cursor.value?.userId !== activeUserId) cursor.delete();
          cursor.continue();
        }
      };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    db.close();
    return true;
  } catch {
    return false;
  }
}

/** Open once at startup so the unsafe version-1 store is purged immediately. */
export async function initializeRecordingStore() {
  try {
    const db = await openDB();
    db.close();
    return true;
  } catch {
    return false;
  }
}
