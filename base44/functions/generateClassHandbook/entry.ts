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
        ai_expansion: '',
      };
    });

    // Minimal AI gap-filling: only for chapters that are clearly under-covered,
    // and capped so a large handbook doesn't fan out into many LLM calls. The
    // result is stored in its OWN field (ai_expansion) and never merged into
    // the summary or transcript, so the UI can label it as AI-added and the
    // professor's actual words stay cleanly separated.
    const MAX_EXPANSIONS = 6;
    // A chapter looks thin when there's little captured content to work from.
    const isThin = (ch) => {
      const transcriptLen = (ch.transcript_excerpt || '').length;
      const conceptCount = (ch.concepts || []).length + (ch.definitions || []).length;
      return transcriptLen < 800 || conceptCount <= 2;
    };
    const thinChapters = chapters.filter(isThin).slice(0, MAX_EXPANSIONS);
    for (const ch of thinChapters) {
      try {
        const expandResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are helping a university student study "${cls?.name || 'a class'}". Below is what was captured from one lecture. Parts of it look thinly covered — either the recording was short or some topics were only mentioned in passing.

Your job: briefly fill in ONLY the clear gaps in the topics that were ALREADY introduced in this lecture. This is supplementary context to make the student's notes usable — not a rewrite.

Strict rules:
- Only expand on concepts, terms, or topics that already appear below. Do NOT introduce new topics the lecture didn't touch.
- Keep it short: at most 2-3 tight paragraphs, or a few bullet-style sentences. Fill gaps, don't pad.
- Write it as neutral, standard explanation. Do NOT imitate or invent the professor's wording or claim the professor said something they didn't.
- If the material below is already adequately covered and needs no filling in, return an empty string.

Lecture title: ${ch.title}
Summary: ${ch.summary || '(none)'}
Concepts: ${(ch.concepts || []).join(', ') || '(none)'}
Definitions: ${(ch.definitions || []).map(d => d.term).join(', ') || '(none)'}
Transcript excerpt: ${ch.transcript_excerpt || '(none)'}

Return ONLY the supplementary explanation text (or an empty string if none is needed). No preamble.`,
        });
        const expansion = typeof expandResult === 'string' ? expandResult : (expandResult.text || '');
        if (expansion && expansion.trim().length > 0) {
          ch.ai_expansion = expansion.trim();
        }
      } catch (e) { /* non-fatal: a chapter simply gets no expansion */ }
    }

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