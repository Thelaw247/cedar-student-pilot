import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';

// Direct port of base44/functions/fitProjectTime/entry.ts. Pure deterministic
// scheduling (find free gaps, fill them or suggest what to bump) — no LLM,
// not credit-gated in the original either.

const router = express.Router();
const timeToMin = (t) => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
const ds = (d) => (d instanceof Date ? d.toISOString().split('T')[0] : d);

router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { assignment_id, additional_minutes } = req.body || {};
    if (!assignment_id) return res.status(400).json({ error: 'assignment_id is required' });
    if (!additional_minutes || additional_minutes <= 0) return res.status(400).json({ error: 'additional_minutes is required' });

    const { rows: aRows } = await pool.query('select * from assignments where id = $1 and user_id = $2', [assignment_id, userId]);
    const assignment = aRows[0];
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

    const todayStr = new Date().toISOString().split('T')[0];
    const dueDateStr = ds(assignment.due_date);

    const allEvents = (await pool.query('select * from calendar_events where user_id = $1', [userId])).rows;
    const allSessions = (await pool.query('select * from study_sessions where user_id = $1', [userId])).rows;

    const events = allEvents.filter((e) => ds(e.date) >= todayStr && ds(e.date) <= dueDateStr);
    const sessions = allSessions.filter((s) => ds(s.scheduled_date) >= todayStr && ds(s.scheduled_date) <= dueDateStr && s.status === 'scheduled');

    const busyByDay = {};
    const addBusy = (date, startTime, endTime) => { if (!busyByDay[date]) busyByDay[date] = []; busyByDay[date].push({ start: timeToMin(startTime), end: timeToMin(endTime) }); };
    for (const ev of events) if (ev.start_time) addBusy(ds(ev.date), ev.start_time, ev.end_time || ev.start_time);
    for (const ss of sessions) {
      if (ss.scheduled_time) {
        const startMin = timeToMin(ss.scheduled_time);
        const endMin = startMin + (ss.duration_minutes || 60);
        addBusy(ds(ss.scheduled_date), ss.scheduled_time, `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`);
      }
    }

    const dayMs = 86400000;
    const startToday = new Date(todayStr + 'T00:00:00');
    const daysUntil = Math.max(0, Math.ceil((new Date(dueDateStr + 'T23:59:59') - startToday) / dayMs));
    const gaps = [];
    for (let i = 0; i <= daysUntil; i++) {
      const d = new Date(startToday); d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const busy = (busyByDay[dateStr] || []).sort((a, b) => a.start - b.start);
      const dayStart = 8 * 60, dayEnd = 22 * 60;
      let prevEnd = dayStart;
      for (const b of busy) {
        const bStart = Math.max(b.start, dayStart), bEnd = Math.min(b.end, dayEnd);
        if (bStart > prevEnd) gaps.push({ date: dateStr, start: prevEnd, end: bStart, minutes: bStart - prevEnd });
        prevEnd = Math.max(prevEnd, bEnd);
      }
      if (prevEnd < dayEnd) gaps.push({ date: dateStr, start: prevEnd, end: dayEnd, minutes: dayEnd - prevEnd });
    }

    const usableGaps = gaps.filter((g) => g.minutes >= 30);
    const totalFreeMinutes = usableGaps.reduce((sum, g) => sum + g.minutes, 0);

    if (totalFreeMinutes >= additional_minutes) {
      usableGaps.sort((a, b) => b.minutes - a.minutes);
      const sessionsToCreate = [];
      let remaining = additional_minutes;
      const existingProjectSessions = sessions.filter((s) => s.assignment_id === assignment_id && s.session_type === 'project');
      let stepBase = existingProjectSessions.length;

      for (const gap of usableGaps) {
        if (remaining <= 0) break;
        const sessionMin = Math.min(gap.minutes, Math.max(30, remaining));
        const startTime = `${String(Math.floor(gap.start / 60)).padStart(2, '0')}:${String(gap.start % 60).padStart(2, '0')}`;
        const roadmap = assignment.roadmap || [];
        const stepIndex = stepBase < roadmap.length ? stepBase : -1;
        stepBase++;
        sessionsToCreate.push({
          assignment_id, user_id: userId, class_id: assignment.class_id,
          scheduled_date: gap.date, scheduled_time: startTime, duration_minutes: sessionMin,
          priority: 'high', status: 'scheduled', session_type: 'project', roadmap_step_index: stepIndex >= 0 ? stepIndex : null,
          title: stepIndex >= 0 && roadmap[stepIndex] ? `Step ${stepIndex + 1}: ${roadmap[stepIndex].title}` : 'Additional project work time',
          notes: stepIndex >= 0 && roadmap[stepIndex] ? (roadmap[stepIndex].description || '') : '',
        });
        remaining -= sessionMin;
      }

      for (const s of sessionsToCreate) {
        await pool.query(
          `insert into study_sessions (assignment_id, user_id, class_id, scheduled_date, scheduled_time, duration_minutes, priority, status, session_type, roadmap_step_index, title, notes)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [s.assignment_id, s.user_id, s.class_id, s.scheduled_date, s.scheduled_time, s.duration_minutes, s.priority, s.status, s.session_type, s.roadmap_step_index, s.title, s.notes]);
      }

      return res.json({ scheduled: true, sessions_created: sessionsToCreate.length });
    }

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

    res.json({ scheduled: false, total_free_minutes: totalFreeMinutes, needed_minutes: additional_minutes, suggestions: suggestions.slice(0, 12) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
