import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { createLlmUsage } from '../lib/llm.js';
import { gateFeature, settleFeature } from '../lib/credits.js';
import { bookAssignmentSessions } from '../lib/studyScheduler.js';

// Booking study sessions for a deadline the student created. The one way in:
// the lecture pipeline used to call bookAssignmentSessions directly for a
// deadline it heard in a transcript, which meant a detected deadline got a
// full set of sessions free while the same deadline typed in by hand got
// none, because this route gates on study_schedule and that call did not.
// Detected deadlines are questions now (processLectureRecording.js), and
// answering one comes through here like everything else. No LLM: see
// studyScheduler.js for why.

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
