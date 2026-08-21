import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { invokeLLM, createLlmUsage } from '../lib/llm.js';
import { gateFeature, settleFeature } from '../lib/credits.js';

// Direct port of base44/functions/rebookStudySession/entry.ts.

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { session_id } = req.body || {};
    if (!session_id) return res.status(400).json({ error: 'session_id required' });

    const session = (await pool.query('select * from study_sessions where id = $1 and user_id = $2', [session_id, userId])).rows[0];
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const gate = await gateFeature(userId, 'smart_rebook', res);
    if (!gate.ok) return;
    const llmUsage = createLlmUsage();

    const cls = session.class_id ? (await pool.query('select * from classes where id = $1 and user_id = $2', [session.class_id, userId])).rows[0] : null;
    const assignment = session.assignment_id ? (await pool.query('select * from assignments where id = $1 and user_id = $2', [session.assignment_id, userId])).rows[0] : null;

    const today = new Date();
    const existing = (await pool.query('select * from study_sessions where class_id = $1 and user_id = $2', [session.class_id, userId])).rows;

    const prompt = `You are a study scheduler. A student needs to rebook a study session.
Current session: scheduled for ${session.scheduled_date} at ${session.scheduled_time || 'unspecified time'}, ${session.duration_minutes || 30} minutes, priority ${session.priority}.
Class: ${cls?.name || 'Unknown'}
Assignment: ${assignment?.title || 'General study'}, due ${assignment?.due_date || 'N/A'}
Today is ${today.toISOString().split('T')[0]}.
Other sessions this week: ${existing.filter((s) => s.id !== session_id).map((s) => `${s.scheduled_date} at ${s.scheduled_time}`).join(', ') || 'none'}

Suggest a new date and time within the next 7 days that:
1. Doesn't conflict with existing sessions
2. Gives enough time before the assignment due date
3. Is at a reasonable study hour (9 AM - 9 PM)

Respond with ONLY a JSON object: {"new_date": "YYYY-MM-DD", "new_time": "HH:MM", "reason": "brief reason"}`;

    const result = await invokeLLM({
      usage: llmUsage, prompt,
      response_json_schema: { type: 'object', properties: { new_date: { type: 'string' }, new_time: { type: 'string' }, reason: { type: 'string' } } },
    });

    const todayStr = today.toISOString().split('T')[0];
    let newDate = result.new_date;
    let newTime = result.new_time;

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    let isValid = dateRegex.test(newDate);
    if (isValid) {
      const parsed = new Date(newDate + 'T00:00:00');
      if (isNaN(parsed.getTime())) isValid = false;
      if (newDate < todayStr) isValid = false;
    }
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    let timeValid = timeRegex.test(newTime);

    if (!isValid) {
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      newDate = tomorrow.toISOString().split('T')[0];
    }
    if (!timeValid) newTime = '19:00';

    await pool.query('update study_sessions set scheduled_date = $1, scheduled_time = $2, status = $3 where id = $4 and user_id = $5', [newDate, newTime, 'scheduled', session_id, userId]);

    await settleFeature(gate, { feature: 'smart_rebook', llmUsage });

    res.json({ success: true, new_date: newDate, new_time: newTime, reason: result.reason });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
