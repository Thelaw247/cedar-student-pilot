import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { invokeLLM, createLlmUsage, QUALITY_MODEL } from '../../shared/llm.ts';
import { gateFeature, settleFeature } from '../../shared/credits.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { class_id, date, guidance_notes } = body;
    if (!class_id) return Response.json({ error: 'class_id is required' }, { status: 400 });

    // Get class info
    const cls = await base44.entities.Class.get(class_id);
    if (!cls) return Response.json({ error: 'Class not found' }, { status: 404 });

    // Gate after the class lookup — a missing class is not billable.
    const gate = await gateFeature(base44, user.id, 'missed_summary', { class_id });
    if (!gate.ok) return gate.response!;
    const llmUsage = createLlmUsage();

    // Get previous lectures for context
    const lectures = await base44.entities.Lecture.filter({ class_id: class_id }, '-date');
    const previousLectures = lectures.filter(l => l.transcript).slice(0, 5);
    const previousSummaries = previousLectures.map(l => `${l.date}: ${l.ai_summary || l.transcript?.substring(0, 500) || ''}`).join('\n\n');

    // Optional student-provided guidance (e.g. "we covered chapters 4-5 and
    // did a group problem set") — folded into the same course-progression
    // prompt so it steers the estimate alongside the previous-lecture context,
    // rather than being a separate mechanism.
    const trimmedGuidance = typeof guidance_notes === 'string' ? guidance_notes.trim() : '';
    const guidanceBlock = trimmedGuidance
      ? `\n\nThe student has provided the following notes about what was actually covered — treat this as the most reliable signal available and prioritize it over pure extrapolation from previous lectures:\n${trimmedGuidance}`
      : '';

    // Generate estimated lecture content
    const analysis = await invokeLLM(base44, {
      usage: llmUsage,
      model: QUALITY_MODEL,
      prompt: `You are an AI academic assistant. A student missed a class and wants an AI-estimated summary of what was likely covered.

Class: ${cls.name}
Instructor: ${cls.instructor || 'Unknown'}
Date of missed lecture: ${date || 'Today'}

Previous lecture summaries from this class:
${previousSummaries || 'No previous lectures available.'}${guidanceBlock}

Based on the course progression, previous lecture topics, and any student-provided notes above, generate an estimated lecture summary. This should predict what topics were likely covered, continuing from where the previous lectures left off. Generate:

1. A title for the estimated lecture
2. A summary of likely covered topics
3. Key concepts that were probably discussed
4. Suggested vocabulary terms
5. Suggested action items (review, read, etc.)

IMPORTANT: This is an estimation based on course progression. Be clear that this is AI-estimated content, not actual lecture material.`,
      response_json_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          concepts: { type: 'array', items: { type: 'string' } },
          vocabulary: { type: 'array', items: { type: 'string' } },
          action_items: { type: 'array', items: { type: 'string' } }
        }
      }
    });

    // Create the missed lecture record with AI estimated content. The
    // instructor field is set to 'AI' and pre-confirmed so the UI locks it —
    // this was never taught by a real instructor, and that should never be
    // editable away.
    const lecture = await base44.entities.Lecture.create({
      class_id: class_id,
      date: date || new Date().toISOString().split('T')[0],
      is_missed: true,
      is_ai_estimated: true,
      status: 'complete',
      ai_title: analysis.title,
      ai_summary: analysis.summary,
      ai_concepts: analysis.concepts || [],
      ai_vocabulary: analysis.vocabulary || [],
      ai_action_items: analysis.action_items || [],
      actual_instructor: 'AI',
      instructor_confirmed: true,
      user_id: user.id,
    });

    await settleFeature(base44, gate, {
      feature: 'missed_summary',
      llmUsage,
      extra: { class_id, lecture_id: lecture.id },
    });

    return Response.json({ lecture_id: lecture.id, status: 'complete' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});