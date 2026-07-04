import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { message } = body;
    if (!message) return Response.json({ error: 'message is required' }, { status: 400 });

    // Gather student context: all classes, lectures, notes
    const semesters = await base44.asServiceRole.entities.Semester.filter({ is_active: true });
    let contextParts = [];

    if (semesters.length > 0) {
      const classes = await base44.asServiceRole.entities.Class.filter({ semester_id: semesters[0].id });
      
      for (const cls of classes) {
        const lectures = await base44.asServiceRole.entities.Lecture.filter({ class_id: cls.id }, '-date');
        const lectureSummaries = lectures
          .filter(l => l.ai_summary || l.transcript)
          .slice(0, 15)
          .map(l => `  [${l.date}] ${l.ai_title || 'Untitled'}: ${(l.ai_summary || l.transcript?.substring(0, 300) || '').substring(0, 300)}`)
          .join('\n');
        
        if (lectureSummaries) {
          contextParts.push(`Class: ${cls.name} (Instructor: ${cls.instructor || 'Unknown'})\nLectures:\n${lectureSummaries}`);
        }
      }
    }

    // Get upcoming assignments and events
    const today = new Date().toISOString().split('T')[0];
    let assignmentContext = [];
    const allClasses = semesters.length > 0 
      ? await base44.asServiceRole.entities.Class.filter({ semester_id: semesters[0].id })
      : [];
    
    for (const cls of allClasses) {
      const assignments = await base44.asServiceRole.entities.Assignment.filter({ class_id: cls.id });
      for (const a of assignments) {
        assignmentContext.push(`${a.title} (${a.type}) for ${cls.name} - due ${a.due_date}`);
      }
    }

    const context = contextParts.join('\n\n---\n\n');
    const assignmentInfo = assignmentContext.length > 0 
      ? `\n\nUpcoming assignments:\n${assignmentContext.join('\n')}` 
      : '';

    // Generate answer using AI with full student context
    const answer = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are an AI academic assistant for a university student. The student asks you questions about their courses, lectures, and schedule.

You have access to the student's entire academic context — all recorded lectures, transcripts, summaries, notes, and assignments. Use this context to provide accurate, helpful answers.

When answering:
- Reference specific lectures by date and topic
- Quote from lecture summaries when relevant
- Point the student to specific lectures they should review
- Be concise but thorough
- If the question is about a topic not covered in their lectures, say so and suggest what to review

Student's academic context:
${context}${assignmentInfo}

Student question: ${message}

Provide a helpful, accurate answer based on the student's actual lecture content. If you reference a specific lecture, mention its date.`,
      add_context_from_internet: false
    });

    return Response.json({ answer });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});