import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { assignment_id } = body;
    if (!assignment_id) return Response.json({ error: 'assignment_id is required' }, { status: 400 });

    // Get assignment details
    const assignment = await base44.asServiceRole.entities.Assignment.get(assignment_id);
    if (!assignment) return Response.json({ error: 'Assignment not found' }, { status: 404 });

    // Get class and lectures
    const cls = await base44.asServiceRole.entities.Class.get(assignment.class_id);
    const lectures = await base44.asServiceRole.entities.Lecture.filter({ class_id: assignment.class_id }, 'date');

    // Get all classes for workload analysis
    const semesters = await base44.asServiceRole.entities.Semester.filter({ is_active: true });
    let allClasses = [];
    if (semesters.length > 0) {
      allClasses = await base44.asServiceRole.entities.Class.filter({ semester_id: semesters[0].id });
    }

    // Calculate days until due date
    const dueDate = new Date(assignment.due_date);
    const today = new Date();
    const daysUntil = Math.max(1, Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24)));

    // Use AI to generate a study schedule
    const schedule = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are an AI study planner. Generate a study schedule for a student preparing for an upcoming assignment.

Assignment: ${assignment.title}
Type: ${assignment.type}
Due date: ${assignment.due_date}
Days until due: ${daysUntil}
Class: ${cls.name}
Coverage scope: ${assignment.coverage_scope}
Number of lectures to cover: ${lectures.length}

Other classes the student is taking: ${allClasses.map(c => c.name).join(', ')}

Previous lecture topics in this class:
${lectures.map(l => `- ${l.date}: ${l.ai_title || l.ai_summary?.substring(0, 100) || 'No summary'}`).join('\n')}

Generate ${Math.min(Math.max(daysUntil, 3), 10)} study sessions distributed across the days leading up to the due date. For each session, specify:
- scheduled_date (YYYY-MM-DD format, distribute evenly from today to the due date)
- scheduled_time (suggest a reasonable time like "14:00" or "19:00")
- duration_minutes (45-90 minutes depending on priority)
- priority ("high" for sessions closer to the exam or covering complex topics, "medium" or "low" otherwise)

Focus on the most important topics. Higher-priority sessions should cover complex material or happen closer to the due date.`,
      response_json_schema: {
        type: 'object',
        properties: {
          sessions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                scheduled_date: { type: 'string' },
                scheduled_time: { type: 'string' },
                duration_minutes: { type: 'number' },
                priority: { type: 'string' }
              }
            }
          }
        }
      }
    });

    // Create study session entities
    const sessionsToCreate = (schedule.sessions || []).map(s => ({
      assignment_id: assignment_id,
      class_id: assignment.class_id,
      scheduled_date: s.scheduled_date,
      scheduled_time: s.scheduled_time,
      duration_minutes: s.duration_minutes || 60,
      priority: s.priority || 'medium',
      status: 'scheduled'
    }));

    // Always add a review session the day before an exam or quiz
    if (assignment.type === 'exam' || assignment.type === 'quiz') {
      const reviewDate = new Date(dueDate);
      reviewDate.setDate(reviewDate.getDate() - 1);
      const reviewDateStr = reviewDate.toISOString().split('T')[0];
      const hasReviewDay = sessionsToCreate.some(s => s.scheduled_date === reviewDateStr);
      if (!hasReviewDay) {
        sessionsToCreate.push({
          assignment_id: assignment_id,
          class_id: assignment.class_id,
          scheduled_date: reviewDateStr,
          scheduled_time: '19:00',
          duration_minutes: 45,
          priority: 'high',
          status: 'scheduled',
          notes: "Light review session \u2014 skim key concepts, don't go in depth."
        });
      } else {
        const existing = sessionsToCreate.find(s => s.scheduled_date === reviewDateStr);
        existing.notes = "Light review session \u2014 skim key concepts, don't go in depth.";
      }
    }

    if (sessionsToCreate.length > 0) {
      await base44.asServiceRole.entities.StudySession.bulkCreate(sessionsToCreate);
    }

    return Response.json({ sessions_created: sessionsToCreate.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});