import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const semesters = await base44.entities.Semester.filter({ is_active: true });
    if (semesters.length === 0) {
      return Response.json({ error: 'No active semester found' }, { status: 400 });
    }

    const classes = await base44.entities.Class.filter({ semester_id: semesters[0].id });
    const exportData = {
      exported_at: new Date().toISOString(),
      semester: semesters[0],
      classes: [],
      lectures: [],
      notes: [],
      study_records: [],
      study_sessions: [],
      calendar_events: [],
    };

    for (const cls of classes) {
      exportData.classes.push(cls);
      const lectures = await base44.entities.Lecture.filter({ class_id: cls.id });
      exportData.lectures.push(...lectures);
      const assignments = await base44.entities.Assignment.filter({ class_id: cls.id });
      for (const a of assignments) a._class_name = cls.name;
      exportData.classes[exportData.classes.length - 1]._assignments = assignments;
      const notes = await base44.entities.Note.filter({ class_id: cls.id });
      exportData.notes.push(...notes);
    }

    const studyRecords = await base44.entities.StudyRecord.list();
    exportData.study_records = studyRecords;
    const studySessions = await base44.entities.StudySession.list();
    exportData.study_sessions = studySessions;
    const events = await base44.entities.CalendarEvent.list();
    exportData.calendar_events = events;

    const jsonStr = JSON.stringify(exportData, null, 2);

    return new Response(jsonStr, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename=cedar-export-${new Date().toISOString().split('T')[0]}.json`,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});