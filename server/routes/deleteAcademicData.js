import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { deleteOwnedObject, parseStorageRef } from '../lib/r2.js';

const router = express.Router();

// A lecture's recording may be one r2:// ref (recording_url) or, for a
// recording split into multiple segments, several (recording_parts).
// Deleting is deliberately idempotent per ref — recording_url always
// duplicates the first entry of recording_parts, and deleteOwnedObject on an
// already-missing key is not treated as an error path here.
function recordingRefsFor(row) {
  const refs = new Set();
  if (row.recording_url) refs.add(row.recording_url);
  if (Array.isArray(row.recording_parts)) {
    for (const ref of row.recording_parts) if (ref) refs.add(ref);
  }
  return [...refs];
}

async function deleteRecordingRefs(userId, refs) {
  for (const ref of refs) {
    const parsed = parseStorageRef(ref);
    if (parsed) await deleteOwnedObject(userId, parsed.key);
  }
}

router.delete('/lectures/:id', requireAuth, async (req, res) => {
  const db = await pool.connect();
  try {
    await db.query('begin');
    const lecture = (await db.query(
      'select id, recording_url, recording_parts from lectures where id = $1 and user_id = $2 for update',
      [req.params.id, req.user.id],
    )).rows[0];
    if (!lecture) {
      await db.query('rollback');
      return res.status(404).json({ error: 'Lecture not found' });
    }
    await deleteRecordingRefs(req.user.id, recordingRefsFor(lecture));
    await db.query('delete from lectures where id = $1 and user_id = $2', [lecture.id, req.user.id]);
    await db.query('commit');
    return res.sendStatus(204);
  } catch (error) {
    await db.query('rollback').catch(() => {});
    console.error('[delete-lecture]', error);
    return res.status(500).json({ error: 'Could not delete the lecture and its recording' });
  } finally {
    db.release();
  }
});

router.delete('/classes/:id', requireAuth, async (req, res) => {
  const db = await pool.connect();
  try {
    await db.query('begin');
    const cls = (await db.query(
      'select id from classes where id = $1 and user_id = $2 for update',
      [req.params.id, req.user.id],
    )).rows[0];
    if (!cls) {
      await db.query('rollback');
      return res.status(404).json({ error: 'Class not found' });
    }
    const lectureRows = (await db.query(
      'select recording_url, recording_parts from lectures where class_id = $1 and user_id = $2',
      [cls.id, req.user.id],
    )).rows;
    const refs = lectureRows.flatMap((row) => recordingRefsFor(row));
    await deleteRecordingRefs(req.user.id, refs);
    // Foreign keys are ON DELETE CASCADE, so all derived academic rows are
    // removed consistently with the class in this same transaction.
    await db.query('delete from classes where id = $1 and user_id = $2', [cls.id, req.user.id]);
    await db.query('commit');
    return res.sendStatus(204);
  } catch (error) {
    await db.query('rollback').catch(() => {});
    console.error('[delete-class]', error);
    return res.status(500).json({ error: 'Could not delete the class and its recordings' });
  } finally {
    db.release();
  }
});

export default router;

