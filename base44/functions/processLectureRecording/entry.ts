import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { parseBlob } from 'npm:music-metadata@11.15.0';
import { secrets } from 'base44:runtime';
import { invokeLLM, QUALITY_MODEL } from '../../shared/llm.ts';
import {
  getBalance, availableCredits, insufficientResponse, spendCredits,
  logUsage, durationCost, COST_PER_30MIN_PROCESS, groqCostCad, base44CostCad,
} from '../../shared/credits.ts';

// ---- Transcription routing ------------------------------------------------
// Groq's whisper-large-v3-turbo costs ~$0.04 USD/hr against its own API key and
// consumes ZERO Base44 integration credits, versus Core.TranscribeAudio whose
// credit cost is undocumented and which counts against the shared 20,000/month
// pool that caps the entire app.
//
// Set the key with:  base44 secrets set GROQ_API_KEY
// With no key set, this falls back to Core.TranscribeAudio unchanged, so this
// file is safe to deploy before the key exists.
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_MODEL = 'whisper-large-v3-turbo';
// Groq caps uploads at 25MB on the free tier (100MB on dev). Stay under it and
// let anything larger fall through to Base44 rather than failing the lecture.
const GROQ_MAX_BYTES = 24 * 1024 * 1024;
const MAX_AUDIO_BYTES = 200 * 1024 * 1024;
const MAX_AUDIO_SECONDS = 6 * 60 * 60;

class RequestError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Accept only uploads created inside this Base44 app. This prevents the
 * function from becoming an authenticated proxy that fetches/transcribes an
 * arbitrary caller-supplied URL.
 */
function trustedRecordingUrl(rawUrl: string): string {
  const appId = Deno.env.get('BASE44_APP_ID') || secrets.get('BASE44_APP_ID') || '';
  if (!appId) throw new RequestError('Recording validation is temporarily unavailable', 503);

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new RequestError('The lecture does not have a valid recording URL');
  }

  const expectedPrefix = `/api/apps/${appId}/files/`;
  if (url.protocol !== 'https:' || url.hostname !== 'base44.app' || !url.pathname.startsWith(expectedPrefix)) {
    throw new RequestError('The recording must be an upload owned by this Cedar app');
  }
  return url.toString();
}

/** Fetch once, cap resource use, and derive billing duration from the media. */
async function fetchVerifiedAudio(rawUrl: string) {
  const audioUrl = trustedRecordingUrl(rawUrl);
  let response: Response;
  try {
    response = await fetch(audioUrl, { redirect: 'error' });
  } catch {
    throw new RequestError('The stored recording could not be retrieved', 422);
  }
  if (!response.ok) throw new RequestError(`The stored recording could not be retrieved (${response.status})`, 422);

  const declaredBytes = Number(response.headers.get('content-length') || 0);
  if (declaredBytes > MAX_AUDIO_BYTES) throw new RequestError('Recordings must be 200 MB or smaller', 413);

  const blob = await response.blob();
  if (!blob.size) throw new RequestError('The stored recording is empty', 422);
  if (blob.size > MAX_AUDIO_BYTES) throw new RequestError('Recordings must be 200 MB or smaller', 413);

  let durationSeconds = 0;
  try {
    const metadata = await parseBlob(blob, { duration: true });
    durationSeconds = Math.ceil(Number(metadata?.format?.duration || 0));
  } catch (error) {
    console.error('[recording] duration parse failed:', (error as Error).message);
  }

  if (!Number.isFinite(durationSeconds) || durationSeconds < 1) {
    throw new RequestError('The recording duration could not be verified. Please record again or contact support.', 422);
  }
  if (durationSeconds > MAX_AUDIO_SECONDS) {
    throw new RequestError('Recordings must be six hours or shorter', 413);
  }

  return { audioUrl, blob, durationSeconds };
}

// DO NOT pin a `model` on these calls.
//
// Base44 bills integration credits PER CALL, not per token. Current rate card:
//   invokeLLM (Automatic)      ~3 credits per call   <- cheapest tier
//   invokeLLM (Gemini 3 Flash) ~5 credits per call
//   invokeLLM (GPT-5)         ~15 credits per call
//   automation run             1 credit, even if it does nothing
//   UploadFile                 1 credit per upload
//   database reads/writes      0 credits
//
// Pinning gemini_3_flash on the cleaning pass — the highest-volume call in the
// app, 4-5 per lecture — cost 5 credits where Automatic costs 3. Token volume
// does not affect the bill at all, so the only levers that matter are the
// NUMBER of calls and which model tier each one uses.
//
// TRANSCRIPT CLEANING IS NOT DONE HERE ANYMORE.
// It used to run automatically on every recording and was ~45% of this
// pipeline's credits, for a pass that only improves readability — extraction,
// concepts, exam mentions and flashcards all work fine on raw speech-to-text.
// It now lives in the cleanLectureTranscript function, triggered by a button on
// the lecture page, so only the noisy recordings that actually need it pay.
//
// This pipeline is now ~6 InvokeLLM calls for a 60-minute lecture (4 extraction
// chunks + 1 stitch + 1 flashcards) = ~18 credits, plus 1 for the audio upload,
// plus whatever TranscribeAudio costs.
//
// SCALE NOTE: backend functions can fetch() third-party APIs and read keys via
// secrets.get() from 'base44:runtime'. Calls made that way cost ZERO Base44
// credits and have no ceiling. Moving this pipeline to a direct Whisper + LLM
// key is the intended path before user growth hits the cap above.

// Characters of transcript fed to one extraction call. Long lectures are split
// across several calls and merged, so late-lecture content is never lost.
// Previously extraction ran on transcript.substring(0, 15000) only, which meant
// anything a professor said after roughly the first quarter of a long lecture
// was invisible to the app — including end-of-lecture exam announcements, which
// predictExamTopics weights higher than any other signal.
const EXTRACT_CHUNK_SIZE = 15000;

/** Case-insensitive union that keeps the first-seen spelling of each entry. */
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

/** Same idea for {term, definition} pairs, keyed on the term. */
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

const asText = (result) => (typeof result === 'string' ? result : (result?.text || String(result ?? '')));

/** How many LLM calls this transcript required — used for cost attribution. */
function existingLecture_llmCalls(transcript: string): number {
  const chunks = Math.max(1, Math.ceil((transcript || '').length / EXTRACT_CHUNK_SIZE));
  return chunks + (chunks > 1 ? 1 : 0) + 1; // chunks + stitch + flashcards
}

/** Transcribe via Groq. Throws on any problem so the caller can fall back. */
async function transcribeViaGroq(blob: Blob, apiKey: string): Promise<string> {
  if (blob.size > GROQ_MAX_BYTES) {
    throw new Error(`file is ${(blob.size / 1048576).toFixed(1)}MB, over the Groq limit`);
  }

  const form = new FormData();
  form.append('file', blob, 'lecture.webm');
  form.append('model', GROQ_MODEL);
  form.append('response_format', 'json');

  const res = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Groq ${res.status}: ${detail.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = (data?.text || '').trim();
  // Groq is known to answer 200 with an empty body on oversized or unsupported
  // files rather than erroring, so a status check alone is not enough.
  if (!text) throw new Error('Groq returned an empty transcript');
  return text;
}

/**
 * Transcribe a recording, preferring Groq and falling back to Base44.
 *
 * The fallback deliberately costs credits: losing a student's lecture is worse
 * than an unexpected credit charge. Every fallback is logged so a misconfigured
 * key shows up in the function logs instead of silently draining the pool.
 */
async function transcribeAudio(base44, audioUrl: string, blob: Blob): Promise<{ text: string; provider: 'groq' | 'base44' }> {
  // secrets.get() must be called per-request, never at module load.
  const groqKey = secrets.get('GROQ_API_KEY');

  if (groqKey) {
    try {
      const text = await transcribeViaGroq(blob, groqKey);
      console.log('[transcribe] groq ok,', text.length, 'chars');
      return { text, provider: 'groq' };
    } catch (e) {
      console.error('[transcribe] groq failed, falling back to Base44 (this costs credits):', e.message);
    }
  }

  const result = await base44.asServiceRole.integrations.Core.TranscribeAudio({ audio_url: audioUrl });
  const text = typeof result === 'string' ? result : (result.text || JSON.stringify(result));
  return { text, provider: 'base44' };
}

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    concepts: { type: 'array', items: { type: 'string' } },
    vocabulary: { type: 'array', items: { type: 'string' } },
    definitions: { type: 'array', items: { type: 'object', properties: { term: { type: 'string' }, definition: { type: 'string' } } } },
    formulas: { type: 'array', items: { type: 'string' } },
    action_items: { type: 'array', items: { type: 'string' } },
    exam_mentions: { type: 'array', items: { type: 'string' } }
  }
};

/**
 * Extract structured content from the WHOLE transcript.
 *
 * Short lectures take a single call, exactly as before. Long ones are extracted
 * per chunk and merged: array fields are unioned deterministically in JS (no
 * extra token cost), and one small final call stitches the per-chunk summaries
 * into a single coherent title + summary.
 */
async function extractFromTranscript(base44, transcript, cls, lectureDate) {
  const className = cls?.name || 'Unknown';
  const instructor = cls?.instructor || 'Unknown instructor';

  const extractOne = async (text, part, total) => {
    const scope = total > 1
      ? `This is part ${part} of ${total} of a single lecture transcript. Extract only what appears in THIS part; the parts are merged afterwards.`
      : '';
    // Routed through the shared helper: uses your own Gemini key when
    // GEMINI_API_KEY is set (0 Base44 credits), else falls back to Core.InvokeLLM.
    // Pinned to the stronger model — these concepts and exam mentions are what
    // the exam-coverage feature runs on.
    const result = await invokeLLM(base44, {
      model: QUALITY_MODEL,
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
      response_json_schema: EXTRACTION_SCHEMA
    });
    return result || {};
  };

  const chunks = splitInto(transcript, EXTRACT_CHUNK_SIZE);

  if (chunks.length <= 1) {
    return await extractOne(transcript, 1, 1);
  }

  const parts = [];
  for (let i = 0; i < chunks.length; i++) {
    parts.push(await extractOne(chunks[i], i + 1, chunks.length));
  }

  const merged = {
    concepts: mergeStrings(parts.map(p => p.concepts)),
    vocabulary: mergeStrings(parts.map(p => p.vocabulary)),
    definitions: mergeDefinitions(parts.map(p => p.definitions)),
    formulas: mergeStrings(parts.map(p => p.formulas)),
    action_items: mergeStrings(parts.map(p => p.action_items)),
    exam_mentions: mergeStrings(parts.map(p => p.exam_mentions)),
  };

  // Small, cheap stitching call — it only ever sees the part summaries, never
  // the transcript again.
  const partSummaries = parts
    .map((p, i) => `Part ${i + 1}: ${p.summary || ''}`)
    .join('\n\n');

  try {
    const stitched = await invokeLLM(base44, {
      prompt: `These are section summaries from one university lecture in "${className}", in order. Combine them into a single coherent summary of the whole lecture (2-3 paragraphs) and give the lecture one concise descriptive title (5-8 words). Do not invent anything not present below.

${partSummaries}`,
      response_json_schema: {
        type: 'object',
        properties: { title: { type: 'string' }, summary: { type: 'string' } }
      }
    });
    merged.title = stitched?.title || parts[0]?.title || '';
    merged.summary = stitched?.summary || parts.map(p => p.summary).filter(Boolean).join('\n\n');
  } catch (e) {
    // Stitching is a nicety — fall back to the first part's title and the
    // concatenated summaries rather than failing the whole extraction.
    merged.title = parts[0]?.title || '';
    merged.summary = parts.map(p => p.summary).filter(Boolean).join('\n\n');
  }

  return merged;
}

/**
 * Build flashcards from the extracted concepts and definitions rather than the
 * raw transcript. Cheaper, and it covers the entire lecture instead of only the
 * first 12,000 characters as before.
 */
async function generateFlashcards(base44, lecture, cls, userId) {
  const concepts = (lecture.ai_concepts || []).join(', ');
  const definitions = (lecture.ai_definitions || []).map(d => `${d.term}: ${d.definition}`).join('\n');
  const formulas = (lecture.ai_formulas || []).join('\n');

  if (!concepts && !definitions && !formulas) return;

  // Cheap model is fine here — it reformats content that extraction already produced.
  const result = await invokeLLM(base44, {
    prompt: `Create 8 study flashcards for a university lecture in "${cls?.name || 'the class'}" titled "${lecture.ai_title || 'Untitled'}". Each flashcard has a front (question or term) and a back (answer or definition). Focus on the most important material and spread the cards across the whole lecture, not just the beginning.

Lecture summary:
${lecture.ai_summary || '(none)'}

Key concepts: ${concepts || '(none)'}

Definitions:
${definitions || '(none)'}

Formulas:
${formulas || '(none)'}`,
    response_json_schema: {
      type: 'object',
      properties: {
        flashcards: {
          type: 'array',
          items: {
            type: 'object',
            properties: { front: { type: 'string' }, back: { type: 'string' } }
          }
        }
      }
    }
  });

  const cards = result?.flashcards || [];
  if (cards.length === 0) return;

  await base44.entities.Flashcard.bulkCreate(cards.map(fc => ({
    lecture_id: lecture.id,
    class_id: lecture.class_id,
    front: fc.front,
    back: fc.back,
    ai_generated: true,
    user_id: userId
  })));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { lecture_id, audio_url } = body;
    if (!lecture_id || !audio_url) return Response.json({ error: 'lecture_id and audio_url are required' }, { status: 400 });

    // ---- CREDIT GATE -------------------------------------------------------
    // Checked BEFORE any work and charged only AFTER success. A lecture that
    // was already transcribed is free to resume, so a retry after a partial
    // failure never charges twice.
    const started = Date.now();
    const balance = await getBalance(base44, user.id);

    // Every stage below is resumable. Transcription and the cleaning pass are by
    // far the most expensive work in the app, so a failure later in the pipeline
    // must never make the caller pay for them twice. Each stage checks whether
    // its output is already persisted and skips if so.
    // Tolerate this lookup failing: it's only an optimisation, and the original
    // pipeline didn't read the lecture until after transcription. A miss here
    // must not block processing a brand-new recording.
    let existing = null;
    try {
      existing = await base44.entities.Lecture.get(lecture_id);
    } catch (e) { /* treat as a fresh lecture */ }

    const NO_SPEECH = '[No speech detected in recording]';
    const hasTranscript = !!(existing?.transcript && existing.transcript.trim() && existing.transcript !== NO_SPEECH);

    let transcript = hasTranscript ? existing.transcript.trim() : '';

    // Only charge for work not already done. Resuming a half-processed lecture
    // is free because the expensive part is already paid for.
    const audioSeconds = existing?.duration_seconds || 0;
    const cost = hasTranscript ? 0 : durationCost(audioSeconds, COST_PER_30MIN_PROCESS);

    if (cost > 0 && availableCredits(balance) < cost) {
      await logUsage(base44, {
        user_id: user.id, feature: 'process_lecture', lecture_id,
        tier_at_time: balance.tier, success: false, audio_seconds: audioSeconds,
      });
      return insufficientResponse('process_lecture', cost, balance);
    }

    if (!hasTranscript) {
      const rawTranscript = await transcribeAudio(base44, audio_url);

      if (!rawTranscript || rawTranscript.trim().length === 0) {
        await base44.entities.Lecture.update(lecture_id, { status: 'complete', transcript: NO_SPEECH });
        return Response.json({ error: 'No speech detected' }, { status: 400 });
      }

      // Stored raw. The student can run cleanLectureTranscript later if this
      // particular recording came out noisy.
      transcript = rawTranscript.trim();

      // Persist before any further LLM work, so a later failure resumes from
      // here instead of paying for transcription twice.
      await base44.entities.Lecture.update(lecture_id, { transcript, status: 'processing' });
    }

    const lecture = await base44.entities.Lecture.get(lecture_id);
    const cls = lecture.class_id ? await base44.entities.Class.get(lecture.class_id) : null;

    if (!lecture.ai_title) {
      const analysis = await extractFromTranscript(base44, transcript, cls, lecture.date);
      await base44.entities.Lecture.update(lecture_id, {
        ai_title: analysis.title,
        ai_summary: analysis.summary,
        ai_concepts: analysis.concepts || [],
        ai_vocabulary: analysis.vocabulary || [],
        ai_definitions: analysis.definitions || [],
        ai_formulas: analysis.formulas || [],
        ai_action_items: analysis.action_items || [],
        ai_exam_mentions: analysis.exam_mentions || [],
        status: 'complete'
      });
    }

    // Flashcards are non-fatal and idempotent. Previously a failure here
    // returned 500 on an otherwise-successful lecture, and the client retry
    // re-paid for the entire pipeline AND duplicated the cards.
    try {
      const alreadyHave = await base44.entities.Flashcard.filter({ lecture_id });
      if (!alreadyHave || alreadyHave.length === 0) {
        const fresh = await base44.entities.Lecture.get(lecture_id);
        await generateFlashcards(base44, fresh, cls, user.id);
      }
    } catch (e) {
      // Lecture itself is complete; cards can be regenerated on demand.
    }

    // ---- CHARGE + LOG (success path only) ----------------------------------
    if (cost > 0) await spendCredits(base44, balance, cost);

    const usedGroq = !!secrets.get('GROQ_API_KEY');
    const usedGemini = !!secrets.get('GEMINI_API_KEY');
    const llmCalls = existingLecture_llmCalls(transcript);
    await logUsage(base44, {
      user_id: user.id,
      feature: 'process_lecture',
      lecture_id,
      provider: usedGemini ? 'gemini' : 'base44',
      model: usedGemini ? QUALITY_MODEL : 'automatic',
      call_count: llmCalls,
      // UploadFile is charged regardless; LLM credits only when NOT on own keys.
      base44_credits: 1 + (usedGemini ? 0 : llmCalls * 3),
      audio_seconds: audioSeconds,
      cedar_credits_charged: cost,
      cost_cad: base44CostCad(1 + (usedGemini ? 0 : llmCalls * 3)) + (usedGroq ? groqCostCad(audioSeconds) : 0),
      tier_at_time: balance.tier,
      success: true,
      latency_ms: Date.now() - started,
    });

    return Response.json({ status: 'complete', lecture_id, credits_charged: cost });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});