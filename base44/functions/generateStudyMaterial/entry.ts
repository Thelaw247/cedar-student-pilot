import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Flashcards and quizzes are generated from already-extracted lecture content,
// so this is formatting work rather than analysis. Routed to a cheap fast model
// instead of the app-level default. See processLectureRecording for the wider
// routing rationale.
const CHEAP_MODEL = 'gemini_3_flash';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { class_id, material_type, lecture_range_start, lecture_range_end, lecture_ids } = body;
    if (!class_id || !material_type) return Response.json({ error: 'class_id and material_type are required' }, { status: 400 });

    // Get lectures for the class
    let lectures = await base44.asServiceRole.entities.Lecture.filter({ class_id: class_id }, 'date');

    // Scope selection, in priority order:
    // 1. explicit lecture_ids[] (arbitrary subset chosen via checkboxes)
    // 2. a contiguous range (lecture_range_start..lecture_range_end)
    // 3. otherwise the whole class.
    if (Array.isArray(lecture_ids) && lecture_ids.length > 0) {
      const idSet = new Set(lecture_ids);
      lectures = lectures.filter(l => idSet.has(l.id));
    } else if (lecture_range_start && lecture_range_end) {
      const startIdx = lectures.findIndex(l => l.id === lecture_range_start);
      const endIdx = lectures.findIndex(l => l.id === lecture_range_end);
      if (startIdx >= 0 && endIdx >= 0) {
        lectures = lectures.slice(Math.min(startIdx, endIdx), Math.max(startIdx, endIdx) + 1);
      }
    }

    // Gather transcript content
    const lectureContent = lectures
      .filter(l => l.transcript || l.ai_summary)
      .map(l => `Lecture ${l.date} - ${l.ai_title || 'Untitled'}:\n${l.ai_summary || l.transcript?.substring(0, 1000) || ''}`)
      .join('\n\n---\n\n');

    if (!lectureContent) {
      return Response.json({ error: 'No lecture content available to generate study material' }, { status: 400 });
    }

    const material = await base44.asServiceRole.integrations.Core.InvokeLLM({
      model: CHEAP_MODEL,
      prompt: `You are an AI study material generator. Based on the following university lecture content, generate study material of type "${material_type}".

Lecture content:
${lectureContent.substring(0, 12000)}

Generate ${material_type} based on this content:
- If "flashcards": Generate 10 flashcards with front (question/term) and back (answer/definition)
- If "quiz": Generate 5 multiple-choice questions with 4 options each and the correct answer
- If "practice_test": Generate 8 mixed questions (multiple choice and short answer)
- If "summary_sheet": Generate a comprehensive study summary with key points, organized by topic

Return the appropriate JSON structure.`,
      response_json_schema: {
        type: 'object',
        properties: {
          flashcards: {
            type: 'array',
            items: { type: 'object', properties: { front: { type: 'string' }, back: { type: 'string' } } }
          },
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                question: { type: 'string' },
                answer: { type: 'string' },
                options: { type: 'array', items: { type: 'string' } },
                type: { type: 'string' }
              }
            }
          },
          summary: { type: 'string' }
        }
      }
    });

    // If exactly one lecture is in scope, tag saved materials to it so they
    // show up on that lecture too. Otherwise leave lecture_id null (class-wide).
    const scopedLectureId = lectures.length === 1 ? lectures[0].id : null;
    if (material_type === 'flashcards' && material.flashcards) {
      const flashcards = material.flashcards.map(fc => ({
        lecture_id: scopedLectureId,
        class_id: class_id,
        front: fc.front,
        back: fc.back,
        ai_generated: true
      }));
      await base44.asServiceRole.entities.Flashcard.bulkCreate(flashcards);
    }

    if ((material_type === 'quiz' || material_type === 'practice_test') && material.questions) {
      const questions = material.questions.map(q => ({
        lecture_id: scopedLectureId,
        class_id: class_id,
        question: q.question,
        answer: q.answer,
        options: q.options || [],
        type: q.type || 'multiple_choice',
        ai_generated: true
      }));
      await base44.asServiceRole.entities.PracticeQuestion.bulkCreate(questions);
    }

    return Response.json({ material_type, generated: true, material });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});