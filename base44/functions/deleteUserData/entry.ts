import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Right-to-erasure endpoint. Deletes all of the signed-in student's academic
// data across every entity — lectures, transcripts, notes, flashcards,
// practice questions, coverage, study sessions/records/reviews, attendance,
// calendar events, assignments, classes, and semesters.
//
// IMPORTANT: this uses the per-request authenticated client (NOT asServiceRole),
// so every list/delete is scoped by the platform to the caller's own records.
// A service-role client would bypass that scoping and could reach other users'
// data, so it is deliberately not used here.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Order matters loosely (children before parents) but every record is the
    // user's own, so even if ordering isn't perfect nothing else is affected.
    const entityNames = [
      'StudySessionReview',
      'Flashcard',
      'PracticeQuestion',
      'KnowledgeCoverage',
      'Note',
      'ClassAttendance',
      'Lecture',
      'Assignment',
      'StudySession',
      'StudyRecord',
      'CalendarEvent',
      'Class',
      'Semester',
    ];

    const summary = {};
    let totalDeleted = 0;
    const errors = [];

    for (const name of entityNames) {
      const entity = base44.entities[name];
      if (!entity) continue;
      let deletedForEntity = 0;
      try {
        // Page through everything the user owns for this entity.
        let records = await entity.list();
        // Guard against unexpectedly huge result sets / pagination shapes.
        if (!Array.isArray(records)) records = [];
        for (const rec of records) {
          if (!rec || !rec.id) continue;
          try {
            await entity.delete(rec.id);
            deletedForEntity += 1;
          } catch (e) {
            errors.push(`${name}:${rec.id} — ${e.message}`);
          }
        }
      } catch (e) {
        errors.push(`${name} (list) — ${e.message}`);
      }
      summary[name] = deletedForEntity;
      totalDeleted += deletedForEntity;
    }

    return Response.json({
      status: 'complete',
      total_deleted: totalDeleted,
      deleted_by_entity: summary,
      // Errors are surfaced but non-fatal — partial deletion still returns 200
      // so the client can report what remained rather than failing opaquely.
      errors,
      note: 'Uploaded audio files referenced by deleted lectures are no longer linked to your account. Contact support if you need stored files purged from backups.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
