import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { createLlmUsage } from '../lib/llm.js';
import { getBalance, logUsage } from '../lib/credits.js';
import { runEnrichment, syncLectureTodos } from '../lib/lectureEnrichment.js';
import { loadLectureMaterials } from '../lib/lectureMaterials.js';

// Re-run the enrichment pass for one lecture (lib/lectureEnrichment.js).
//
// Two reasons a student needs this: the pass failed inside the recording
// pipeline (it is non-fatal there), or they attached the professor's
// materials AFTER the lecture was processed and want the formulas and
// definitions verified against them. Both are part of the hook — recording
// and understanding a lecture is never gated — so this charges no credits.
//
// Cost control is structural rather than a price: the pass only runs when
// there is something new to learn from. If the enrichment is already newer
// than every attached material and nothing forced a rerun, the stored result
// is returned untouched, and a lecture can be enriched at most once every
// few minutes. The provider cost is still logged (feature 'lecture_enrich')
// so the margin model sees it.

const router = express.Router();
const MIN_INTERVAL_MS = 3 * 60 * 1000;

router.post('/', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { lecture_id, force } = req.body || {};
  if (!lecture_id) return res.status(400).json({ error: 'lecture_id is required' });

  try {
    const lecture = (await pool.query('select * from lectures where id = $1 and user_id = $2', [lecture_id, userId])).rows[0];
    if (!lecture) return res.status(404).json({ error: 'Lecture not found' });
    if (lecture.status === 'processing') return res.status(409).json({ error: 'This lecture is still being processed' });
    const transcript = String(lecture.transcript || '').trim();
    if (!transcript || transcript.startsWith('[No speech')) {
      return res.status(400).json({ error: 'This lecture has no transcript to analyze yet' });
    }

    const materialRows = await loadLectureMaterials(pool, userId, lecture_id);
    const enrichedAt = lecture.enriched_at ? new Date(lecture.enriched_at).getTime() : 0;
    const newestMaterial = materialRows.reduce((max, m) => Math.max(max, new Date(m.updated_at).getTime()), 0);
    const hasEnrichment = enrichedAt > 0 && lecture.ai_enrichment && Object.keys(lecture.ai_enrichment).length > 0;

    if (hasEnrichment && !force && newestMaterial <= enrichedAt) {
      return res.json({ status: 'current', lecture_id, enriched_at: lecture.enriched_at, ran: false });
    }
    if (hasEnrichment && Date.now() - enrichedAt < MIN_INTERVAL_MS) {
      return res.status(429).json({ error: 'This lecture was analyzed moments ago. Try again in a few minutes.' });
    }

    const cls = lecture.class_id
      ? (await pool.query('select * from classes where id = $1 and user_id = $2', [lecture.class_id, userId])).rows[0]
      : null;
    const balance = await getBalance(userId);
    const llmUsage = createLlmUsage();
    const started = Date.now();

    const enrichment = await runEnrichment({
      transcript, cls, lectureDate: lecture.date,
      base: { title: lecture.ai_title, summary: lecture.ai_summary },
      materialRows, llmUsage,
    });
    await pool.query('update lectures set ai_enrichment = $1, enriched_at = now() where id = $2', [JSON.stringify(enrichment), lecture_id]);
    const todosAdded = await syncLectureTodos(pool, { userId, lecture, todos: enrichment.todos });

    await logUsage({
      user_id: userId, feature: 'lecture_enrich', lecture_id, provider: 'gemini',
      model: Object.keys(llmUsage.models).join(', '), call_count: llmUsage.geminiCalls,
      input_tokens: llmUsage.inputTokens, output_tokens: llmUsage.outputTokens,
      cedar_credits_charged: 0, cost_cad: llmUsage.costCad, tier_at_time: balance.tier,
      success: true, latency_ms: Date.now() - started,
    });

    return res.json({
      status: 'complete', lecture_id, ran: true, enriched_at: new Date().toISOString(),
      todos_added: todosAdded, stats: enrichment.stats, materials_used: enrichment.materials_used.length,
    });
  } catch (error) {
    console.error('[enrich-lecture]', error?.message || error);
    return res.status(500).json({ error: 'The analysis could not be completed. Nothing was changed — try again in a few minutes.' });
  }
});

export default router;
