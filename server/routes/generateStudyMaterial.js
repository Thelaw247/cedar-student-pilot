import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { invokeLLM, createLlmUsage } from '../lib/llm.js';
import { gateFeature, settleFeature, logUsage } from '../lib/credits.js';
import { usableFlashcards } from '../lib/flashcards.js';
import { normalizeQuizQuestions, QUIZ_QUESTION_SCHEMA, QUIZ_FORMAT_RULES } from '../lib/quizQuestions.js';

// Direct port of base44/functions/generateStudyMaterial/entry.ts, with the
// question path rebuilt on 4 Sep 2026.
//
// Quiz and Practice Test in the Study > Practice tab had never once
// succeeded — usage_events held zero study_material rows of any kind, for
// any student. The model's reply went straight into practice_questions,
// which has `question NOT NULL`, `answer NOT NULL` and
// `type CHECK (type IN ('multiple_choice','short_answer'))`, so a reply
// naming its field `correct_answer` (the name every other generator here
// uses), or typing itself "multiple-choice", or returning one empty
// question, took down the whole insert. The flashcard branch three lines
// above had a guard for exactly this — usableFlashcards — and the question
// branch had none, which is why flashcards worked and quizzes did not.
//
// Questions now go through lib/quizQuestions.js, the validator written for
// the blank-question incident on 2 Sep and until now used only by
// generateLectureReview. It drops what it cannot verify rather than
// repairing it, and guarantees the shape the column accepts.

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { class_id, material_type, lecture_range_start, lecture_range_end, lecture_ids } = req.body || {};
    if (!class_id || !material_type) return res.status(400).json({ error: 'class_id and material_type are required' });

    let { rows: lectures } = await pool.query('select * from lectures where class_id = $1 and user_id = $2 order by date', [class_id, userId]);

    if (Array.isArray(lecture_ids) && lecture_ids.length > 0) {
      const idSet = new Set(lecture_ids);
      lectures = lectures.filter((l) => idSet.has(l.id));
    } else if (lecture_range_start && lecture_range_end) {
      const startIdx = lectures.findIndex((l) => l.id === lecture_range_start);
      const endIdx = lectures.findIndex((l) => l.id === lecture_range_end);
      if (startIdx >= 0 && endIdx >= 0) {
        lectures = lectures.slice(Math.min(startIdx, endIdx), Math.max(startIdx, endIdx) + 1);
      }
    }

    const lectureContent = lectures
      .filter((l) => l.transcript || l.ai_summary)
      .map((l) => `Lecture ${l.date} - ${l.ai_title || 'Untitled'}:\n${l.ai_summary || (l.transcript || '').substring(0, 1000)}`)
      .join('\n\n---\n\n');

    if (!lectureContent) return res.status(400).json({ error: 'No lecture content available to generate study material' });

    const gate = await gateFeature(userId, 'study_material', res);
    if (!gate.ok) return;
    const llmUsage = createLlmUsage();

    const material = await invokeLLM({
      usage: llmUsage,
      prompt: `You are an AI study material generator. Based on the following university lecture content, generate study material of type "${material_type}".

Lecture content:
${lectureContent.substring(0, 12000)}

Generate ${material_type} based on this content:
- If "flashcards": Generate 10 flashcards with front (question/term) and back (answer/definition)
- If "quiz": Generate 5 questions
- If "practice_test": Generate 8 questions covering the full range of the material
- If "summary_sheet": Generate a comprehensive study summary with key points, organized by topic

${material_type === 'quiz' || material_type === 'practice_test' ? QUIZ_FORMAT_RULES : ''}

Return the appropriate JSON structure.`,
      response_json_schema: {
        type: 'object',
        properties: {
          flashcards: { type: 'array', items: { type: 'object', properties: { front: { type: 'string' }, back: { type: 'string' } }, required: ['front', 'back'] } },
          // The same schema every other quiz generator asks for, so the
          // model is told what to name the correct answer and how many
          // options to return, rather than being left to invent a shape the
          // column will reject.
          questions: { type: 'array', items: QUIZ_QUESTION_SCHEMA },
          summary: { type: 'string' },
        },
      },
    });

    const scopedLectureId = lectures.length === 1 ? lectures[0].id : null;

    if (material_type === 'flashcards' && material.flashcards) {
      // Same guard as the recording pipeline: a card with no back is dropped
      // rather than aborting the batch on the NOT NULL column.
      for (const fc of usableFlashcards(material.flashcards)) {
        await pool.query(
          'insert into flashcards (user_id, lecture_id, class_id, front, back, ai_generated) values ($1, $2, $3, $4, $5, true)',
          [userId, scopedLectureId, class_id, fc.front, fc.back]);
      }
    }
    if (material_type === 'quiz' || material_type === 'practice_test') {
      // normalizeQuizQuestions returns correct_answer (verbatim one of the
      // options); the column is called answer. Mapping here rather than
      // renaming the column, which exportUserData and the Practice tab both
      // read by name.
      const { questions, dropped } = normalizeQuizQuestions(material.questions);
      if (dropped > 0) console.warn(`[study-material] dropped ${dropped} malformed question(s) of ${material.questions?.length ?? 0}`);
      if (questions.length === 0) {
        await logUsage({ user_id: userId, feature: 'study_material', tier_at_time: gate.balance?.tier, success: false });
        return res.status(502).json({ error: 'The model returned no usable questions. Try again — you have not been charged.' });
      }
      // One shape for both destinations. What comes back in the response is
      // the row that was stored, not the validator's internal shape, so the
      // "Just Generated" list and the "Saved Questions" list below it render
      // through QuizViewer identically.
      const stored = questions.map((q) => ({
        question: q.question, answer: q.correct_answer, options: q.options, type: 'multiple_choice',
      }));
      for (const q of stored) {
        await pool.query(
          'insert into practice_questions (user_id, lecture_id, class_id, question, answer, options, type, ai_generated) values ($1, $2, $3, $4, $5, $6, $7, true)',
          [userId, scopedLectureId, class_id, q.question, q.answer, q.options, q.type]);
      }
      material.questions = stored;
    }

    await settleFeature(gate, { feature: 'study_material', llmUsage, extra: { class_id } });
    res.json({ material_type, generated: true, material });
  } catch (error) {
    // Loudly. This route failed silently for two weeks: no console line, no
    // usage_events row (the throw lands between gateFeature and
    // settleFeature, so neither writes one), and a client that replaced the
    // message with its own. Any one of the three would have caught it.
    console.error('[study-material]', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
