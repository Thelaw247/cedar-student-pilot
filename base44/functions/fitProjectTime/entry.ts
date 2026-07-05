import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { assignment_id, additional_minutes } = body;
    if (!assignment_id) return Response.json({ error: 'assignment_id is required' }, { status: 400 });
    if (!additional_minutes || additional_minutes <= 0) return Response.json({ error: 'additional_minutes is required' }, { status: 400 });

    const assignment = await base44.entities.Assignment.get(assignment_id);
    if (!assignment) return Response.json({ error: 'Assignment not found' }, { status: 404 });

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const dueDateStr = assignment.due_date;

    const timeToMin = (t) => {
      if (!t) return 0;
      const parts = t.split(':').map(Number);
      return parts[0] * 60 + (parts[1] || 0);
    };

    // Fetch all calendar events and study sessions for this user
    const [allEvents, allSessions] = await Promise.all([
      base44.entities.CalendarEvent.list(),
      base44.entities.StudySession.list()
    ]);

    // Filter to events between today and due date
    const events = allEvents.filter(e => e.date >= todayStr && e.date <= dueDateStr);
    const sessions = allSessions.filter(s => s.scheduled_date >= todayStr && s.scheduled_date <= dueDateStr && s.status === 'scheduled');

    // Build busy schedule per day
    const busyByDay = {};
    const addBusy = (date, startTime, endTime) => {
      if (!busyByDay[date]) busyByDay[date] = [];
      busyByDay[date].push({ start: timeToMin(startTime), end: timeToMin(endTime) });
    };

    for (const ev of events) {
      if (ev.start_time) {
        addBusy(ev.date, ev.start_time, ev.end_time || ev.start_time);
      }
    }
    for (const ss of sessions) {
      if (ss.scheduled_time) {
        const startMin = timeToMin(ss.scheduled_time);
        const endMin = startMin + (ss.duration_minutes || 60);
        addBusy(ss.scheduled_date, ss.scheduled_time, `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`);
      }
    }

    // Find free gaps (waking hours 8:00-22:00)
    const dayMs = 86400000;
    const startToday = new Date(todayStr + 'T00:00:00');
    const daysUntil = Math.max(0, Math.ceil((new Date(dueDateStr + 'T23:59:59') - startToday) / dayMs));
    const gaps = [];

    for (let i = 0; i <= daysUntil; i++) {
      const d = new Date(startToday);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const busy = (busyByDay[dateStr] || []).sort((a, b) => a.start - b.start);

      const dayStart = 8 * 60;
      const dayEnd = 22 * 60;
      let prevEnd = dayStart;

      for (const b of busy) {
        const bStart = Math.max(b.start, dayStart);
        const bEnd = Math.min(b.end, dayEnd);
        if (bStart > prevEnd) {
          gaps.push({ date: dateStr, start: prevEnd, end: bStart, minutes: bStart - prevEnd });
        }
        prevEnd = Math.max(prevEnd, bEnd);
      }
      if (prevEnd < dayEnd) {
        gaps.push({ date: dateStr, start: prevEnd, end: dayEnd, minutes: dayEnd - prevEnd });
      }
    }

    const usableGaps = gaps.filter(g => g.minutes >= 30);
    const totalFreeMinutes = usableGaps.reduce((sum, g) => sum + g.minutes, 0);

    if (totalFreeMinutes >= additional_minutes) {
      // Schedule sessions in the largest gaps first
      usableGaps.sort((a, b) => b.minutes - a.minutes);
      const sessionsToCreate = [];
      let remaining = additional_minutes;

      // Count existing project sessions for this assignment to determine step index
      const existingProjectSessions = sessions.filter(s => s.assignment_id === assignment_id && s.session_type === 'project');
      let stepBase = existingProjectSessions.length;

      for (const gap of usableGaps) {
        if (remaining <= 0) break;
        const sessionMin = Math.min(gap.minutes, Math.max(30, remaining));
        const startH = Math.floor(gap.start / 60);
        const startM = gap.start % 60;
        const startTime = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;

        const roadmap = assignment.roadmap || [];
        const stepIndex = stepBase < roadmap.length ? stepBase : -1;
        stepBase++;

        sessionsToCreate.push({
          assignment_id,
          class_id: assignment.class_id,
          scheduled_date: gap.date,
          scheduled_time: startTime,
          duration_minutes: sessionMin,
          priority: 'high',
          status: 'scheduled',
          session_type: 'project',
          roadmap_step_index: stepIndex,
          notes: stepIndex >= 0 && roadmap[stepIndex] ? `Project: ${roadmap[stepIndex].title}` : 'Additional project work time'
        });
        remaining -= sessionMin;
      }

      if (sessionsToCreate.length > 0) {
        await base44.entities.StudySession.bulkCreate(sessionsToCreate);
      }

      return Response.json({ scheduled: true, sessions_created: sessionsToCreate.length });
    }

    // Schedule is full — collect events to suggest deleting
    const suggestions = [];
    const priorityRank = { low: 0, medium: 1, high: 2 };

    for (const ev of events) {
      const duration = ev.start_time && ev.end_time
        ? Math.max(30, timeToMin(ev.end_time) - timeToMin(ev.start_time))
        : 60;
      const evPriority = ev.type === 'work' ? 'medium' : (ev.type === 'study' ? 'medium' : 'low');
      suggestions.push({
        id: ev.id,
        entity: 'CalendarEvent',
        title: ev.title,
        date: ev.date,
        time: ev.start_time,
        duration_minutes: duration,
        priority: evPriority,
        type: ev.type || 'custom'
      });
    }

    for (const ss of sessions) {
      if (ss.assignment_id !== assignment_id) {
        suggestions.push({
          id: ss.id,
          entity: 'StudySession',
          title: ss.notes || 'Study Session',
          date: ss.scheduled_date,
          time: ss.scheduled_time,
          duration_minutes: ss.duration_minutes || 60,
          priority: ss.priority || 'medium',
          type: ss.session_type || 'study'
        });
      }
    }

    // Sort: lowest priority first, then soonest date
    suggestions.sort((a, b) => {
      const pr = (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1);
      if (pr !== 0) return pr;
      return (a.date || '').localeCompare(b.date || '');
    });

    return Response.json({
      scheduled: false,
      total_free_minutes: totalFreeMinutes,
      needed_minutes: additional_minutes,
      suggestions: suggestions.slice(0, 12)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});