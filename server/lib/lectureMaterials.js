import crypto from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client, assertOwnedKey, storageRef, parseStorageRef } from './r2.js';
import { CHEAP_MODEL, recordGeminiUsage } from './llm.js';

// Professor-supplied materials for a lecture: slides, handouts, problem
// sets, the formula sheet. They live in R2 under the same per-user prefix as
// recordings (users/<id>/materials/…) and go through the same presign →
// browser PUT → server-side confirm dance, so nothing here can write to
// another account's prefix and no object is trusted until HeadObject has
// checked the owner/purpose metadata the presign stamped on it.
//
// The point of the upload is the text. confirmMaterialUpload pulls the
// object back, extracts what it can, and the enrichment pass (see
// lectureEnrichment.js) treats that text as the authoritative source for
// formulas and definitions — a transcription that heard "sigma equals F
// over A" as "sigma equals F over 8" is corrected by the slide, not shipped.

export const MAX_MATERIAL_BYTES = 20 * 1024 * 1024;
export const MAX_MATERIALS_PER_LECTURE = 12;
// How much extracted text a single material contributes to a prompt. Slides
// for one lecture are a few thousand words; a whole textbook chapter PDF is
// not what this is for, and the cap keeps the enrichment call bounded.
export const MAX_EXTRACTED_CHARS = 120_000;
const UPLOAD_EXPIRY_SECONDS = 5 * 60;
const DOWNLOAD_EXPIRY_SECONDS = 15 * 60;
const SIGNED_UPLOAD_HEADERS = new Set(['x-amz-meta-owner', 'x-amz-meta-purpose', 'x-amz-meta-max-bytes']);
const UPLOAD_PRESIGN_OPTIONS = { expiresIn: UPLOAD_EXPIRY_SECONDS, unhoistableHeaders: SIGNED_UPLOAD_HEADERS };

export const MATERIAL_TYPES = new Map([
  ['application/pdf', 'pdf'],
  ['text/plain', 'txt'],
  ['text/markdown', 'md'],
  ['text/x-markdown', 'md'],
]);

export function validateMaterialUpload({ contentType, sizeBytes, fileName }) {
  const normalizedType = String(contentType || '').toLowerCase().split(';')[0].trim();
  const normalizedSize = Number(sizeBytes);
  const name = String(fileName || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 255);
  if (!MATERIAL_TYPES.has(normalizedType)) {
    throw new TypeError('Materials must be a PDF, plain text, or Markdown file');
  }
  if (!Number.isSafeInteger(normalizedSize) || normalizedSize < 1) {
    throw new TypeError('A valid file size is required');
  }
  if (normalizedSize > MAX_MATERIAL_BYTES) {
    throw new RangeError('Materials must be 20 MB or smaller');
  }
  if (!name) throw new TypeError('A file name is required');
  return { contentType: normalizedType, sizeBytes: normalizedSize, fileName: name };
}

export function materialKey(userId, contentType) {
  const safeUserId = String(userId || '');
  if (!/^[0-9a-f-]{36}$/i.test(safeUserId)) throw new TypeError('Invalid user id');
  return `users/${safeUserId}/materials/${crypto.randomUUID()}.${MATERIAL_TYPES.get(contentType) || 'bin'}`;
}

export async function createMaterialUpload(userId, input) {
  const { contentType, sizeBytes } = validateMaterialUpload(input);
  const key = materialKey(userId, contentType);
  const { client, bucket } = r2Client();
  const command = new PutObjectCommand({
    Bucket: bucket, Key: key, ContentType: contentType,
    Metadata: { owner: userId, purpose: 'material', 'max-bytes': String(sizeBytes) },
  });
  const uploadUrl = await getSignedUrl(client, command, UPLOAD_PRESIGN_OPTIONS);
  return {
    key,
    upload_url: uploadUrl,
    expires_at: new Date(Date.now() + UPLOAD_EXPIRY_SECONDS * 1000).toISOString(),
    headers: {
      'Content-Type': contentType,
      'x-amz-meta-owner': userId,
      'x-amz-meta-purpose': 'material',
      'x-amz-meta-max-bytes': String(sizeBytes),
    },
  };
}

/**
 * Verify the uploaded object (owner, purpose, size), read it back, and
 * extract its text. Returns everything the lecture_materials row needs.
 * A file whose text cannot be extracted is still kept (the student can
 * download it) with extraction_status 'failed' or 'unsupported'.
 */
export async function confirmMaterialUpload(userId, rawKey, llmUsage = undefined) {
  const key = assertOwnedKey(userId, rawKey);
  const { client, bucket } = r2Client();
  const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  const size = Number(head.ContentLength || 0);
  const declaredMax = Number(head.Metadata?.['max-bytes'] || 0);
  const contentType = String(head.ContentType || '').toLowerCase().split(';')[0].trim();
  if (head.Metadata?.owner !== userId || head.Metadata?.purpose !== 'material' || !MATERIAL_TYPES.has(contentType)) {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => {});
    throw new TypeError('The uploaded material metadata is invalid');
  }
  if (!size || !declaredMax || size > declaredMax || size > MAX_MATERIAL_BYTES) {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => {});
    throw new RangeError('The uploaded material size is invalid');
  }

  const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const buffer = Buffer.from(await object.Body.transformToByteArray());
  const extraction = await extractMaterialText(buffer, contentType, llmUsage);

  return {
    key,
    storage_ref: storageRef(key),
    size_bytes: size,
    content_type: contentType,
    ...extraction,
  };
}

export async function createMaterialDownloadUrl(userId, ref) {
  const parsed = parseStorageRef(ref);
  if (!parsed) throw new TypeError('Invalid material reference');
  const { client, bucket } = r2Client();
  if (parsed.bucket !== bucket) throw new TypeError('Material bucket does not match');
  const key = assertOwnedKey(userId, parsed.key);
  const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: DOWNLOAD_EXPIRY_SECONDS });
  return { url, expires_at: new Date(Date.now() + DOWNLOAD_EXPIRY_SECONDS * 1000).toISOString() };
}

export async function deleteMaterialObject(userId, ref) {
  const parsed = parseStorageRef(ref);
  if (!parsed) return;
  const { client, bucket } = r2Client();
  if (parsed.bucket !== bucket) throw new TypeError('Material bucket does not match');
  const key = assertOwnedKey(userId, parsed.key);
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/**
 * Text extraction. Text and Markdown are read as UTF-8. PDFs are read by the
 * cheap Gemini model with the file inline (the same call shape
 * parseTimetableUpload uses for timetable images): it returns the document's
 * text with page markers, formulas in plain notation, and — unlike a text
 * layer parser — it reads scanned slides and photographed handouts too. No
 * PDF library ships in the server for this; the model is already a
 * dependency and a 40-page deck costs well under a cent to read.
 *
 * `llmUsage` (optional) receives the token/cost accounting so the caller
 * can log it under its own feature.
 */
export async function extractMaterialText(buffer, contentType, llmUsage = undefined) {
  const kind = MATERIAL_TYPES.get(contentType);
  if (kind === 'txt' || kind === 'md') {
    const text = normalizeExtractedText(buffer.toString('utf8'));
    return { extracted_text: text, page_count: null, extraction_status: text ? 'ready' : 'failed' };
  }
  if (kind !== 'pdf') return { extracted_text: null, page_count: null, extraction_status: 'unsupported' };
  try {
    const result = await extractPdfTextWithGemini(buffer, llmUsage);
    return { extracted_text: result.text, page_count: result.pages, extraction_status: result.text ? 'ready' : 'failed' };
  } catch (error) {
    console.error('[materials] pdf extraction failed:', error?.message || error);
    return { extracted_text: null, page_count: null, extraction_status: 'failed' };
  }
}

const EXTRACT_PROMPT = `Transcribe this document's text exactly, in reading order. Rules:
- Start every page with a line "[Page N]" (N from 1).
- Keep headings, bullet lists and line breaks. Do not summarize, reorder, or add commentary.
- Write every formula and equation in plain linear notation using the symbols shown (for example "σ = F / A", "E = σ / ε", "x = (-b ± √(b² - 4ac)) / 2a"). Keep subscripts as they appear (v_0, x_1).
- Transcribe tables row by row with " | " between cells.
- If a page is an image with no readable text, write "[Page N] (no readable text)".
Return only the transcription.`;

const MAX_PDF_INLINE_BYTES = 20 * 1024 * 1024;

async function extractPdfTextWithGemini(buffer, llmUsage) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not configured');
  if (buffer.length > MAX_PDF_INLINE_BYTES) throw new RangeError('PDF is too large to read inline');
  const body = {
    contents: [{ role: 'user', parts: [{ text: EXTRACT_PROMPT }, { inline_data: { mime_type: 'application/pdf', data: buffer.toString('base64') } }] }],
    generationConfig: { temperature: 0 },
  };
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${CHEAP_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(180_000) },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Gemini ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  if (llmUsage) recordGeminiUsage(llmUsage, data, CHEAP_MODEL);
  const text = normalizeExtractedText(data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || '').join('') || '');
  const pages = (text.match(/^\[Page \d+\]/gm) || []).length || null;
  return { text, pages };
}

export function normalizeExtractedText(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, MAX_EXTRACTED_CHARS);
}

/** Materials of one lecture, ready for the enrichment prompt. */
export async function loadLectureMaterials(pool, userId, lectureId) {
  const { rows } = await pool.query(
    `select id, file_name, content_type, extracted_text, extraction_status, page_count, updated_at
       from lecture_materials where lecture_id = $1 and user_id = $2 order by created_at`,
    [lectureId, userId],
  );
  return rows;
}
