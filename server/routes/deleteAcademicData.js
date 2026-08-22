import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { deleteOwnedObject, parseStorageRef } from '../lib/r2.js';

const router = express.Router();

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
      'select id, recording_url from lectures where id = $1 and user_id = $2 for update',
      [req.params.id, req.user.id],
    )).rows[0];
    if (!lecture) {
      await db.query('rollback');
      return res.status(404).json({ error: 'Lecture not found' });
    }
    await deleteRecordingRefs(req.user.id, [lecture.recording_url]);
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
    const refs = (await db.query(
      'select recording_url from lectures where class_id = $1 and user_id = $2',
      [cls.id, req.user.id],
    )).rows.map((row) => row.recording_url);
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

