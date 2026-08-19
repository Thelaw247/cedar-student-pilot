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
 * One record per class (keyed by classId): a class only has one active
 * recording at a time, and this makes recovery lookups trivial.
 */

import { getCachedUserId } from './currentUser';

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
        blob:
        seconds: meta.seconds ?? 0,
        timestamp: meta.timestamp ?? Date.now(),
        mimeType: blob?.type || 'audio/webm',
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
    // Only treat it as recoverable if there's actual audio with some length.
    if (rec && rec.blob && rec.blob.size > 0) return rec;
    return null;
  } catch (e) {
    return null;
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
