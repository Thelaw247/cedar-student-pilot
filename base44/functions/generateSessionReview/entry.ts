import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { class_id, lecture_ids } = body;
    if (!class_id) return Response.json({ error: 'class_id is required' }, { status: 400 });

    // Get class info to detect complex/problem-solving classes
    let cls = null;
    try {
      cls = await base44.entities.Class.get(class_id);
    } catch (e) { /* class might not exist */ }
    const className = (cls?.name || '').toLowerCase();

    const complexKeywords = ['calculus', 'math', 'physics', 'chemistry', 'engineering', 'statistics', 'algebra', 'geometry', 'trigonometry', 'differential', 'linear algebra', 'discrete', 'economics', 'finance', 'accounting', 'probability'];
    const isComplex = complexKeywords.some(kw => className.includes(kw));

    // Get lectures for the class (either specific ones or all recent)
    let lectures;
    if (lecture_ids && lecture_ids.length > 0) {
      lectures = [];
      for (const id of lecture_ids) {
        try {
          const lec = await base44.entities.Lecture.get(id);
          lectures.push(lec);
        } catch (e) { /* skip */ }
      }
    } else {
      lectures = await base44.entities.Lecture.filter({ class_id }, '-date', 10);
    }

    // Filter to lectures that have AI content
    const lecturesWithContent = lectures.filter(l => l.ai_summary || l.transcript || (l.ai_concepts && l.ai_concepts.length > 0));

    if (lecturesWithContent.length === 0) {
      return Response.json({
        review_questions: [],
        self_assessment_topics: [],
        total_concepts: 0,
        message: 'No lecture content available for review yet. Record or process lectures first.'
      });
    }

    // Build context from lectures
    const lectureContext = lecturesWithContent.map(l => {
      const concepts = (l.ai_concepts || []).join(', ');
      const vocab = (l.ai_vocabulary || []).join(', ');
      const defs = (l.ai_definitions || []).map(d => `${d.term}: ${d.definition}`).join('; ');
      const formulas = (l.ai_formulas || []).join(', ');
      const summary = l.ai_summary || '';
      const title = l.ai_title || `Lecture on ${l.date}`;
      return `--- ${title} ---\nSummary: ${summary}\nKey Concepts: ${concepts}\nVocabulary: ${vocab}\nDefinitions: ${defs}\nFormulas: ${formulas}`;
    }).join('\n\n');

    const allConcepts = lecturesWithContent.flatMap(l => l.ai_concepts || []);
    const uniqueConcepts = [...new Set(allConcepts)];

    const questionTypeInstruction = isComplex
      ? `Generate a review with EXACTLY 8 questions:
- 3 actual problem-solving questions (type: "problem") — real problems the student must solve step by step, like exam problems. The "question" field contains the full problem statement. The "correct_answer" is the final answer. The student will solve it and submit their answer. Make problems that use the concepts and formulas from the lectures.
- 3 multiple choice questions (4 options each)
- 2 short answer questions (1-2 sentence answers)`
      : `Generate a review with EXACTLY 8 questions mixing these types:
- 3 multiple choice questions (4 options each)
- 3 short answer questions (1-2 sentence answers)
- 2 one-word answer questions`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are an academic tutor creating a study session review quiz for the class "${cls?.name || 'this class'}".

${questionTypeInstruction}

Also generate 5 self-assessment topics that the student should rate their proficiency on.

LECTURE CONTENT:
${lectureContext}

Return a JSON object with:
- review_questions: array of {type, question, options (array, empty for non-MC), correct_answer, concept (the concept being tested)}
- self_assessment_topics: array of {topic, concept} - things like "Understanding of X", "Ability to apply Y formula", etc.

${isComplex ? 'For problem questions, make them actual solvable problems based on the concepts and formulas from the lectures. The student should be able to solve them using the knowledge covered. Put the complete problem statement in the "question" field and just the final answer in "correct_answer".' : 'Make questions that test real understanding, not just memorization. Vary difficulty. Use concepts from the lectures.'}`,
      response_json_schema: {
        type: 'object',
        properties: {
          review_questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['multiple_choice', 'short_answer', 'one_word', 'problem'] },
                question: { type: 'string' },
                options: { type: 'array', items: { type: 'string' } },
                correct_answer: { type: 'string' },
                concept: { type: 'string' }
              }
            }
          },
          self_assessment_topics: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                topic: { type: 'string' },
                concept: { type: 'string' }
              }
            }
          }
        }
      }
    });

    return Response.json({
      review_questions: result.review_questions || [],
      self_assessment_topics: result.self_assessment_topics || [],
      total_concepts: uniqueConcepts.length,
      lecture_ids: lecturesWithContent.map(l => l.id),
      all_concepts: uniqueConcepts,
      is_complex: isComplex
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});