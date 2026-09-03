import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { createLlmUsage } from '../lib/llm.js';
import { gateFeature, settleFeature } from '../lib/credits.js';
import { scheduleAsap, addDaysStr } from '../lib/studyScheduler.js';

// Rebooking a missed/skipped session (3 Sep 2026: refactored onto the shared
// studyScheduler). This used to ask an LLM to freely pick a date/time within
// 7 days, with only format/not-in-the-past validation — no idea about the
// buffer or preferred windows, because neither existed yet. Now it finds the
// true next open slot deterministically, same rules as every other booking
// route, and keeps the session's original length rather than resizing it.

const router = express.Router();
const dateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const REBOOK_HORIZON_DAYS = 14;

router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { session_id } = req.body || {};
    if (!session_id) return res.status(400).json({ error: 'session_id required' });

    const session = (await pool.query('select * from study_sessions where id = $1 and user_id = $2', [session_id, userId])).rows[0];
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const gate = await gateFeature(userId, 'smart_rebook', res);
    if (!gate.ok) return;
    // No LLM call any more (see note above) — kept only so settleFeature's
    // usage-accounting shape stays the same across every feature it charges.
    const llmUsage = createLlmUsage();

    const today = dateStr(new Date());
    const duration = Math.max(20, Number(session.duration_minutes) || 30);
    const [placement] = await scheduleAsap({
      userId, classId: session.class_id, count: 1, fromDate: today, horizonDate: addDaysStr(today, REBOOK_HORIZON_DAYS),
      minMinutes: duration, maxMinutes: duration,
    });

    if (!placement) {
      return res.status(409).json({ error: "Couldn't find an open slot in the next two weeks. Try widening your preferred study times in Settings." });
    }

    await pool.query('update study_sessions set scheduled_date = $1, scheduled_time = $2, status = $3 where id = $4 and user_id = $5',
      [placement.date, placement.time, 'scheduled', session_id, userId]);

    await settleFeature(gate, { feature: 'smart_rebook', llmUsage });

    res.json({ success: true, new_date: placement.date, new_time: placement.time, reason: 'Moved to the next open slot inside your preferred study window.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
