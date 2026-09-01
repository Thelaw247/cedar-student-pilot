import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { invokeLLM, createLlmUsage } from '../lib/llm.js';
import { gateFeature, settleFeature } from '../lib/credits.js';
import { usableFlashcards } from '../lib/flashcards.js';

// Direct port of base44/functions/generateStudyMaterial/entry.ts.

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
- If "quiz": Generate 5 multiple-choice questions with 4 options each and the correct answer
- If "practice_test": Generate 8 mixed questions (multiple choice and short answer)
- If "summary_sheet": Generate a comprehensive study summary with key points, organized by topic

Return the appropriate JSON structure.`,
      response_json_schema: {
        type: 'object',
        properties: {
          flashcards: { type: 'array', items: { type: 'object', properties: { front: { type: 'string' }, back: { type: 'string' } }, required: ['front', 'back'] } },
          questions: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, type: { type: 'string' } } } },
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
    if ((material_type === 'quiz' || material_type === 'practice_test') && material.questions) {
      for (const q of material.questions) {
        await pool.query(
          'insert into practice_questions (user_id, lecture_id, class_id, question, answer, options, type, ai_generated) values ($1, $2, $3, $4, $5, $6, $7, true)',
          [userId, scopedLectureId, class_id, q.question, q.answer, q.options || [], q.type || 'multiple_choice']);
      }
    }

    await settleFeature(gate, { feature: 'study_material', llmUsage, extra: { class_id } });
    res.json({ material_type, generated: true, material });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
