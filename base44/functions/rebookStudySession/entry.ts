import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { session_id } = body;
    if (!session_id) return Response.json({ error: 'session_id required' }, { status: 400 });

    const session = await base44.entities.StudySession.get(session_id);
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });

    // Get class context
    const cls = session.class_id ? await base44.entities.Class.get(session.class_id) : null;
    const assignment = session.assignment_id ? await base44.entities.Assignment.get(session.assignment_id) : null;

    // Get other sessions this week to avoid conflicts
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const existing = await base44.entities.StudySession.filter({ class_id: session.class_id });

    const prompt = `You are a study scheduler. A student needs to rebook a study session.
Current session: scheduled for ${session.scheduled_date} at ${session.scheduled_time || 'unspecified time'}, ${session.duration_minutes || 30} minutes, priority ${session.priority}.
Class: ${cls?.name || 'Unknown'}
Assignment: ${assignment?.title || 'General study'}, due ${assignment?.due_date || 'N/A'}
Today is ${today.toISOString().split('T')[0]}.
Other sessions this week: ${existing.filter(s => s.id !== session_id).map(s => `${s.scheduled_date} at ${s.scheduled_time}`).join(', ') || 'none'}

Suggest a new date and time within the next 7 days that:
1. Doesn't conflict with existing sessions
2. Gives enough time before the assignment due date
3. Is at a reasonable study hour (9 AM - 9 PM)

Respond with ONLY a JSON object: {"new_date": "YYYY-MM-DD", "new_time": "HH:MM", "reason": "brief reason"}`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          new_date: { type: 'string' },
          new_time: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    });

    // Validate the AI's date/time before saving
    const todayStr = today.toISOString().split('T')[0];
    let newDate = result.new_date;
    let newTime = result.new_time;

    // Check date format (YYYY-MM-DD) and validity
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    let isValid = dateRegex.test(newDate);
    if (isValid) {
      const parsed = new Date(newDate + 'T00:00:00');
      if (isNaN(parsed.getTime())) isValid = false;
      if (newDate < todayStr) isValid = false; // must be today or future
    }

    // Check time format (HH:MM)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    let timeValid = timeRegex.test(newTime);

    // Fallback: tomorrow at 19:00 if AI returned invalid values
    if (!isValid) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      newDate = tomorrow.toISOString().split('T')[0];
    }
    if (!timeValid) {
      newTime = '19:00';
    }

    await base44.entities.StudySession.update(session_id, {
      scheduled_date: newDate,
      scheduled_time: newTime,
      status: 'scheduled',
    });

    return Response.json({ success: true, new_date: newDate, new_time: newTime, reason: result.reason });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});