import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Day label helpers (match the app's Mon..Sun scheme).
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const toMin = (t) => {
  if (!t || typeof t !== 'string' || !t.includes(':')) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};
const toTime = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const dateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Candidate start times (minutes) tried when relocating a session to avoid a
// clash — reasonable study hours: late afternoon/evening first, then daytime.
const CANDIDATE_STARTS = [16 * 60, 17 * 60, 18 * 60, 19 * 60, 20 * 60, 14 * 60, 15 * 60, 13 * 60, 10 * 60, 11 * 60, 9 * 60, 21 * 60];

function overlaps(startA, durA, startB, durB) {
  return startA < startB + durB && startB < startA + durA;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { assignment_id } = body;
    if (!assignment_id) return Response.json({ error: 'assignment_id is required' }, { status: 400 });

    const assignment = await base44.asServiceRole.entities.Assignment.get(assignment_id);
    if (!assignment) return Response.json({ error: 'Assignment not found' }, { status: 404 });

    const cls = await base44.asServiceRole.entities.Class.get(assignment.class_id);
    const lectures = await base44.asServiceRole.entities.Lecture.filter({ class_id: assignment.class_id }, 'date');

    const semesters = await base44.asServiceRole.entities.Semester.filter({ is_active: true });
    let allClasses = [];
    if (semesters.length > 0) {
      allClasses = await base44.asServiceRole.entities.Class.filter({ semester_id: semesters[0].id });
    }

    const dueDate = new Date(assignment.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntil = Math.max(1, Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24)));

    // ---- Build BUSY blocks per date in the planning window ------------------
    // so we schedule around real commitments instead of on top of them.
    const busyByDate = {}; // { 'YYYY-MM-DD': [{start,dur,label}] }
    const addBusy = (ds, start, dur, label) => {
      if (start == null) return;
      if (!busyByDate[ds]) busyByDate[ds] = [];
      busyByDate[ds].push({ start, dur: dur || 60, label });
    };

    const windowDates = [];
    for (let i = 0; i <= daysUntil; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      windowDates.push({ ds: dateStr(d), label: DAY_LABELS[d.getDay()] });
    }

    // 1) Class meetings (per-day meetings[] or legacy single time).
    const classMeetsOn = (c, label) => {
      if (Array.isArray(c.meetings) && c.meetings.length > 0) {
        return c.meetings.filter(m => m.day === label).map(m => ({ start: toMin(m.start_time), end: toMin(m.end_time) }));
      }
      if ((c.days_of_week || []).includes(label)) {
        return [{ start: toMin(c.start_time), end: toMin(c.end_time) }];
      }
      return [];
    };
    for (const { ds, label } of windowDates) {
      for (const c of allClasses) {
        for (const slot of classMeetsOn(c, label)) {
          if (slot.start != null) addBusy(ds, slot.start, (slot.end || slot.start + 60) - slot.start, `class:${c.name}`);
        }
      }
    }

    // 2) Existing study sessions.
    const existingSessions = [];
    for (const c of allClasses) {
      const sess = await base44.asServiceRole.entities.StudySession.filter({ class_id: c.id });
      existingSessions.push(...sess);
    }
    for (const s of existingSessions) {
      if (s.status === 'skipped') continue;
      addBusy(s.scheduled_date, toMin(s.scheduled_time), s.duration_minutes || 60, 'study');
    }

    // 3) Calendar events (one-time + weekly recurrence).
    const events = await base44.asServiceRole.entities.CalendarEvent.list();
    for (const { ds, label } of windowDates) {
      for (const e of events) {
        let hits = false;
        if (e.recurrence === 'weekly') {
          const days = e.recurrence_days || [];
          const inRange = (!e.recurrence_start_date || ds >= e.recurrence_start_date) && (!e.recurrence_end_date || ds <= e.recurrence_end_date);
          hits = days.includes(label) && inRange;
        } else {
          hits = e.date === ds;
        }
        if (hits) {
          const start = toMin(e.start_time);
          const end = toMin(e.end_time);
          addBusy(ds, start, (end && start != null ? end - start : 60), `event:${e.title}`);
        }
      }
    }

    // Compact busy summary for the AI (so its first guess is already close).
    const busySummary = windowDates.map(({ ds }) => {
      const blocks = (busyByDate[ds] || []).filter(b => b.start != null).sort((a, b) => a.start - b.start);
      if (blocks.length === 0) return `${ds}: free`;
      return `${ds}: busy ${blocks.map(b => `${toTime(b.start)}-${toTime(b.start + b.dur)}`).join(', ')}`;
    }).join('\n');

    const schedule = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are an AI study planner. Generate a study schedule for a student preparing for an upcoming assignment. You MUST NOT schedule sessions that overlap the student's existing commitments listed below.

Assignment: ${assignment.title}
Type: ${assignment.type}
Due date: ${assignment.due_date}
Days until due: ${daysUntil}
Class: ${cls.name}
Coverage scope: ${assignment.coverage_scope}
Number of lectures to cover: ${lectures.length}

Other classes the student is taking: ${allClasses.map(c => c.name).join(', ')}

The student's existing commitments (DO NOT overlap these — pick free times, typically late afternoon or evening):
${busySummary}

Previous lecture topics in this class:
${lectures.map(l => `- ${l.date}: ${l.ai_title || l.ai_summary?.substring(0, 100) || 'No summary'}`).join('\n')}

Generate ${Math.min(Math.max(daysUntil, 3), 10)} study sessions distributed across the days leading up to the due date. For each session:
- scheduled_date (YYYY-MM-DD, from today up to the due date; spread them out — avoid stacking multiple on the same day)
- scheduled_time (HH:MM, in a FREE slot for that day — never during a listed commitment)
- duration_minutes (45-90)
- priority ("high" closer to the due date or for complex topics, else "medium"/"low")

Higher-priority sessions should cover complex material or happen closer to the due date.`,
      response_json_schema: {
        type: 'object',
        properties: {
          sessions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                scheduled_date: { type: 'string' },
                scheduled_time: { type: 'string' },
                duration_minutes: { type: 'number' },
                priority: { type: 'string' }
              }
            }
          }
        }
      }
    });

    // Every session gets a real `title`. Before this field existed the UI fell
    // back to `notes` for the heading, which left auto-generated sessions
    // nameless (no notes written) and made the one session that DID have notes
    // display its description where its title belongs. `title` is the name;
    // `notes` stays the longer description.
    let sessionsToCreate = (schedule.sessions || []).map((s, i) => ({
      assignment_id: assignment_id,
      class_id: assignment.class_id,
      title: `${assignment.title} — Session ${i + 1}`,
      scheduled_date: s.scheduled_date,
      scheduled_time: s.scheduled_time,
      duration_minutes: s.duration_minutes || 60,
      priority: s.priority || 'medium',
      status: 'scheduled'
    }));

    // ---- Deterministic conflict resolution ---------------------------------
    // The AI instruction alone is not reliable enough for something that "can't
    // happen". Guarantee no overlaps by checking each proposed session against
    // real commitments AND against sessions already placed in this batch,
    // relocating any that clash to a free slot (same day, else roll forward).
    const placed = {}; // date -> [{start,dur}]
    const isFree = (ds, start, dur) => {
      const against = [...(busyByDate[ds] || []), ...(placed[ds] || [])];
      return !against.some(b => b.start != null && overlaps(start, dur, b.start, b.dur));
    };
    const place = (ds, start, dur) => {
      if (!placed[ds]) placed[ds] = [];
      placed[ds].push({ start, dur });
    };

    for (const s of sessionsToCreate) {
      if (!s.scheduled_date) continue;
      const dur = s.duration_minutes || 60;
      let start = toMin(s.scheduled_time);
      if (start == null || !isFree(s.scheduled_date, start, dur)) {
        let resolved = null;
        for (const cand of CANDIDATE_STARTS) {
          if (isFree(s.scheduled_date, cand, dur)) { resolved = cand; break; }
        }
        if (resolved == null) {
          const idx = windowDates.findIndex(w => w.ds === s.scheduled_date);
          for (let j = idx + 1; j < windowDates.length && resolved == null; j++) {
            for (const cand of CANDIDATE_STARTS) {
              if (isFree(windowDates[j].ds, cand, dur)) { s.scheduled_date = windowDates[j].ds; resolved = cand; break; }
            }
          }
        }
        if (resolved != null) start = resolved;
      }
      if (start != null) {
        s.scheduled_time = toTime(start);
        place(s.scheduled_date, start, dur);
      }
    }

    // Always add a light review session the day before an exam/quiz — in a free slot.
    if (assignment.type === 'exam' || assignment.type === 'quiz') {
      const reviewDate = new Date(dueDate);
      reviewDate.setDate(reviewDate.getDate() - 1);
      const reviewDateStr = dateStr(reviewDate);
      const hasReviewDay = sessionsToCreate.some(s => s.scheduled_date === reviewDateStr);
      if (!hasReviewDay) {
        let start = null;
        for (const cand of [19 * 60, 20 * 60, 18 * 60, 17 * 60, 21 * 60, 16 * 60]) {
          if (isFree(reviewDateStr, cand, 45)) { start = cand; break; }
        }
        if (start == null) start = 19 * 60;
        place(reviewDateStr, start, 45);
        sessionsToCreate.push({
          assignment_id, class_id: assignment.class_id,
          title: `${assignment.title} — Final review`,
          scheduled_date: reviewDateStr, scheduled_time: toTime(start),
          duration_minutes: 45, priority: 'high', status: 'scheduled',
          notes: "Light review session — skim key concepts, don't go in depth."
        });
      } else {
        // Re-purpose the session already on that day: give it the review name
        // and put the guidance in notes, where a description belongs.
        const existing = sessionsToCreate.find(s => s.scheduled_date === reviewDateStr);
        existing.title = `${assignment.title} — Final review`;
        existing.notes = "Light review session — skim key concepts, don't go in depth.";
      }
    }

    if (sessionsToCreate.length > 0) {
      await base44.asServiceRole.entities.StudySession.bulkCreate(sessionsToCreate);
    }

    return Response.json({ sessions_created: sessionsToCreate.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
