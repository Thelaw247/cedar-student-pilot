import express from 'express';
import { parseBlob } from 'music-metadata';
import { readWebmDurationSeconds } from '../lib/webmDuration.js';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { invokeLLM, createLlmUsage, QUALITY_MODEL } from '../lib/llm.js';
import {
  getBalance, availableCredits, insufficientResponse, spendCredits,
  logUsage, durationCost, COST_PER_30MIN_PROCESS, groqCostCad, base44CostCad,
} from '../lib/credits.js';
import { MAX_RECORDING_BYTES, resolveRecordingStorageRef } from '../lib/r2.js';

// Direct port of base44/functions/processLectureRecording/entry.ts — the
// core pipeline: fetch the stored recording, transcribe it, extract
// structured content, generate flashcards, bill exactly once. Every
// resumability/idempotency property from the original carries over
// (persist transcript before further LLM work so a later failure resumes
// without repeating transcription; billing keyed to the usage ledger, not to
// "does a transcript already exist").
//
// TWO REAL CHANGES FROM THE ORIGINAL, both consistent with decisions already
// made elsewhere in this port:
//
// 1. GROQ_API_KEY is now a HARD REQUIREMENT. The original silently fell back
//    to Base44's Core.TranscribeAudio when the key was missing — that
//    integration does not exist on this stack. Unlike the Gemini fallback
//    removal (which mainly affects AI-feature cost), this one matters more:
//    without this key, lecture recording itself does not work. This is the
//    single most important operational prerequisite before this backend can
//    ever go live.
//
// 2. Recordings must be user-owned R2 storage references. Arbitrary HTTPS URLs
//    are never fetched, even from a configured host; this prevents SSRF and
//    prevents one user from making the server process another user's object.

const router = express.Router();

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_MODEL = 'whisper-large-v3-turbo';
const GROQ_MAX_BYTES = MAX_RECORDING_BYTES;
const MAX_AUDIO_BYTES = MAX_RECORDING_BYTES;
const MAX_AUDIO_SECONDS = 6 * 60 * 60;
const EXTRACT_CHUNK_SIZE = 15000;
const NO_SPEECH = '[No speech detected in recording]';
// Node's fetch never times out on its own. Without these, a provider that
// accepts the connection and then goes quiet holds the request open
// indefinitely: the instance keeps the audio buffered, no error is ever
// raised, and the lecture stays stuck mid-processing.
const AUDIO_FETCH_TIMEOUT_MS = 60_000;
const GROQ_TIMEOUT_MS = 240_000; // generous for a full-length segment

class RequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function trustedRecordingUrl(rawUrl, userId) {
  const r2Url = await resolveRecordingStorageRef(userId, rawUrl);
  if (r2Url) return r2Url;
  throw new RequestError('The recording must be an R2 upload owned by this account', 422);
}

async function fetchVerifiedAudio(rawUrl, userId) {
  const audioUrl = await trustedRecordingUrl(rawUrl, userId);
  let response;
  try {
    response = await fetch(audioUrl, { redirect: 'error', signal: AbortSignal.timeout(AUDIO_FETCH_TIMEOUT_MS) });
  } catch {
    throw new RequestError('The stored recording could not be retrieved', 422);
  }
  if (!response.ok) throw new RequestError(`The stored recording could not be retrieved (${response.status})`, 422);

  const declaredBytes = Number(response.headers.get('content-length') || 0);
  if (declaredBytes > MAX_AUDIO_BYTES) throw new RequestError('Recordings must be 24 MB or smaller', 413);

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (!buffer.length) throw new RequestError('The stored recording is empty', 422);
  if (buffer.length > MAX_AUDIO_BYTES) throw new RequestError('Recordings must be 24 MB or smaller', 413);

  let durationSeconds = 0;
  try {
    const metadata = await parseBlob(new Blob([buffer]), { duration: true });
    durationSeconds = Math.ceil(Number(metadata?.format?.duration || 0));
  } catch (error) {
    console.error('[recording] duration parse failed:', error.message);
  }

  // Browser recordings arrive as streamed WebM, whose header never receives a
  // Duration element, so the metadata parser reports nothing for them. Measure
  // the container's own block timestamps instead. This still reads the stored
  // audio rather than any client-supplied value, so billing stays server-side.
  if (durationSeconds < 1) {
    durationSeconds = Math.ceil(readWebmDurationSeconds(buffer));
  }

  if (!Number.isFinite(durationSeconds) || durationSeconds < 1) {
    throw new RequestError('The recording duration could not be verified. Please record again or contact support.', 422);
  }

  return { audioUrl, buffer, durationSeconds };
}

// A lecture longer than the transcription provider's per-file size limit is
// captured client-side as multiple ordered segments (see recording_parts on
// the lectures table) rather than being hard-capped at ~90 minutes. Each
// segment individually still passes the same 24 MB / owned-R2-reference
// checks as a single-part recording; this just fetches and verifies every
// segment in order and sums their durations for the combined six-hour ceiling
// and for billing.
const MAX_RECORDING_PARTS = 40; // ~40 * 90 min comfortably covers the 6-hour ceiling with room to spare
async function fetchVerifiedAudioParts(userId, storedAudioUrl, storedParts) {
  const partRefs = Array.isArray(storedParts) && storedParts.length > 0 ? storedParts : [storedAudioUrl];
  if (partRefs.length > MAX_RECORDING_PARTS) {
    throw new RequestError('This recording has too many segments to process', 422);
  }
  const parts = [];
  let totalSeconds = 0;
  for (const ref of partRefs) {
    const verified = await fetchVerifiedAudio(ref, userId);
    parts.push(verified);
    totalSeconds += verified.durationSeconds;
  }
  if (totalSeconds > MAX_AUDIO_SECONDS) throw new RequestError('Recordings must be six hours or shorter in total', 413);
  return { parts, totalSeconds };
}

function mergeStrings(lists) {
  const seen = new Map();
  for (const list of lists) {
    for (const raw of (list || [])) {
      const value = typeof raw === 'string' ? raw.trim() : '';
      if (!value) continue;
      const key = value.toLowerCase();
      if (!seen.has(key)) seen.set(key, value);
    }
  }
  return [...seen.values()];
}

function mergeDefinitions(lists) {
  const seen = new Map();
  for (const list of lists) {
    for (const def of (list || [])) {
      const term = typeof def?.term === 'string' ? def.term.trim() : '';
      if (!term) continue;
      const key = term.toLowerCase();
      if (!seen.has(key)) seen.set(key, { term, definition: def.definition || '' });
    }
  }
  return [...seen.values()];
}

function splitInto(text, size) {
  const out = [];
  for (let i = 0; i < text.length; i += size) out.push(text.substring(i, i + size));
  return out;
}

async function transcribeViaGroq(buffer, apiKey) {
  if (buffer.length > GROQ_MAX_BYTES) {
    throw new Error(`file is ${(buffer.length / 1048576).toFixed(1)}MB, over the Groq limit`);
  }
  const form = new FormData();
  form.append('file', new Blob([buffer]), 'lecture.webm');
  form.append('model', GROQ_MODEL);
  form.append('response_format', 'json');

  const res = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(GROQ_TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Groq ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = (data?.text || '').trim();
  if (!text) throw new Error('Groq returned an empty transcript');
  return text;
}

// Each segment of a multi-part recording is already individually under
// Groq's per-file limit (see fetchVerifiedAudioParts), so no further audio
// splitting is needed here — just transcribe every segment independently and
// stitch the transcripts back together in order. A clear segment marker is
// inserted between parts so extractFromTranscript's own paragraph-level
// chunking (and the model itself) can see where a recording was paused and
// resumed, rather than reading a hard content jump as one continuous thought.
async function transcribeAudioParts(buffers) {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error('GROQ_API_KEY is not configured — there is no fallback transcription provider on this stack.');
  const texts = [];
  console.log('[transcribe] sending', buffers.length, 'segment(s) to groq,', buffers.reduce((n, b) => n + b.length, 0), 'bytes');
  for (const buffer of buffers) {
    texts.push(await transcribeViaGroq(buffer, groqKey));
  }
  const combined = buffers.length > 1
    ? texts.map((t, i) => `[Recording segment ${i + 1} of ${buffers.length}]\n${t}`).join('\n\n')
    : (texts[0] || '');
  console.log('[transcribe] groq ok,', buffers.length, 'segment(s),', combined.length, 'chars');
  return { text: combined, provider: 'groq' };
}

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' }, summary: { type: 'string' },
    concepts: { type: 'array', items: { type: 'string' } }, vocabulary: { type: 'array', items: { type: 'string' } },
    definitions: { type: 'array', items: { type: 'object', properties: { term: { type: 'string' }, definition: { type: 'string' } } } },
    formulas: { type: 'array', items: { type: 'string' } }, action_items: { type: 'array', items: { type: 'string' } },
    exam_mentions: { type: 'array', items: { type: 'string' } },
  },
};

async function extractFromTranscript(transcript, cls, lectureDate, llmUsage) {
  const className = cls?.name || 'Unknown';
  const instructor = cls?.instructor || 'Unknown instructor';

  const extractOne = async (text, part, total) => {
    const scope = total > 1 ? `This is part ${part} of ${total} of a single lecture transcript. Extract only what appears in THIS part; the parts are merged afterwards.` : '';
    const result = await invokeLLM({
      model: QUALITY_MODEL, usage: llmUsage,
      prompt: `You are an AI academic assistant analyzing a university lecture transcript. The class is "${className}" taught by ${instructor} on ${lectureDate}.
${scope}

Analyze this lecture transcript and generate:

1. A concise, descriptive title (5-8 words)
2. A comprehensive summary (2-3 paragraphs) covering the main topics
3. Key concepts discussed (array of 5-10 items)
4. Important vocabulary terms (array of 5-10 items)
5. Key definitions (array of objects with "term" and "definition")
6. Formulas mentioned (array of strings, empty if none)
7. Action items for the student (array of tasks like "Review X", "Read chapter Y")
8. Exam or test announcements mentioned (array, empty if none). Capture anything about tests, quizzes, midterms, finals, what will or won't be assessed, or what to focus on for an exam — these often come near the end of a lecture.

Transcript:
${text}`,
      response_json_schema: EXTRACTION_SCHEMA,
    });
    return result || {};
  };

  const chunks = splitInto(transcript, EXTRACT_CHUNK_SIZE);
  if (chunks.length <= 1) return await extractOne(transcript, 1, 1);

  const parts = [];
  for (let i = 0; i < chunks.length; i++) parts.push(await extractOne(chunks[i], i + 1, chunks.length));

  const merged = {
    concepts: mergeStrings(parts.map((p) => p.concepts)), vocabulary: mergeStrings(parts.map((p) => p.vocabulary)),
    definitions: mergeDefinitions(parts.map((p) => p.definitions)), formulas: mergeStrings(parts.map((p) => p.formulas)),
    action_items: mergeStrings(parts.map((p) => p.action_items)), exam_mentions: mergeStrings(parts.map((p) => p.exam_mentions)),
  };

  const partSummaries = parts.map((p, i) => `Part ${i + 1}: ${p.summary || ''}`).join('\n\n');
  try {
    const stitched = await invokeLLM({
      usage: llmUsage,
      prompt: `These are section summaries from one university lecture in "${className}", in order. Combine them into a single coherent summary of the whole lecture (2-3 paragraphs) and give the lecture one concise descriptive title (5-8 words). Do not invent anything not present below.

${partSummaries}`,
      response_json_schema: { type: 'object', properties: { title: { type: 'string' }, summary: { type: 'string' } } },
    });
    merged.title = stitched?.title || parts[0]?.title || '';
    merged.summary = stitched?.summary || parts.map((p) => p.summary).filter(Boolean).join('\n\n');
  } catch (e) {
    merged.title = parts[0]?.title || '';
    merged.summary = parts.map((p) => p.summary).filter(Boolean).join('\n\n');
  }
  return merged;
}

async function generateFlashcards(lecture, cls, userId, llmUsage) {
  const concepts = (lecture.ai_concepts || []).join(', ');
  const definitions = (lecture.ai_definitions || []).map((d) => `${d.term}: ${d.definition}`).join('\n');
  const formulas = (lecture.ai_formulas || []).join('\n');
  if (!concepts && !definitions && !formulas) return;

  const result = await invokeLLM({
    usage: llmUsage,
    prompt: `Create 8 study flashcards for a university lecture in "${cls?.name || 'the class'}" titled "${lecture.ai_title || 'Untitled'}". Each flashcard has a front (question or term) and a back (answer or definition). Focus on the most important material and spread the cards across the whole lecture, not just the beginning.

Lecture summary:
${lecture.ai_summary || '(none)'}

Key concepts: ${concepts || '(none)'}

Definitions:
${definitions || '(none)'}

Formulas:
${formulas || '(none)'}`,
    response_json_schema: { type: 'object', properties: { flashcards: { type: 'array', items: { type: 'object', properties: { front: { type: 'string' }, back: { type: 'string' } } } } } },
  });

  const cards = result?.flashcards || [];
  if (cards.length === 0) return;
  for (const fc of cards) {
    await pool.query('insert into flashcards (user_id, lecture_id, class_id, front, back, ai_generated) values ($1,$2,$3,$4,$5,true)',
      [userId, lecture.id, lecture.class_id, fc.front, fc.back]);
  }
}

router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const body = req.body || {};

    if (body.action === 'preflight') {
      const estimatedSeconds = Math.ceil(Number(body.duration_seconds || 0));
      if (!Number.isFinite(estimatedSeconds) || estimatedSeconds < 0 || estimatedSeconds > MAX_AUDIO_SECONDS) {
        return res.status(400).json({ error: 'A valid recording duration is required' });
      }
      const estimatedCost = durationCost(estimatedSeconds, COST_PER_30MIN_PROCESS);
      const balance = await getBalance(userId);
      if (availableCredits(balance) < estimatedCost) {
        await logUsage({ user_id: userId, feature: 'process_lecture', tier_at_time: balance.tier, success: false, audio_seconds: estimatedSeconds });
        return insufficientResponse(res, 'process_lecture', estimatedCost, balance);
      }
      return res.json({ status: 'ready', estimated_credits: estimatedCost, balance: availableCredits(balance) });
    }

    const { lecture_id, audio_url: requestedAudioUrl } = body;
    if (!lecture_id) return res.status(400).json({ error: 'lecture_id is required' });

    const existing = (await pool.query('select * from lectures where id = $1 and user_id = $2', [lecture_id, userId])).rows[0];
    if (!existing) return res.status(404).json({ error: 'Lecture not found' });

    const cls = existing.class_id ? (await pool.query('select * from classes where id = $1 and user_id = $2', [existing.class_id, userId])).rows[0] : null;

    const storedAudioUrl = existing.recording_url || '';
    if (!storedAudioUrl) return res.status(400).json({ error: 'This lecture has no stored recording' });
    if (requestedAudioUrl && requestedAudioUrl !== storedAudioUrl) {
      return res.status(400).json({ error: 'The requested audio does not match this lecture' });
    }
    if (existing.transcript === NO_SPEECH) return res.status(400).json({ error: 'No speech detected' });

    let alreadyCharged = false;
    try {
      const prior = (await pool.query(
        `select 1 from usage_events where user_id = $1 and feature = 'process_lecture' and lecture_id = $2 and success = true and cedar_credits_charged > 0 limit 1`,
        [userId, lecture_id])).rows;
      alreadyCharged = prior.length > 0;
    } catch (error) {
      console.error('[recording] prior usage lookup failed:', error.message);
    }

    const operationId = `process:${lecture_id}`;
    const started = Date.now();
    const balance = await getBalance(userId);
    alreadyCharged = alreadyCharged || (balance.applied_credit_operations || []).includes(operationId);

    if (alreadyCharged && existing.status === 'complete' && existing.ai_title) {
      return res.json({ status: 'complete', lecture_id, credits_charged: 0 });
    }

    const minimumCost = durationCost(1, COST_PER_30MIN_PROCESS);
    if (!alreadyCharged && availableCredits(balance) < minimumCost) {
      await logUsage({ user_id: userId, feature: 'process_lecture', lecture_id, tier_at_time: balance.tier, success: false });
      return insufficientResponse(res, 'process_lecture', minimumCost, balance);
    }

    const { parts: verifiedParts, totalSeconds: audioSeconds } = await fetchVerifiedAudioParts(
      userId, storedAudioUrl, existing.recording_parts,
    );
    const cost = alreadyCharged ? 0 : durationCost(audioSeconds, COST_PER_30MIN_PROCESS);

    await pool.query('update lectures set duration_seconds = $1, status = $2 where id = $3', [audioSeconds, 'processing', lecture_id]);

    if (cost > 0 && availableCredits(balance) < cost) {
      await logUsage({ user_id: userId, feature: 'process_lecture', lecture_id, tier_at_time: balance.tier, success: false, audio_seconds: audioSeconds });
      return insufficientResponse(res, 'process_lecture', cost, balance);
    }

    const llmUsage = createLlmUsage();
    const hasTranscript = !!(existing.transcript && existing.transcript.trim());
    let transcript = hasTranscript ? existing.transcript.trim() : '';
    let transcriptionProvider = hasTranscript ? 'stored' : 'groq';

    if (!hasTranscript) {
      const transcription = await transcribeAudioParts(verifiedParts.map((p) => p.buffer));
      const rawTranscript = transcription.text;
      transcriptionProvider = transcription.provider;

      if (!rawTranscript || rawTranscript.trim().length === 0) {
        await pool.query('update lectures set status = $1, transcript = $2 where id = $3', ['complete', NO_SPEECH, lecture_id]);
        return res.status(400).json({ error: 'No speech detected' });
      }
      transcript = rawTranscript.trim();
      await pool.query('update lectures set transcript = $1, status = $2 where id = $3', [transcript, 'processing', lecture_id]);
    }

    let lecture = (await pool.query('select * from lectures where id = $1', [lecture_id])).rows[0];

    if (!lecture.ai_title) {
      const analysis = await extractFromTranscript(transcript, cls, lecture.date, llmUsage);
      await pool.query(
        `update lectures set ai_title=$1, ai_summary=$2, ai_concepts=$3, ai_vocabulary=$4, ai_definitions=$5, ai_formulas=$6, ai_action_items=$7, ai_exam_mentions=$8, status='complete' where id=$9`,
        [analysis.title, analysis.summary, analysis.concepts || [], analysis.vocabulary || [], JSON.stringify(analysis.definitions || []), analysis.formulas || [], analysis.action_items || [], analysis.exam_mentions || [], lecture_id]);
    }

    try {
      const alreadyHave = (await pool.query('select 1 from flashcards where lecture_id = $1 limit 1', [lecture_id])).rows;
      if (alreadyHave.length === 0) {
        const fresh = (await pool.query('select * from lectures where id = $1', [lecture_id])).rows[0];
        await generateFlashcards(fresh, cls, userId, llmUsage);
      }
    } catch (e) { /* non-fatal: cards can be regenerated on demand */ }

    const settled = cost > 0 ? await spendCredits(balance, cost, operationId) : { ...balance, _operationAppliedNow: false };
    const chargedNow = settled?._operationAppliedNow === false ? 0 : cost;

    const geminiCalls = Number(llmUsage.geminiCalls || 0);
    const base44Calls = Number(llmUsage.base44Calls || 0);
    const providers = new Set();
    providers.add(transcriptionProvider === 'stored' ? null : transcriptionProvider);
    if (geminiCalls > 0) providers.add('gemini');
    providers.delete(null);
    const providerNames = [...providers];
    const provider = providerNames.length > 1 ? 'mixed' : (providerNames[0] || 'stored');
    const models = Object.keys(llmUsage.models);
    if (transcriptionProvider === 'groq') models.unshift(GROQ_MODEL);

    await logUsage({
      user_id: userId, feature: 'process_lecture', lecture_id, provider,
      model: [...new Set(models)].join(', ') || 'stored transcript',
      call_count: geminiCalls + base44Calls, base44_credits: base44Calls * 3,
      input_tokens: llmUsage.inputTokens, output_tokens: llmUsage.outputTokens, audio_seconds: audioSeconds,
      cedar_credits_charged: chargedNow, credit_operation_id: operationId,
      cost_cad: base44CostCad(base44Calls * 3) + llmUsage.costCad + (transcriptionProvider === 'groq' ? groqCostCad(audioSeconds) : 0),
      tier_at_time: balance.tier, success: true, latency_ms: Date.now() - started,
    });

    res.json({ status: 'complete', lecture_id, credits_charged: chargedNow });
  } catch (error) {
    // The catch used to be silent, which made provider failures invisible in
    // the service logs and impossible to diagnose after the fact.
    console.error('[recording] processing failed:', error?.message || error);

    // Everything past the duration check has already flipped the lecture to
    // 'processing'. Leaving it there strands the recording: the page reports
    // that it is still working and offers no way to try again. Hand it back as
    // 'pending' instead — any transcript already stored is kept, so a retry
    // resumes rather than paying for transcription twice.
    const strandedLectureId = req.body?.lecture_id;
    if (strandedLectureId) {
      try {
        await pool.query(
          "update lectures set status = 'pending' where id = $1 and user_id = $2 and status = 'processing'",
          [strandedLectureId, req.user.id],
        );
      } catch (cleanupError) {
        console.error('[recording] could not release the lecture:', cleanupError.message);
      }
    }

    const status = Number(error?.status) || 500;
    res.status(status >= 400 && status < 600 ? status : 500).json({ error: error.message || 'Recording processing failed' });
  }
});

export default router;
