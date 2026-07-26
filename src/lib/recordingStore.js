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

const DB_NAME = 'cedar-recordings';
const STORE = 'recordings';
const VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'classId' });
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
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const store = tx(db, 'readwrite');
      const req = store.put({
        classId,
        blob,
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
    const db = await openDB();
    const rec = await new Promise((resolve, reject) => {
      const req = tx(db, 'readonly').get(classId);
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
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const req = tx(db, 'readwrite').delete(classId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
    return true;
  } catch (e) {
    return false;
  }
}
