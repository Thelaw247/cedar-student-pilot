import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Resolve an assignment (mark it completed/archived, reactivate it, or delete
// it outright) and clean up the study sessions tied to it. Leftover
// 'scheduled' sessions for a past assignment are what keep firing "missed
// study sessions" warnings and cluttering the planner, so resolving flips
// them to 'skipped' (kept as history, but out of every "upcoming / behind"
// view). Deleting goes further: since sessions only exist to prep for the
// assignment they're tied to, a deleted assignment removes them outright
// rather than leaving orphaned rows around.
//
// action:
//   'completed'  -> assignment done; clear its still-scheduled sessions
//   'archived'   -> hide assignment; clear its still-scheduled sessions
//   'reactivate' -> set back to active; sessions are left as-is
//   'deleted'    -> permanently delete the assignment AND every session tied
//                   to it (regardless of status), then remove the assignment
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
    if (!['completed', 'archived', 'reactivate', 'deleted'].includes(action)) {
      return Response.json({ error: 'action must be completed, archived, reactivate, or deleted' }, { status: 400 });
    }

    // Confirm the assignment exists and belongs to the caller (scoped client).
    let assignment;
    try {
      assignment = await base44.entities.Assignment.get(assignment_id);
    } catch (e) {
      return Response.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // Deletion is a distinct path: remove every linked session outright (not
    // just the scheduled ones), then remove the assignment itself.
    if (action === 'deleted') {
      let deletedSessions = 0;
      let sessions = [];
      try {
        sessions = await base44.entities.StudySession.filter({ assignment_id });
      } catch (e) {
        sessions = [];
      }
      for (const s of sessions) {
        if (s && s.id) {
          try {
            await base44.entities.StudySession.delete(s.id);
            deletedSessions += 1;
          } catch (e) { /* non-fatal: continue clearing the rest */ }
        }
      }
      await base44.entities.Assignment.delete(assignment_id);

      return Response.json({
        status: 'complete',
        assignment_id,
        deleted: true,
        cleared_sessions: deletedSessions,
      });
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
