import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { invokeLLM, createLlmUsage, QUALITY_MODEL } from '../lib/llm.js';
import { gateFeature, settleFeature } from '../lib/credits.js';

// Direct port of base44/functions/generateMissedLectureSummary/entry.ts.

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { class_id, date, guidance_notes } = req.body || {};
    if (!class_id) return res.status(400).json({ error: 'class_id is required' });

    const { rows: clsRows } = await pool.query('select * from classes where id = $1 and user_id = $2', [class_id, userId]);
    const cls = clsRows[0];
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    const gate = await gateFeature(userId, 'missed_summary', res);
    if (!gate.ok) return;
    const llmUsage = createLlmUsage();

    const { rows: lectures } = await pool.query('select * from lectures where class_id = $1 and user_id = $2 order by date desc', [class_id, userId]);
    const previousLectures = lectures.filter((l) => l.transcript).slice(0, 5);
    const previousSummaries = previousLectures.map((l) => `${l.date}: ${l.ai_summary || (l.transcript || '').substring(0, 500)}`).join('\n\n');

    const trimmedGuidance = typeof guidance_notes === 'string' ? guidance_notes.trim() : '';
    const guidanceBlock = trimmedGuidance
      ? `\n\nThe student has provided the following notes about what was actually covered — treat this as the most reliable signal available and prioritize it over pure extrapolation from previous lectures:\n${trimmedGuidance}`
      : '';

    const analysis = await invokeLLM({
      usage: llmUsage, model: QUALITY_MODEL,
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
        properties: { title: { type: 'string' }, summary: { type: 'string' }, concepts: { type: 'array', items: { type: 'string' } }, vocabulary: { type: 'array', items: { type: 'string' } }, action_items: { type: 'array', items: { type: 'string' } } },
      },
    });

    const { rows: inserted } = await pool.query(
      `insert into lectures (class_id, date, is_missed, is_ai_estimated, status, ai_title, ai_summary, ai_concepts, ai_vocabulary, ai_action_items, actual_instructor, instructor_confirmed, user_id)
       values ($1, $2, true, true, 'complete', $3, $4, $5, $6, $7, 'AI', true, $8) returning id`,
      [class_id, date || new Date().toISOString().split('T')[0], analysis.title, analysis.summary, analysis.concepts || [], analysis.vocabulary || [], analysis.action_items || [], userId]);
    const lectureId = inserted[0].id;

    await settleFeature(gate, { feature: 'missed_summary', llmUsage, extra: { class_id, lecture_id: lectureId } });

    res.json({ lecture_id: lectureId, status: 'complete' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
