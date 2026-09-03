import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { createLlmUsage } from '../lib/llm.js';
import { getBalance, logUsage } from '../lib/credits.js';
import {
  MAX_MATERIALS_PER_LECTURE,
  confirmMaterialUpload,
  createMaterialDownloadUrl,
  createMaterialUpload,
  deleteMaterialObject,
  validateMaterialUpload,
} from '../lib/lectureMaterials.js';

// Professor-supplied materials attached to a lecture. Same presign / PUT /
// confirm pattern as recordings (routes/files.js); the difference is that
// confirm also extracts the file's text and writes the lecture_materials row,
// because the text is what the enrichment pass verifies formulas against.
// Rows are server-written on purpose: the client has SELECT only, so a row
// can never point at an object the server has not checked.

const router = express.Router();

function clientError(error, res) {
  if (error instanceof TypeError) return res.status(400).json({ error: error.message });
  if (error instanceof RangeError) return res.status(413).json({ error: error.message });
  console.error('[lecture-materials]', error);
  return res.status(500).json({ error: 'Material request failed' });
}

async function ownedLecture(userId, lectureId) {
  if (!lectureId) return null;
  return (await pool.query('select id, class_id from lectures where id = $1 and user_id = $2', [lectureId, userId])).rows[0] || null;
}

router.post('/upload-url', requireAuth, async (req, res) => {
  try {
    const lecture = await ownedLecture(req.user.id, req.body?.lecture_id);
    if (!lecture) return res.status(404).json({ error: 'Lecture not found' });
    const count = Number((await pool.query('select count(*) from lecture_materials where lecture_id = $1', [lecture.id])).rows[0].count);
    if (count >= MAX_MATERIALS_PER_LECTURE) {
      return res.status(409).json({ error: `A lecture can hold up to ${MAX_MATERIALS_PER_LECTURE} materials` });
    }
    validateMaterialUpload({ contentType: req.body?.content_type, sizeBytes: req.body?.size_bytes, fileName: req.body?.file_name });
    res.json(await createMaterialUpload(req.user.id, {
      contentType: req.body?.content_type, sizeBytes: req.body?.size_bytes, fileName: req.body?.file_name,
    }));
  } catch (error) {
    clientError(error, res);
  }
});

router.post('/confirm', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const lecture = await ownedLecture(userId, req.body?.lecture_id);
    if (!lecture) return res.status(404).json({ error: 'Lecture not found' });
    const { fileName } = validateMaterialUpload({
      contentType: req.body?.content_type || 'application/pdf', sizeBytes: 1, fileName: req.body?.file_name,
    });
    // Reading a PDF is a (cheap) model call; log its cost under its own
    // feature so the margin model sees it. Never charged to the student —
    // attaching the professor's material is part of the hook.
    const llmUsage = createLlmUsage();
    const started = Date.now();
    const confirmed = await confirmMaterialUpload(userId, req.body?.key, llmUsage);
    if (llmUsage.geminiCalls > 0) {
      const balance = await getBalance(userId).catch(() => ({ tier: 'free' }));
      await logUsage({
        user_id: userId, feature: 'material_extract', lecture_id: lecture.id, provider: 'gemini',
        model: Object.keys(llmUsage.models).join(', '), call_count: llmUsage.geminiCalls,
        input_tokens: llmUsage.inputTokens, output_tokens: llmUsage.outputTokens,
        cedar_credits_charged: 0, cost_cad: llmUsage.costCad, tier_at_time: balance.tier,
        success: confirmed.extraction_status === 'ready', latency_ms: Date.now() - started,
      });
    }
    const row = (await pool.query(
      `insert into lecture_materials
         (user_id, lecture_id, class_id, file_name, content_type, size_bytes, storage_ref, extracted_text, page_count, extraction_status)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning id, lecture_id, class_id, file_name, content_type, size_bytes, page_count, extraction_status, created_at, updated_at`,
      [userId, lecture.id, lecture.class_id, fileName, confirmed.content_type, confirmed.size_bytes, confirmed.storage_ref,
        confirmed.extracted_text, confirmed.page_count, confirmed.extraction_status],
    )).rows[0];
    res.status(201).json({ material: row, extracted_chars: confirmed.extracted_text?.length || 0 });
  } catch (error) {
    clientError(error, res);
  }
});

router.get('/download-url', requireAuth, async (req, res) => {
  try {
    const row = (await pool.query(
      'select storage_ref, file_name from lecture_materials where id = $1 and user_id = $2',
      [req.query?.id, req.user.id],
    )).rows[0];
    if (!row) return res.status(404).json({ error: 'Material not found' });
    res.json({ ...(await createMaterialDownloadUrl(req.user.id, row.storage_ref)), file_name: row.file_name });
  } catch (error) {
    clientError(error, res);
  }
});

router.delete('/', requireAuth, async (req, res) => {
  try {
    const row = (await pool.query(
      'select id, storage_ref from lecture_materials where id = $1 and user_id = $2',
      [req.body?.id, req.user.id],
    )).rows[0];
    if (!row) return res.status(404).json({ error: 'Material not found' });
    // Object first, then the row: a row without an object is a broken link
    // the UI can show; an object without a row is storage nobody can reach.
    await deleteMaterialObject(req.user.id, row.storage_ref);
    await pool.query('delete from lecture_materials where id = $1', [row.id]);
    res.sendStatus(204);
  } catch (error) {
    clientError(error, res);
  }
});

export default router;
