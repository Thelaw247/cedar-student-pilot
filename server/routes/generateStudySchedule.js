import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { invokeLLM, createLlmUsage } from '../lib/llm.js';
import { gateFeature, settleFeature } from '../lib/credits.js';
import { getClassMeetingsForDate } from '../../src/lib/classSchedule.js';

// Direct port of base44/functions/generateStudySchedule/entry.ts. The
// busy-block conflict resolution is pure deterministic JS (dates/arrays) and
// ports 1:1 — the only real changes are query shape (SQL instead of
// base44.entities.X.filter) and gate/settle wiring.

const router = express.Router();

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const toMin = (t) => { if (!t || typeof t !== 'string' || !t.includes(':')) return null; const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
const toTime = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const dateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const CANDIDATE_STARTS = [16 * 60, 17 * 60, 18 * 60, 19 * 60, 20 * 60, 14 * 60, 15 * 60, 13 * 60, 10 * 60, 11 * 60, 9 * 60, 21 * 60];
function overlaps(startA, durA, startB, durB) { return startA < startB + durB && startB < startA + durA; }

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
    const llmUsage = createLlmUsage();

    const { rows: clsRows } = await pool.query('select * from classes where id = $1 and user_id = $2', [assignment.class_id, userId]);
    const cls = clsRows[0];
    const { rows: lectures } = await pool.query('select * from lectures where class_id = $1 and user_id = $2 order by date', [assignment.class_id, userId]);

    const { rows: semesters } = await pool.query('select * from semesters where user_id = $1 and is_active = true', [userId]);
    let allClasses = [];
    if (semesters.length > 0) {
      allClasses = (await pool.query('select * from classes where semester_id = $1 and user_id = $2', [semesters[0].id, userId])).rows;
    }

    const dueDate = new Date(assignment.due_date);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const daysUntil = Math.max(1, Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24)));

    const busyByDate = {};
    const addBusy = (ds, start, dur, label) => { if (start == null) return; if (!busyByDate[ds]) busyByDate[ds] = []; busyByDate[ds].push({ start, dur: dur || 60, label }); };

    const windowDates = [];
    for (let i = 0; i <= daysUntil; i++) { const d = new Date(today); d.setDate(today.getDate() + i); windowDates.push({ ds: dateStr(d), label: DAY_LABELS[d.getDay()] }); }

    for (const { ds } of windowDates) {
      for (const c of allClasses) {
        for (const meeting of getClassMeetingsForDate(c, ds)) {
          const slot = { start: toMin(meeting.start_time || c.start_time), end: toMin(meeting.end_time || c.end_time) };
          if (slot.start != null) addBusy(ds, slot.start, (slot.end || slot.start + 60) - slot.start, `class:${c.name}`);
        }
      }
    }

    let existingSessions = [];
    for (const c of allClasses) {
      const s = (await pool.query('select * from study_sessions where class_id = $1 and user_id = $2', [c.id, userId])).rows;
      existingSessions.push(...s);
    }
    for (const s of existingSessions) {
      if (s.status === 'skipped') continue;
      addBusy(s.scheduled_date instanceof Date ? dateStr(s.scheduled_date) : s.scheduled_date, toMin(s.scheduled_time), s.duration_minutes || 60, 'study');
    }

    const events = (await pool.query('select * from calendar_events where user_id = $1', [userId])).rows;
    for (const { ds, label } of windowDates) {
      for (const e of events) {
        let hits = false;
        if (e.recurrence === 'weekly') {
          const days = e.recurrence_days || [];
          const inRange = (!e.recurrence_start_date || ds >= e.recurrence_start_date) && (!e.recurrence_end_date || ds <= e.recurrence_end_date);
          hits = days.includes(label) && inRange;
        } else {
          const eDate = e.date instanceof Date ? dateStr(e.date) : e.date;
          hits = eDate === ds;
        }
        if (hits) {
          const start = toMin(e.start_time);
          const end = toMin(e.end_time);
          addBusy(ds, start, (end && start != null ? end - start : 60), `event:${e.title}`);
        }
      }
    }

    const busySummary = windowDates.map(({ ds }) => {
      const blocks = (busyByDate[ds] || []).filter((b) => b.start != null).sort((a, b) => a.start - b.start);
      if (blocks.length === 0) return `${ds}: free`;
      return `${ds}: busy ${blocks.map((b) => `${toTime(b.start)}-${toTime(b.start + b.dur)}`).join(', ')}`;
    }).join('\n');

    const schedule = await invokeLLM({
      usage: llmUsage,
      prompt: `You are an AI study planner. Generate a study schedule for a student preparing for an upcoming assignment. You MUST NOT schedule sessions that overlap the student's existing commitments listed below.

Assignment: ${assignment.title}
Type: ${assignment.type}
Due date: ${assignment.due_date}
Days until due: ${daysUntil}
Class: ${cls?.name}
Coverage scope: ${assignment.coverage_scope}
Number of lectures to cover: ${lectures.length}

Other classes the student is taking: ${allClasses.map((c) => c.name).join(', ')}

The student's existing commitments (DO NOT overlap these — pick free times, typically late afternoon or evening):
${busySummary}

Previous lecture topics in this class:
${lectures.map((l) => `- ${l.date}: ${l.ai_title || (l.ai_summary || '').substring(0, 100) || 'No summary'}`).join('\n')}

Generate ${Math.min(Math.max(daysUntil, 3), 10)} study sessions distributed across the days leading up to the due date. For each session:
- scheduled_date (YYYY-MM-DD, from today up to the due date; spread them out — avoid stacking multiple on the same day)
- scheduled_time (HH:MM, in a FREE slot for that day — never during a listed commitment)
- duration_minutes (45-90)
- priority ("high" closer to the due date or for complex topics, else "medium"/"low")

Higher-priority sessions should cover complex material or happen closer to the due date.`,
      response_json_schema: {
        type: 'object',
        properties: { sessions: { type: 'array', items: { type: 'object', properties: { scheduled_date: { type: 'string' }, scheduled_time: { type: 'string' }, duration_minutes: { type: 'number' }, priority: { type: 'string' } } } } },
      },
    });

    let sessionsToCreate = (schedule.sessions || []).map((s, i) => ({
      assignment_id, user_id: userId, class_id: assignment.class_id,
      title: `${assignment.title} — Session ${i + 1}`,
      scheduled_date: s.scheduled_date, scheduled_time: s.scheduled_time,
      duration_minutes: s.duration_minutes || 60, priority: s.priority || 'medium', status: 'scheduled', notes: null,
    }));

    const placed = {};
    const isFree = (ds, start, dur) => { const against = [...(busyByDate[ds] || []), ...(placed[ds] || [])]; return !against.some((b) => b.start != null && overlaps(start, dur, b.start, b.dur)); };
    const place = (ds, start, dur) => { if (!placed[ds]) placed[ds] = []; placed[ds].push({ start, dur }); };

    for (const s of sessionsToCreate) {
      if (!s.scheduled_date) continue;
      const dur = s.duration_minutes || 60;
      let start = toMin(s.scheduled_time);
      if (start == null || !isFree(s.scheduled_date, start, dur)) {
        let resolved = null;
        for (const cand of CANDIDATE_STARTS) { if (isFree(s.scheduled_date, cand, dur)) { resolved = cand; break; } }
        if (resolved == null) {
          const idx = windowDates.findIndex((w) => w.ds === s.scheduled_date);
          for (let j = idx + 1; j < windowDates.length && resolved == null; j++) {
            for (const cand of CANDIDATE_STARTS) { if (isFree(windowDates[j].ds, cand, dur)) { s.scheduled_date = windowDates[j].ds; resolved = cand; break; } }
          }
        }
        if (resolved != null) start = resolved;
      }
      if (start != null) { s.scheduled_time = toTime(start); place(s.scheduled_date, start, dur); }
    }

    if (assignment.type === 'exam' || assignment.type === 'quiz') {
      const reviewDate = new Date(dueDate); reviewDate.setDate(reviewDate.getDate() - 1);
      const reviewDateStr = dateStr(reviewDate);
      const hasReviewDay = sessionsToCreate.some((s) => s.scheduled_date === reviewDateStr);
      if (!hasReviewDay) {
        let start = null;
        for (const cand of [19 * 60, 20 * 60, 18 * 60, 17 * 60, 21 * 60, 16 * 60]) { if (isFree(reviewDateStr, cand, 45)) { start = cand; break; } }
        if (start == null) start = 19 * 60;
        place(reviewDateStr, start, 45);
        sessionsToCreate.push({
          assignment_id, class_id: assignment.class_id, user_id: userId,
          title: `${assignment.title} — Final review`, scheduled_date: reviewDateStr, scheduled_time: toTime(start),
          duration_minutes: 45, priority: 'high', status: 'scheduled',
          notes: "Light review session — skim key concepts, don't go in depth.",
        });
      } else {
        const existing = sessionsToCreate.find((s) => s.scheduled_date === reviewDateStr);
        existing.title = `${assignment.title} — Final review`;
        existing.notes = "Light review session — skim key concepts, don't go in depth.";
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
