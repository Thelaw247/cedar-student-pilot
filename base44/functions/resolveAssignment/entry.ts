import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Resolve an assignment (mark it completed or archived) and clean up the study
// sessions that were scheduled specifically for it. Leftover 'scheduled'
// sessions for a past assignment are what keep firing "missed study sessions"
// warnings and cluttering the planner, so resolving flips them to 'skipped'
// (kept as history, but out of every "upcoming / behind" view).
//
// action:
//   'completed'  -> assignment done; clear its still-scheduled sessions
//   'archived'   -> hide assignment; clear its still-scheduled sessions
//   'reactivate' -> set back to active; sessions are left as-is
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { assignment_id, action } = body;
    if (!assignment_id || !action) {
      return Response.json({ error: 'assignment_id and action are required' }, { status: 400 });
    }
    if (!['completed', 'archived', 'reactivate'].includes(action)) {
      return Response.json({ error: 'action must be completed, archived, or reactivate' }, { status: 400 });
    }

    // Confirm the assignment exists and belongs to the caller (scoped client).
    let assignment;
    try {
      assignment = await base44.entities.Assignment.get(assignment_id);
    } catch (e) {
      return Response.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const newStatus = action === 'reactivate' ? 'active' : action;
    await base44.entities.Assignment.update(assignment_id, { status: newStatus });

    let clearedSessions = 0;
    if (action === 'completed' || action === 'archived') {
      // Clear only sessions tied to THIS assignment that are still pending.
      // Completed/skipped sessions are left untouched so history is preserved.
      let sessions = [];
      try {
        sessions = await base44.entities.StudySession.filter({ assignment_id });
      } catch (e) {
        sessions = [];
      }
      for (const s of sessions) {
        if (s && s.id && s.status === 'scheduled') {
          try {
            await base44.entities.StudySession.update(s.id, { status: 'skipped' });
            clearedSessions += 1;
          } catch (e) { /* non-fatal: continue clearing the rest */ }
        }
      }
    }

    return Response.json({
      status: 'complete',
      assignment_id,
      new_status: newStatus,
      cleared_sessions: clearedSessions,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
