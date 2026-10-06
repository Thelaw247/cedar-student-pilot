import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { createLlmUsage } from '../lib/llm.js';
import { getBalance, logUsage, gateFeature, requireTier, settleFeature } from '../lib/credits.js';
import {
  MAX_MATERIALS_PER_CLASS,
  MAX_MATERIALS_PER_LECTURE,
  confirmMaterialUpload,
  createMaterialDownloadUrl,
  createMaterialUpload,
  deleteMaterialObject,
  storeFetchedMaterial,
  validateMaterialUpload,
} from '../lib/lectureMaterials.js';
import { normalizeMaterialLink, materialFileName } from '../lib/materialLinks.js';
import { fetchPublicFile } from '../lib/safeFetch.js';
import { classifyFetchedMaterial } from '../lib/materialSafety.js';

// Professor-supplied materials attached to a lecture, or to the class itself.
// Same presign / PUT / confirm pattern as recordings (routes/files.js); the
// difference is that confirm also extracts the file's text and writes the
// lecture_materials row, because the text is what the enrichment pass
// verifies formulas against (a lecture's own files) and what the study-
// material generator can build questions from (any file of the class).
// Rows are server-written on purpose: the client has SELECT only, so a row
// can never point at an object the server has not checked.
//
// A request names ONE target: `lecture_id` (the file belongs to that lecture,
// row gets its class_id too) or `class_id` (the file belongs to the course,
// lecture_id stays null). Both are resolved through the student's own rows.

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

async function ownedClass(userId, classId) {
  if (!classId) return null;
  return (await pool.query('select id from classes where id = $1 and user_id = $2', [classId, userId])).rows[0] || null;
}

/**
 * Where the file goes: { lecture_id, class_id } for a lecture file, or
 * { lecture_id: null, class_id } for a class file. null when the body names
 * nothing the student owns — the caller answers 404 without saying which.
 */
async function resolveTarget(userId, body) {
  if (body?.lecture_id) {
    const lecture = await ownedLecture(userId, body.lecture_id);
    return lecture ? { lecture_id: lecture.id, class_id: lecture.class_id } : null;
  }
  if (body?.class_id) {
    const cls = await ownedClass(userId, body.class_id);
    return cls ? { lecture_id: null, class_id: cls.id } : null;
  }
  return null;
}

async function targetIsFull(target) {
  if (target.lecture_id) {
    const count = Number((await pool.query('select count(*) from lecture_materials where lecture_id = $1', [target.lecture_id])).rows[0].count);
    return count >= MAX_MATERIALS_PER_LECTURE ? `A lecture can hold up to ${MAX_MATERIALS_PER_LECTURE} materials` : null;
  }
  const count = Number((await pool.query(
    'select count(*) from lecture_materials where class_id = $1 and lecture_id is null', [target.class_id],
  )).rows[0].count);
  return count >= MAX_MATERIALS_PER_CLASS ? `A class can hold up to ${MAX_MATERIALS_PER_CLASS} course materials` : null;
}

// Materials are a Student-and-up study feature. Reading a PDF is one Gemini OCR
// call and costs 1 credit; plain text and Markdown make no model call, so they
// are held to the same tier but never charged. Returns { ok, gate }: `gate` is
// the object to settle after a successful PDF read, or null when the read costs
// nothing to bill. On a refusal it has already sent the 402 — the caller just
// returns.
function isPdfMaterial(contentType) {
  return String(contentType || '').toLowerCase().split(';')[0].trim() === 'application/pdf';
}
async function gateMaterial(userId, contentType, target, res) {
  const extra = { lecture_id: target.lecture_id, class_id: target.class_id };
  if (isPdfMaterial(contentType)) {
    const gate = await gateFeature(userId, 'material_extract', res, extra); // tier + 1 credit
    return { ok: gate.ok, gate: gate.ok ? gate : null };
  }
  const tier = await requireTier(userId, 'material_extract', res, extra);   // tier only, free
  return { ok: tier.ok, gate: null };
}

router.post('/upload-url', requireAuth, async (req, res) => {
  try {
    const target = await resolveTarget(req.user.id, req.body);
    if (!target) return res.status(404).json({ error: req.body?.class_id && !req.body?.lecture_id ? 'Class not found' : 'Lecture not found' });
    // Gate before the presign so a refused upload never leaves an orphaned
    // object in storage. The credit itself is charged later, at /confirm, only
    // once the read has actually succeeded — this is just the fail-fast check.
    const gate = await gateMaterial(req.user.id, req.body?.content_type, target, res);
    if (!gate.ok) return;
    const full = await targetIsFull(target);
    if (full) return res.status(409).json({ error: full });
    validateMaterialUpload({ contentType: req.body?.content_type, sizeBytes: req.body?.size_bytes, fileName: req.body?.file_name });
    res.json(await createMaterialUpload(req.user.id, {
      contentType: req.body?.content_type, sizeBytes: req.body?.size_bytes, fileName: req.body?.file_name,
    }));
  } catch (error) {
    clientError(error, res);
  }
});

/**
 * Write the row and settle the credit, for a file that arrived either way
 * (uploaded and confirmed, or fetched from a link). The row is saved first;
 * a PDF read that produced text costs 1 credit, logged with its true
 * provider cost in one settle. A credit-contention race after the work is
 * done must not fail the student: the cost is logged uncharged instead.
 */
async function saveMaterial({ userId, target, fileName, confirmed, gate, llmUsage, started }) {
  const extracted = confirmed.extraction_status === 'ready';
  const row = (await pool.query(
    `insert into lecture_materials
       (user_id, lecture_id, class_id, file_name, content_type, size_bytes, storage_ref, extracted_text, page_count, extraction_status)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     returning id, lecture_id, class_id, file_name, content_type, size_bytes, page_count, extraction_status, created_at, updated_at`,
    [userId, target.lecture_id, target.class_id, fileName, confirmed.content_type, confirmed.size_bytes, confirmed.storage_ref,
      confirmed.extracted_text, confirmed.page_count, confirmed.extraction_status],
  )).rows[0];

  if (gate && extracted && llmUsage.geminiCalls > 0) {
    try {
      await settleFeature(gate, { feature: 'material_extract', llmUsage, extra: { lecture_id: target.lecture_id, class_id: target.class_id } });
    } catch (e) {
      console.error('[materials] settle failed (material saved, not charged):', e?.message || e);
      await logUsage({
        user_id: userId, feature: 'material_extract', lecture_id: target.lecture_id, class_id: target.class_id, provider: 'gemini',
        model: Object.keys(llmUsage.models).join(', '), call_count: llmUsage.geminiCalls,
        input_tokens: llmUsage.inputTokens, output_tokens: llmUsage.outputTokens,
        cedar_credits_charged: 0, cost_cad: llmUsage.costCad, tier_at_time: gate?.balance?.tier || 'free',
        success: true, latency_ms: Date.now() - started,
      }).catch(() => {});
    }
  } else if (llmUsage.geminiCalls > 0) {
    // A model call happened but nothing billable resulted (an empty or failed
    // PDF read — the student got no text). Log the cost so the margin model
    // still sees it; charge nothing.
    const balance = await getBalance(userId).catch(() => ({ tier: 'free' }));
    await logUsage({
      user_id: userId, feature: 'material_extract', lecture_id: target.lecture_id, class_id: target.class_id, provider: 'gemini',
      model: Object.keys(llmUsage.models).join(', '), call_count: llmUsage.geminiCalls,
      input_tokens: llmUsage.inputTokens, output_tokens: llmUsage.outputTokens,
      cedar_credits_charged: 0, cost_cad: llmUsage.costCad, tier_at_time: balance.tier,
      success: extracted, latency_ms: Date.now() - started,
    });
  }
  return row;
}

router.post('/confirm', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const target = await resolveTarget(userId, req.body);
    if (!target) return res.status(404).json({ error: req.body?.class_id && !req.body?.lecture_id ? 'Class not found' : 'Lecture not found' });
    const { fileName, contentType } = validateMaterialUpload({
      contentType: req.body?.content_type || 'application/pdf', sizeBytes: 1, fileName: req.body?.file_name,
    });
    // Check-before-work: tier for every material, plus one credit for a PDF.
    // Re-checked here and not only at /upload-url so a direct call to confirm
    // cannot skip the gate. The credit is settled AFTER the row is saved
    // (saveMaterial).
    const gate = await gateMaterial(userId, contentType, target, res);
    if (!gate.ok) return;

    const llmUsage = createLlmUsage();
    const started = Date.now();
    const confirmed = await confirmMaterialUpload(userId, req.body?.key, llmUsage);
    const row = await saveMaterial({ userId, target, fileName, confirmed, gate: gate.gate, llmUsage, started });
    res.status(201).json({ material: row, extracted_chars: confirmed.extracted_text?.length || 0 });
  } catch (error) {
    clientError(error, res);
  }
});

// A link may be fetched this many times per student per window. Fetching an
// address someone else chose is work this server does on their behalf, and
// the tier and the per-class cap bound it per account; this bounds the rate.
const IMPORT_WINDOW_MS = 10 * 60 * 1000;
const IMPORTS_PER_WINDOW = 12;
const importsByUser = new Map();
export function takeImportSlot(userId, now = Date.now()) {
  const recent = (importsByUser.get(userId) || []).filter((t) => now - t < IMPORT_WINDOW_MS);
  if (recent.length >= IMPORTS_PER_WINDOW) { importsByUser.set(userId, recent); return false; }
  recent.push(now);
  importsByUser.set(userId, recent);
  return true;
}

/**
 * A file from a link: the address is normalised (a Drive, Dropbox or
 * OneDrive share becomes its download form), fetched by the server with
 * the checks in lib/safeFetch.js, judged by its bytes (lib/materialSafety.js:
 * a real PDF with nothing hostile inside, or real text), then kept and read
 * exactly as an upload would be. Same tier, same credit for a PDF, same cap
 * per class or lecture.
 */
router.post('/from-url', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const target = await resolveTarget(userId, req.body);
    if (!target) return res.status(404).json({ error: req.body?.class_id && !req.body?.lecture_id ? 'Class not found' : 'Lecture not found' });
    const link = normalizeMaterialLink(req.body?.url);
    // Fail fast, before any fetch: the tier (a PDF's credit is checked once
    // the type is known, below) and the cap.
    const tier = await requireTier(userId, 'material_extract', res, { lecture_id: target.lecture_id, class_id: target.class_id });
    if (!tier.ok) return;
    const full = await targetIsFull(target);
    if (full) return res.status(409).json({ error: full });
    if (!takeImportSlot(userId)) return res.status(429).json({ error: 'That is a lot of links at once. Give it a few minutes and try again.' });

    const fetched = await fetchPublicFile(link.url);
    const { contentType } = classifyFetchedMaterial(fetched.buffer, { declaredType: fetched.contentType, finalUrl: fetched.finalUrl });
    const fileName = materialFileName({ contentDisposition: fetched.contentDisposition, finalUrl: fetched.finalUrl, contentType });
    const gate = await gateMaterial(userId, contentType, target, res);
    if (!gate.ok) return;

    const llmUsage = createLlmUsage();
    const started = Date.now();
    const stored = await storeFetchedMaterial(userId, fetched.buffer, contentType, llmUsage);
    const row = await saveMaterial({ userId, target, fileName, confirmed: stored, gate: gate.gate, llmUsage, started });
    res.status(201).json({ material: row, extracted_chars: stored.extracted_text?.length || 0, source: link.kind });
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
