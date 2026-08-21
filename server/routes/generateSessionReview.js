import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { invokeLLM, createLlmUsage } from '../lib/llm.js';
import { gateFeature, settleFeature } from '../lib/credits.js';

// Direct port of base44/functions/generateSessionReview/entry.ts.

const router = express.Router();
const COMPLEX_KEYWORDS = ['calculus', 'math', 'physics', 'chemistry', 'engineering', 'statistics', 'algebra', 'geometry', 'trigonometry', 'differential', 'linear algebra', 'discrete', 'economics', 'finance', 'accounting', 'probability'];

router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { class_id, lecture_ids } = req.body || {};
    if (!class_id) return res.status(400).json({ error: 'class_id is required' });

    const cls = (await pool.query('select * from classes where id = $1 and user_id = $2', [class_id, userId])).rows[0] || null;
    const className = (cls?.name || '').toLowerCase();
    const isComplex = COMPLEX_KEYWORDS.some((kw) => className.includes(kw));

    let lectures;
    if (lecture_ids && lecture_ids.length > 0) {
      lectures = (await pool.query('select * from lectures where id = any($1::uuid[]) and user_id = $2', [lecture_ids, userId])).rows;
    } else {
      lectures = (await pool.query('select * from lectures where class_id = $1 and user_id = $2 order by date desc limit 10', [class_id, userId])).rows;
    }

    const lecturesWithContent = lectures.filter((l) => l.ai_summary || l.transcript || (l.ai_concepts || []).length > 0);
    if (lecturesWithContent.length === 0) {
      return res.json({ review_questions: [], self_assessment_topics: [], total_concepts: 0, message: 'No lecture content available for review yet. Record or process lectures first.' });
    }

    const gate = await gateFeature(userId, 'session_review', res);
    if (!gate.ok) return;
    const llmUsage = createLlmUsage();

    const lectureContext = lecturesWithContent.map((l) => {
      const concepts = (l.ai_concepts || []).join(', ');
      const vocab = (l.ai_vocabulary || []).join(', ');
      const defs = (l.ai_definitions || []).map((d) => `${d.term}: ${d.definition}`).join('; ');
      const formulas = (l.ai_formulas || []).join(', ');
      const title = l.ai_title || `Lecture on ${l.date}`;
      return `--- ${title} ---\nSummary: ${l.ai_summary || ''}\nKey Concepts: ${concepts}\nVocabulary: ${vocab}\nDefinitions: ${defs}\nFormulas: ${formulas}`;
    }).join('\n\n');

    const uniqueConcepts = [...new Set(lecturesWithContent.flatMap((l) => l.ai_concepts || []))];

    const questionTypeInstruction = isComplex
      ? `Generate a review with EXACTLY 8 questions:
- 3 actual problem-solving questions (type: "problem") — real problems the student must solve step by step, like exam problems. The "question" field contains the full problem statement. The "correct_answer" is the final answer. The student will solve it and submit their answer. Make problems that use the concepts and formulas from the lectures.
- 3 multiple choice questions (4 options each)
- 2 short answer questions (1-2 sentence answers)`
      : `Generate a review with EXACTLY 8 questions mixing these types:
- 3 multiple choice questions (4 options each)
- 3 short answer questions (1-2 sentence answers)
- 2 one-word answer questions`;

    const result = await invokeLLM({
      usage: llmUsage,
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
          review_questions: { type: 'array', items: { type: 'object', properties: { type: { type: 'string', enum: ['multiple_choice', 'short_answer', 'one_word', 'problem'] }, question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, correct_answer: { type: 'string' }, concept: { type: 'string' } } } },
          self_assessment_topics: { type: 'array', items: { type: 'object', properties: { topic: { type: 'string' }, concept: { type: 'string' } } } },
        },
      },
    });

    await settleFeature(gate, { feature: 'session_review', llmUsage, extra: { class_id } });

    res.json({
      review_questions: result.review_questions || [], self_assessment_topics: result.self_assessment_topics || [],
      total_concepts: uniqueConcepts.length, lecture_ids: lecturesWithContent.map((l) => l.id),
      all_concepts: uniqueConcepts, is_complex: isComplex,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
