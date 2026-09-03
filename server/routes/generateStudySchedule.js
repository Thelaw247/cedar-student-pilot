import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { createLlmUsage } from '../lib/llm.js';
import { gateFeature, settleFeature } from '../lib/credits.js';
import { bookAssignmentSessions } from '../lib/studyScheduler.js';

// Booking study sessions for an assignment the student created directly (3
// Sep 2026 rework, simplified further once bookAssignmentSessions became
// the one shared "book the standard prep sessions" function — also used by
// the lecture auto-detection pipeline in processLectureRecording.js, so an
// assignment behaves identically whether a student typed it in or Praelecta
// pulled it from a lecture). No LLM any more: see studyScheduler.js for why.

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { assignment_id } = req.body || {};
    if (!assignment_id) return res.status(400).json({ error: 'assignment_id is required' });

    const { rows: aRows } = await pool.query('select * from assignments where id = $1 and user_id = $2', [assignment_id, userId]);
    const assignment = aRows[0];
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

    const gate = await gateFeature(userId, 'study_schedule', res);
    if (!gate.ok) return;
    // No LLM call — kept only so settleFeature's usage-accounting shape
    // stays the same across every feature it charges.
    const llmUsage = createLlmUsage();

    const sessionsCreated = await bookAssignmentSessions({ userId, assignment });

    await settleFeature(gate, { feature: 'study_schedule', llmUsage });
    res.json({ sessions_created: sessionsCreated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
