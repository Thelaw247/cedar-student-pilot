import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { scheduleMinutesAsap, MIN_SESSION_MINUTES, MAX_SESSION_MINUTES } from '../lib/studyScheduler.js';

// "I need N more minutes of project work before this is due" (3 Sep 2026:
// refactored onto the shared studyScheduler — same buffer/preferred-window/
// ASAP rules as every other booking route now, instead of its own 8am-10pm,
// no-buffer, largest-gap-first search). Deterministic before this too — no
// LLM involved either way — so the only real change is which rules the gap
// search obeys.

const router = express.Router();
const ds = (d) => (d instanceof Date ? d.toISOString().split('T')[0] : d);
const timeToMin = (t) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };

router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { assignment_id, additional_minutes } = req.body || {};
    if (!assignment_id) return res.status(400).json({ error: 'assignment_id is required' });
    if (!additional_minutes || additional_minutes <= 0) return res.status(400).json({ error: 'additional_minutes is required' });

    const { rows: aRows } = await pool.query('select * from assignments where id = $1 and user_id = $2', [assignment_id, userId]);
    const assignment = aRows[0];
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

    const today = ds(new Date());
    const dueDateStr = ds(assignment.due_date);

    const placements = await scheduleMinutesAsap({
      userId, classId: assignment.class_id, totalMinutes: additional_minutes,
      fromDate: today, horizonDate: dueDateStr, minMinutes: MIN_SESSION_MINUTES, maxMinutes: MAX_SESSION_MINUTES,
    });
    const totalPlaced = placements.reduce((sum, p) => sum + p.duration_minutes, 0);

    if (totalPlaced >= additional_minutes) {
      const existingProjectSessions = (await pool.query(
        "select 1 from study_sessions where assignment_id = $1 and user_id = $2 and session_type = 'project'",
        [assignment_id, userId],
      )).rows;
      let stepBase = existingProjectSessions.length;
      const roadmap = assignment.roadmap || [];

      for (const p of placements) {
        const stepIndex = stepBase < roadmap.length ? stepBase : -1;
        stepBase++;
        await pool.query(
          `insert into study_sessions (assignment_id, user_id, class_id, scheduled_date, scheduled_time, duration_minutes, priority, status, session_type, roadmap_step_index, title, notes)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [assignment_id, userId, assignment.class_id, p.date, p.time, p.duration_minutes, 'high', 'scheduled', 'project',
            stepIndex >= 0 ? stepIndex : null,
            stepIndex >= 0 && roadmap[stepIndex] ? `Step ${stepIndex + 1}: ${roadmap[stepIndex].title}` : 'Additional project work time',
            stepIndex >= 0 && roadmap[stepIndex] ? (roadmap[stepIndex].description || '') : ''],
        );
      }
      return res.json({ scheduled: true, sessions_created: placements.length });
    }

    // Not enough room before the due date inside the preferred windows —
    // same "what could you bump" suggestions as before, unchanged shape so
    // ProjectSessionEndModal.jsx needs no changes.
    const allEvents = (await pool.query('select * from calendar_events where user_id = $1', [userId])).rows;
    const allSessions = (await pool.query('select * from study_sessions where user_id = $1', [userId])).rows;
    const events = allEvents.filter((e) => ds(e.date) >= today && ds(e.date) <= dueDateStr);
    const sessions = allSessions.filter((s) => ds(s.scheduled_date) >= today && ds(s.scheduled_date) <= dueDateStr && s.status === 'scheduled');

    const suggestions = [];
    const priorityRank = { low: 0, medium: 1, high: 2 };
    for (const ev of events) {
      const duration = ev.start_time && ev.end_time ? Math.max(30, timeToMin(ev.end_time) - timeToMin(ev.start_time)) : 60;
      const evPriority = ev.type === 'work' ? 'medium' : (ev.type === 'study' ? 'medium' : 'low');
      suggestions.push({ id: ev.id, entity: 'CalendarEvent', title: ev.title, date: ds(ev.date), time: ev.start_time, duration_minutes: duration, priority: evPriority, type: ev.type || 'custom' });
    }
    for (const ss of sessions) {
      if (ss.assignment_id !== assignment_id) {
        suggestions.push({ id: ss.id, entity: 'StudySession', title: ss.notes || 'Study Session', date: ds(ss.scheduled_date), time: ss.scheduled_time, duration_minutes: ss.duration_minutes || 60, priority: ss.priority || 'medium', type: ss.session_type || 'study' });
      }
    }
    suggestions.sort((a, b) => { const pr = (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1); if (pr !== 0) return pr; return (a.date || '').localeCompare(b.date || ''); });

    res.json({ scheduled: false, total_free_minutes: totalPlaced, needed_minutes: additional_minutes, suggestions: suggestions.slice(0, 12) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
