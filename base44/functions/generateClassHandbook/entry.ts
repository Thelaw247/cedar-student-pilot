import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { class_id, lecture_ids, assignment_id } = body;
    if (!class_id) return Response.json({ error: 'class_id is required' }, { status: 400 });

    // Get class info
    let cls = null;
    try { cls = await base44.asServiceRole.entities.Class.get(class_id); } catch (e) { /* skip */ }

    // Get lectures — either specific ids or all for the class
    let lectures = [];
    if (lecture_ids && lecture_ids.length > 0) {
      for (const id of lecture_ids) {
        try {
          const lec = await base44.asServiceRole.entities.Lecture.get(id);
          lectures.push(lec);
        } catch (e) { /* skip */ }
      }
    } else {
      lectures = await base44.asServiceRole.entities.Lecture.filter({ class_id }, '-date');
    }

    // If assignment_id provided, determine exam scope
    let scopeLabel = 'Full Class';
    if (assignment_id) {
      try {
        const asgn = await base44.asServiceRole.entities.Assignment.get(assignment_id);
        if (asgn) {
          scopeLabel = asgn.title || 'Exam Scope';
          if (asgn.coverage_scope === 'since_last' && lectures.length > 0) {
            // Find the last exam/quiz and only include lectures after it
            const allAssignments = await base44.asServiceRole.entities.Assignment.filter({ class_id }, 'due_date');
            const sortedAsgns = allAssignments.filter(a => a.due_date < asgn.due_date).sort((a, b) => b.due_date.localeCompare(a.due_date));
            if (sortedAsgns.length > 0) {
              const lastExamDate = sortedAsgns[0].due_date;
              lectures = lectures.filter(l => l.date >= lastExamDate && l.date <= asgn.due_date);
            }
          }
        }
      } catch (e) { /* skip */ }
    }

    // Filter to lectures with content, sort chronologically
    const lecturesWithContent = lectures
      .filter(l => l.ai_summary || l.transcript || (l.ai_concepts && l.ai_concepts.length > 0))
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    if (lecturesWithContent.length === 0) {
      return Response.json({
        title: cls?.name || 'Class Handbook',
        instructor: cls?.instructor || '',
        scope_label: scopeLabel,
        table_of_contents: [],
        chapters: [],
        message: 'No lecture content available yet. Record and process lectures first.',
      });
    }

    // Get notes for each lecture
    const notesByLecture = {};
    for (const lec of lecturesWithContent) {
      try {
        const notes = await base44.asServiceRole.entities.Note.filter({ lecture_id: lec.id });
        notesByLecture[lec.id] = notes.map(n => n.content || '').filter(Boolean).join('\n\n');
      } catch (e) { /* skip */ }
    }

    // Build chapters
    const chapters = lecturesWithContent.map((lec, idx) => {
      const title = lec.ai_title || `Lecture — ${lec.date}`;
      return {
        chapter_number: idx + 1,
        title,
        lecture_id: lec.id,
        lecture_date: lec.date,
        summary: lec.ai_summary || '',
        concepts: lec.ai_concepts || [],
        definitions: lec.ai_definitions || [],
        formulas: lec.ai_formulas || [],
        vocabulary: lec.ai_vocabulary || [],
        action_items: lec.ai_action_items || [],
        exam_mentions: lec.ai_exam_mentions || [],
        notes: notesByLecture[lec.id] || '',
        transcript_excerpt: (lec.transcript || '').substring(0, 2000),
      };
    });

    // Build table of contents from lecture titles
    const table_of_contents = chapters.map(ch => ({
      chapter: ch.chapter_number,
      title: ch.title,
      lecture_id: ch.lecture_id,
      date: ch.lecture_date,
    }));

    return Response.json({
      title: cls?.name || 'Class Handbook',
      instructor: cls?.instructor || '',
      class_color: cls?.color || '#3B82F6',
      scope_label: scopeLabel,
      is_scoped: !!(lecture_ids && lecture_ids.length > 0) || !!assignment_id,
      total_lectures: lecturesWithContent.length,
      table_of_contents,
      chapters,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});