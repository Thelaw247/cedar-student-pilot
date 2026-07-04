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

    // Update the session with the new time
    await base44.entities.StudySession.update(session_id, {
      scheduled_date: result.new_date,
      scheduled_time: result.new_time,
      status: 'scheduled',
    });

    return Response.json({ success: true, new_date: result.new_date, new_time: result.new_time, reason: result.reason });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});