import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';

// Direct port of base44/functions/resolveAssignment/entry.ts. See that file's
// header comment (preserved in git history) for why deletion clears every
// linked session while completed/archived only clears scheduled ones.

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { assignment_id, action } = req.body || {};
    if (!assignment_id || !action) {
      return res.status(400).json({ error: 'assignment_id and action are required' });
    }
    if (!['completed', 'archived', 'reactivate', 'deleted'].includes(action)) {
      return res.status(400).json({ error: 'action must be completed, archived, reactivate, or deleted' });
    }

    const { rows: found } = await pool.query(
      'select id from assignments where id = $1 and user_id = $2', [assignment_id, userId]);
    if (found.length === 0) return res.status(404).json({ error: 'Assignment not found' });

    if (action === 'deleted') {
      const del = await pool.query(
        'delete from study_sessions where assignment_id = $1 and user_id = $2', [assignment_id, userId]);
      await pool.query('delete from assignments where id = $1 and user_id = $2', [assignment_id, userId]);
      return res.json({ status: 'complete', assignment_id, deleted: true, cleared_sessions: del.rowCount });
    }

    const newStatus = action === 'reactivate' ? 'active' : action;
    await pool.query('update assignments set status = $1 where id = $2 and user_id = $3', [newStatus, assignment_id, userId]);

    let clearedSessions = 0;
    if (action === 'completed' || action === 'archived') {
      const result = await pool.query(
        `update study_sessions set status = 'skipped'
         where assignment_id = $1 and user_id = $2 and status = 'scheduled'`,
        [assignment_id, userId]);
      clearedSessions = result.rowCount;
    }

    res.json({ status: 'complete', assignment_id, new_status: newStatus, cleared_sessions: clearedSessions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
