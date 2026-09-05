import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { markLecturesReviewed, ownedLectureIds } from '../lib/knowledgeCoverage.js';

// "I studied these lectures." The write that was missing from the end of a
// study session.
//
// Everything else in the study flow already pointed here. A session knows
// which lectures it covers (phase 2), Focus Mode opens them (phase 3), the
// tools build material from them (phase 4) -- and then the student pressed
// Stop and none of it was recorded anywhere a screen could read. The
// freshness badges stayed grey, the proficiency ring did not move, and the
// only way to mark a lecture reviewed was to take a quiz.
//
// FREE. No gateFeature, no credit cost. Recording what a student did is not a
// feature to sell them; the material that fills the session is already
// charged for at the point it is generated.
//
// IDEMPOTENT ON THE SESSION. A study session's status is the guard: the
// update only fires while the session is not already completed, so a retried
// request, a double-tapped Stop button or a re-opened tab cannot count the
// same sitting twice. Closing the session and writing its coverage happen in
// one transaction, so the app can never show a completed session whose
// lectures were never marked.
//
// An ad-hoc session -- Focus Mode opened straight from a lecture, no
// study_sessions row -- has no id to be idempotent on, and repeating it is
// honestly a second review.

const router = express.Router();
const MAX_LECTURES = 100;

router.post('/', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const {
    session_id = null,
    class_id = null,
    lecture_ids = [],
    concepts_seen = null,
    concepts_mastered = null,
  } = req.body || {};

  if (!Array.isArray(lecture_ids) || lecture_ids.length > MAX_LECTURES) {
    return res.status(400).json({ error: 'lecture_ids must be an array of at most 100 lectures' });
  }
  if (!session_id && !class_id) {
    return res.status(400).json({ error: 'session_id or class_id is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('begin');

    let classId = class_id;
    let planned = [];

    if (session_id) {
      // Both halves of the guard in one statement: only a session that is not
      // already completed is closed, and only a close returns a row.
      const closed = (await client.query(
        `update study_sessions
            set status = 'completed'
          where id = $1 and user_id = $2 and status <> 'completed'
        returning class_id, opened_lecture_ids`,
        [session_id, userId],
      )).rows[0];

      if (!closed) {
        // Either it was already completed, or it is not this student's. Both
        // are a no-op that the client should treat as success -- it pressed
        // Stop and the session is closed, which is what it wanted.
        await client.query('rollback');
        return res.json({ already_completed: true, marked: [] });
      }
      classId = closed.class_id;
      planned = closed.opened_lecture_ids || [];
    }

    const owns = (await client.query(
      'select id from classes where id = $1 and user_id = $2',
      [classId, userId],
    )).rows[0];
    if (!owns) {
      await client.query('rollback');
      return res.status(404).json({ error: 'Class not found' });
    }

    // What the client just reported, plus whatever the session already had
    // recorded. The union matters: a tool writes opened_lecture_ids as it
    // happens so a dead browser keeps the record, and the same browser sends
    // its own list at the end in case a write never landed.
    const candidates = [...new Set([...planned, ...lecture_ids].filter(Boolean))].slice(0, MAX_LECTURES);
    const lectures = await ownedLectureIds(client, { userId, classId, lectureIds: candidates });

    const marked = await markLecturesReviewed(client, {
      userId,
      classId,
      lectureIds: lectures,
      conceptsSeen: concepts_seen,
      conceptsMastered: concepts_mastered,
    });

    await client.query('commit');
    return res.json({ marked, already_completed: false });
  } catch (error) {
    await client.query('rollback').catch(() => {});
    console.error('[record-study-coverage]', error);
    return res.status(500).json({ error: 'Could not record what you studied' });
  } finally {
    client.release();
  }
});

export default router;
