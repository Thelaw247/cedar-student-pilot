import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { invokeLLM, createLlmUsage } from '../lib/llm.js';
import { gateFeature, settleFeature } from '../lib/credits.js';
import { normalizeQuizQuestions, QUIZ_QUESTION_SCHEMA, QUIZ_FORMAT_RULES } from '../lib/quizQuestions.js';

// Direct port of base44/functions/generateSessionReview/entry.ts. Since 2 Sep
// 2026 the questions are multiple choice only and validated server-side
// (lib/quizQuestions.js); the old problem/short-answer mix is gone.

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

    // Quantitative classes still get real problems — they are just posed as
    // multiple choice with numeric distractors that come from the classic
    // mistakes (wrong sign, wrong unit, a skipped step).
    const questionTypeInstruction = isComplex
      ? `Generate a review with EXACTLY 8 multiple-choice questions:
- 3 problem-solving questions: a complete, solvable problem statement using the concepts and formulas from the lectures; the options are four candidate final answers (with units where relevant) and the distractors are the results of common mistakes.
- 5 conceptual questions testing understanding of the material.`
      : `Generate a review with EXACTLY 8 multiple-choice questions that test real understanding, not just memorization. Vary difficulty. Use concepts from the lectures.`;

    const result = await invokeLLM({
      usage: llmUsage,
      prompt: `You are an academic tutor creating a study session review quiz for the class "${cls?.name || 'this class'}".

${questionTypeInstruction}

${QUIZ_FORMAT_RULES}

Also generate 5 self-assessment topics that the student should rate their proficiency on.

LECTURE CONTENT:
${lectureContext}

Return a JSON object with:
- review_questions: array of {type: "multiple_choice", question, options (exactly 4), correct_answer, explanation, concept (the concept being tested)}
- self_assessment_topics: array of {topic, concept} - things like "Understanding of X", "Ability to apply Y formula", etc.`,
      response_json_schema: {
        type: 'object',
        properties: {
          review_questions: { type: 'array', items: QUIZ_QUESTION_SCHEMA },
          self_assessment_topics: { type: 'array', items: { type: 'object', properties: { topic: { type: 'string' }, concept: { type: 'string' } } } },
        },
      },
    });

    await settleFeature(gate, { feature: 'session_review', llmUsage, extra: { class_id } });

    const { questions, dropped } = normalizeQuizQuestions(result?.review_questions);
    if (dropped > 0) console.warn(`[session-review] dropped ${dropped} malformed question(s) from the model for user ${userId}`);

    res.json({
      review_questions: questions, self_assessment_topics: result.self_assessment_topics || [],
      total_concepts: uniqueConcepts.length, lecture_ids: lecturesWithContent.map((l) => l.id),
      all_concepts: uniqueConcepts, is_complex: isComplex,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
