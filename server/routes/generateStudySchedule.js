import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { createLlmUsage } from '../lib/llm.js';
import { gateFeature, settleFeature } from '../lib/credits.js';
import { scheduleAsap, addDaysStr, MIN_SESSION_MINUTES, MAX_SESSION_MINUTES } from '../lib/studyScheduler.js';

// Booking study sessions for an assignment (3 Sep 2026 rework). This used to
// ask an LLM to guess dates, times and durations, then silently override
// almost every guess through a deterministic conflict-checker anyway — the
// LLM's actual contribution to where a session landed was small, and it had
// no idea about the 30-minute travel buffer or the student's preferred study
// windows (Settings > Review Schedule), because neither existed yet. Now the
// whole thing runs on the shared studyScheduler, which both scheduleAsap
// callers here and processLectureRecording.js's review-booking use, so the
// placement rules can't drift apart between features again: ASAP, one
// session a day, 30-90 minutes sized to the gap, inside the buffer, inside
// the preferred windows.

const router = express.Router();
const dateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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
    // No LLM call any more (see note above) — kept only so settleFeature's
    // usage-accounting shape stays the same across every feature it charges.
    const llmUsage = createLlmUsage();

    const today = dateStr(new Date());
    const dueDateStr = assignment.due_date instanceof Date ? dateStr(assignment.due_date) : assignment.due_date;
    const daysUntil = Math.max(1, Math.ceil((new Date(`${dueDateStr}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000));
    const sessionCount = Math.min(Math.max(daysUntil, 3), 10);

    const placements = await scheduleAsap({
      userId, classId: assignment.class_id, count: sessionCount, fromDate: today, horizonDate: dueDateStr,
      minMinutes: MIN_SESSION_MINUTES, maxMinutes: MAX_SESSION_MINUTES,
    });

    const sessionsToCreate = placements.map((p, i) => ({
      assignment_id, user_id: userId, class_id: assignment.class_id,
      // Last placement (closest to the due date) carries the most weight.
      title: `${assignment.title} — Session ${i + 1}`,
      scheduled_date: p.date, scheduled_time: p.time, duration_minutes: p.duration_minutes,
      priority: i === placements.length - 1 ? 'high' : 'medium', status: 'scheduled', notes: null,
    }));

    // Exams and quizzes also get one dedicated final-review pass the day
    // before the due date (or the due date itself if the day-before is
    // completely full) — short and light, not another full study block.
    if (assignment.type === 'exam' || assignment.type === 'quiz') {
      const reviewFrom = addDaysStr(dueDateStr, -1);
      const [reviewPlacement] = await scheduleAsap({
        userId, classId: assignment.class_id, count: 1, fromDate: reviewFrom, horizonDate: dueDateStr, minMinutes: 30, maxMinutes: 45,
      });
      if (reviewPlacement) {
        sessionsToCreate.push({
          assignment_id, class_id: assignment.class_id, user_id: userId,
          title: `${assignment.title} — Final review`, scheduled_date: reviewPlacement.date, scheduled_time: reviewPlacement.time,
          duration_minutes: reviewPlacement.duration_minutes, priority: 'high', status: 'scheduled',
          notes: "Light review session — skim key concepts, don't go in depth.",
        });
      }
    }

    for (const s of sessionsToCreate) {
      await pool.query(
        `insert into study_sessions (assignment_id, user_id, class_id, title, scheduled_date, scheduled_time, duration_minutes, priority, status, notes)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [s.assignment_id, s.user_id, s.class_id, s.title, s.scheduled_date, s.scheduled_time, s.duration_minutes, s.priority, s.status, s.notes]);
    }

    await settleFeature(gate, { feature: 'study_schedule', llmUsage });
    res.json({ sessions_created: sessionsToCreate.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
