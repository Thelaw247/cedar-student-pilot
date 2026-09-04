import express from 'express';
import { parseBlob } from 'music-metadata';
import { readWebmDurationSeconds, closeWebmTimestampGaps } from '../lib/webmDuration.js';
import { usableFlashcards } from '../lib/flashcards.js';
import { transcribeAudioParts, GROQ_MODEL, DEEPGRAM_MODEL } from '../lib/transcription.js';
import { pool } from '../lib/db.js';
import { cleanAnalysis } from '../lib/analysisSanity.js';
import { PROCESSING_STALE_MINUTES } from '../../shared/lectureStatus.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { invokeLLM, createLlmUsage, QUALITY_MODEL } from '../lib/llm.js';
import {
  getBalance, availableCredits, insufficientResponse, spendCredits,
  logUsage, durationCost, COST_PER_30MIN_PROCESS, transcriptionCostCad, base44CostCad,
} from '../lib/credits.js';
import { MAX_RECORDING_BYTES, resolveRecordingStorageRef } from '../lib/r2.js';
import { runEnrichment, syncLectureTodos } from '../lib/lectureEnrichment.js';
import { loadLectureMaterials } from '../lib/lectureMaterials.js';
import { scheduleAsap, addDaysStr, bookAssignmentSessions } from '../lib/studyScheduler.js';

// One review session per lecture, booked the moment processing finishes (3
// Sep 2026 rework, refactored 3 Sep 2026 onto the shared studyScheduler).
// Replaces the old client-side PostRecordingReviewPrompt, which force-booked
// FOUR spaced-repetition sessions per lecture (day 0, ~day 3, ~day 8, ~day
// 21) behind a blocking, un-skippable modal. The rule now: book on the
// lecture's own day if there's a free slot inside the student's preferred
// study windows, the very next day if there isn't, and stop there — no
// modal, no popup, it just appears on the calendar/planner. A fixed 20
// minutes, not the 30-90 the general study-session scheduler uses: this is a
// quick spaced-repetition pass, not a study block.
const REVIEW_MINUTES = 20;

async function scheduleLectureReview({ userId, lectureId, classId, lectureDate, lectureTitle }) {
  // Never double-book — a re-run of processing (retry, re-enrich) must not
  // stack a second review session onto the same lecture.
  //
  // Reads lecture_ids, which every session now carries (a session can cover
  // several lectures; lecture_id only ever held one). And scoped to the
  // owner: without the user_id predicate this asked "has ANYONE been booked
  // a review for this lecture", which is only harmless while lecture ids are
  // unique per student — a coincidence, not a rule.
  const already = await pool.query(
    'select 1 from study_sessions where user_id = $1 and $2 = any(lecture_ids) limit 1',
    [userId, lectureId],
  );
  if (already.rows.length > 0) return;
  if (!lectureDate) return;

  // Three days, not one. The scheduler allows a single session per calendar
  // day across everything already booked, so on a day with three lectures
  // the second and third reviews have to fall to the following days — with
  // the old two-day horizon they were silently dropped instead. Spacing them
  // out is also what a review pass is for.
  const [placement] = await scheduleAsap({
    userId, classId, count: 1, fromDate: lectureDate, horizonDate: addDaysStr(lectureDate, 3),
    minMinutes: REVIEW_MINUTES, maxMinutes: REVIEW_MINUTES,
  });
  if (!placement) return; // the lecture day and the three after it were all taken — leave it unscheduled

  // lecture_ids is what everything reads from here on; lecture_id is written
  // alongside for one release so anything still reading the old column keeps
  // working. The scheduler's own guard above already reads the new one.
  await pool.query(
    `insert into study_sessions (user_id, class_id, lecture_id, lecture_ids, scheduled_date, scheduled_time, duration_minutes, priority, status, session_type, title, notes)
     values ($1, $2, $3, array[$3::uuid], $4, $5, $6, 'medium', 'scheduled', 'review', $7, $8)`,
    [userId, classId, lectureId, placement.date, placement.time, placement.duration_minutes, `Review: ${lectureTitle || 'this lecture'}`,
      placement.date === lectureDate
        ? 'Auto-scheduled for the day of the lecture.'
        : `Auto-scheduled for ${placement.date} — the lecture day was already booked.`],
  );
}

// Explicit due-dated deliverables → real Assignment rows (Phase 4, 3 Sep
// 2026). extractFromTranscript's due_dated_items is deliberately strict (a
// vague "there's a project coming up" goes in exam_mentions, not here) —
// this is the second, cheaper gate: skip anything already past, and never
// create a duplicate of something that already exists (typed in by hand, or
// mentioned again in a later lecture). Booking goes through
// bookAssignmentSessions, the exact function generateStudySchedule.js's
// route uses, so an auto-detected assignment is scheduled no differently
// than one the student created themselves. Sets notified=false so
// AssignmentDetectedNotice.jsx surfaces it once, on the Home page.
async function detectAndCreateAssignments({ userId, classId, lectureId, dueDatedItems }) {
  if (!classId) return; // assignments require a class_id — nothing to attach this to
  const validated = mergeDueDatedItems([dueDatedItems]);
  if (validated.length === 0) return;

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  for (const item of validated) {
    if (item.due_date < today) continue;

    const existing = (await pool.query(
      'select id from assignments where user_id = $1 and class_id = $2 and due_date = $3 and lower(title) = lower($4) limit 1',
      [userId, classId, item.due_date, item.title],
    )).rows[0];
    if (existing) continue;

    const created = (await pool.query(
      `insert into assignments (user_id, class_id, title, due_date, type, status, source_lecture_id, auto_created, notified)
       values ($1, $2, $3, $4, $5, 'active', $6, true, false)
       returning *`,
      [userId, classId, item.title, item.due_date, item.type, lectureId],
    )).rows[0];

    await bookAssignmentSessions({ userId, assignment: created });
  }
}

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
// 1. Transcription needs a provider key. The original silently fell back to
//    Base44's Core.TranscribeAudio when GROQ_API_KEY was missing — that
//    integration does not exist on this stack. Groq is primary; since 2 Sep
//    Deepgram (DEEPGRAM_API_KEY) takes over when Groq refuses, because Groq
//    caps the whole account at 8 hours of audio a day. See lib/transcription.js.
//
// 2. Recordings must be user-owned R2 storage references. Arbitrary HTTPS URLs
//    are never fetched, even from a configured host; this prevents SSRF and
//    prevents one user from making the server process another user's object.

const router = express.Router();

const MAX_AUDIO_BYTES = MAX_RECORDING_BYTES;
const MAX_AUDIO_SECONDS = 6 * 60 * 60;
const EXTRACT_CHUNK_SIZE = 15000;
const NO_SPEECH = '[No speech detected in recording]';
// Node's fetch never times out on its own. Without these, a provider that
// accepts the connection and then goes quiet holds the request open
// indefinitely: the instance keeps the audio buffered, no error is ever
// raised, and the lecture stays stuck mid-processing.
const AUDIO_FETCH_TIMEOUT_MS = 60_000;

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

  // A recording made across a laptop sleep or a muted microphone carries the
  // whole elapsed time in its cluster timestamps, not just the audio. Close
  // those holes before measuring or transcribing: the duration is what the
  // student is billed for, and the transcription provider counts decoded
  // seconds against its hourly quota (see closeWebmTimestampGaps).
  const gaps = closeWebmTimestampGaps(buffer);
  if (gaps.gaps > 0) {
    console.log(`[recording] closed ${gaps.gaps} timeline hole(s) totalling ${Math.round(gaps.removedMs / 1000)}s in ${audioUrl}`);
  }

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

const DUE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DUE_DATED_TYPES = new Set(['exam', 'quiz', 'project', 'assignment']);
function mergeDueDatedItems(lists) {
  const seen = new Map();
  for (const list of lists) {
    for (const item of (list || [])) {
      const title = typeof item?.title === 'string' ? item.title.trim() : '';
      const type = DUE_DATED_TYPES.has(item?.type) ? item.type : null;
      const due_date = typeof item?.due_date === 'string' && DUE_DATE_RE.test(item.due_date) ? item.due_date : null;
      // Silently drop anything the model returned without a real title,
      // type, or parseable date — a vague or malformed mention is not worth
      // spinning up an assignment over, and the un-gated case (a due date in
      // the past) is filtered later, right before an assignment is created.
      if (!title || !type || !due_date) continue;
      const key = title.toLowerCase();
      if (!seen.has(key)) seen.set(key, { title, type, due_date });
    }
  }
  return [...seen.values()];
}

function splitInto(text, size) {
  const out = [];
  for (let i = 0; i < text.length; i += size) out.push(text.substring(i, i + size));
  return out;
}

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' }, summary: { type: 'string' },
    concepts: { type: 'array', items: { type: 'string' } }, vocabulary: { type: 'array', items: { type: 'string' } },
    definitions: { type: 'array', items: { type: 'object', properties: { term: { type: 'string' }, definition: { type: 'string' } } } },
    formulas: { type: 'array', items: { type: 'string' } }, action_items: { type: 'array', items: { type: 'string' } },
    exam_mentions: { type: 'array', items: { type: 'string' } },
    due_dated_items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          type: { type: 'string', enum: ['exam', 'quiz', 'project', 'assignment'] },
          due_date: { type: 'string' },
        },
      },
    },
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
9. Due-dated deliverables EXPLICITLY announced with an actual date (array of {title, type, due_date}, empty if none). type is one of exam/quiz/project/assignment. due_date must be YYYY-MM-DD, computed relative to this lecture's own date (${lectureDate}) — e.g. "due in two weeks" or "the 15th" resolves against that date, rolling into next year if the stated day/month has already passed this year. ONLY include an item here if a real date, deadline, or timeframe was stated out loud — never include something merely mentioned as "coming up" or "later this semester" with no date attached. This is deliberately stricter than exam_mentions above: a vague mention belongs only in exam_mentions, not here.

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
    due_dated_items: mergeDueDatedItems(parts.map((p) => p.due_dated_items)),
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
    response_json_schema: { type: 'object', properties: { flashcards: { type: 'array', items: { type: 'object', properties: { front: { type: 'string' }, back: { type: 'string' } }, required: ['front', 'back'] } } }, required: ['flashcards'] },
  });

  // The model has returned cards with no back (1 Sep, twice in a row). The
  // column is NOT NULL, so one such card used to abort the whole batch and the
  // student got no flashcards at all. Keep the complete ones.
  const cards = usableFlashcards(result?.flashcards);
  if (cards.length === 0) return;
  for (const fc of cards) {
    await pool.query('insert into flashcards (user_id, lecture_id, class_id, front, back, ai_generated) values ($1,$2,$3,$4,$5,true)',
      [userId, lecture.id, lecture.class_id, fc.front, fc.back]);
  }
}

// ---------------------------------------------------------------------------
// Asynchronous processing.
//
// Transcribing and analyzing a long lecture takes minutes — far longer than a
// browser, a mobile network, or a proxy will reliably hold one HTTP request
// open. The POST below therefore does only the cheap ownership and credit
// checks, atomically claims the lecture, starts the pipeline in the
// background, and answers 202 immediately; the client polls the lecture row
// until status leaves 'processing'.
//
// The claim is a conditional UPDATE, so a double submit (two tabs, an
// impatient retry) can never start the pipeline twice. A lecture stuck in
// 'processing' whose row hasn't been touched recently is treated as abandoned
// (the instance restarted or crashed mid-run) and may be re-claimed; together
// with the failure path releasing the lecture back to 'pending', no recording
// can be stranded forever. The pipeline itself touches the row at every stage
// (duration, transcript, analysis), which keeps updated_at fresh on live runs.
//
// One wrinkle: clients used to CREATE the lecture row with status 'processing'
// before ever calling this endpoint, which made a brand-new row look like a
// run already in flight and blocked it from ever starting. A row whose
// updated_at still equals created_at has never been touched by any pipeline
// (a real claim bumps updated_at immediately), so it is always claimable.

async function claimLecture(lectureId, userId) {
  const claimed = await pool.query(
    `update lectures set status = 'processing', processing_error = null
      where id = $1 and user_id = $2
        and (status <> 'processing'
             or updated_at = created_at
             or updated_at < now() - make_interval(mins => $3))
      returning id`,
    [lectureId, userId, PROCESSING_STALE_MINUTES],
  );
  return claimed.rows.length > 0;
}

async function releaseLecture(lectureId, userId, reason = '') {
  // Hand the lecture back as 'pending' so the UI stops saying it is being
  // worked on and the user can try again. Any transcript already stored is
  // kept, so a retry resumes rather than paying for transcription twice.
  // The reason is what the island and the lecture page show; without it a
  // per-hour quota looks like a bug to hammer.
  try {
    await pool.query(
      "update lectures set status = 'pending', processing_error = $3 where id = $1 and user_id = $2 and status = 'processing'",
      [lectureId, userId, reason ? String(reason).slice(0, 500) : null],
    );
  } catch (cleanupError) {
    console.error('[recording] could not release the lecture:', cleanupError.message);
  }
}

/**
 * Turn a provider error into the sentence the student sees. The wording is
 * load-bearing: shared/saveErrors.js classifies on it ("rate limit" → wait,
 * "24 MB" / "six hours" → will never work), so keep those phrases.
 */
export function describeProcessingFailure(error) {
  const text = String(error?.message || error || '');
  if (/per hour|ASPH|rate limit|too many requests/i.test(text)) {
    return 'Transcription rate limit reached for this hour. The recording is safe — try again in about an hour.';
  }
  if (/24 MB|six hours/i.test(text)) return text.slice(0, 300);
  if (/Gemini 5\d\d|high demand|UNAVAILABLE|overloaded/i.test(text)) {
    return 'The AI service was overloaded. The recording is safe — try again in a few minutes.';
  }
  if (/insufficient credits/i.test(text)) return 'Not enough credits to process this recording.';
  return text.slice(0, 300) || 'Processing failed.';
}

// The heavy work, run outside any HTTP request. Ownership, replay checks, and
// the minimum-balance gate have already passed; billing idempotency is still
// enforced here exactly as before (usage ledger + applied_credit_operations).
async function runProcessingPipeline({ userId, lectureId, existing, cls, balance, alreadyCharged, operationId }) {
  const started = Date.now();

  const { parts: verifiedParts, totalSeconds: audioSeconds } = await fetchVerifiedAudioParts(
    userId, existing.recording_url, existing.recording_parts,
  );
  const cost = alreadyCharged ? 0 : durationCost(audioSeconds, COST_PER_30MIN_PROCESS);

  await pool.query('update lectures set duration_seconds = $1 where id = $2', [audioSeconds, lectureId]);

  // The preflight gate used the client's estimate; this is the real measured
  // duration. If the true cost exceeds the balance after all, stop before any
  // provider call — the catch in the caller releases the lecture.
  if (cost > 0 && availableCredits(balance) < cost) {
    await logUsage({ user_id: userId, feature: 'process_lecture', lecture_id: lectureId, tier_at_time: balance.tier, success: false, refusal: 'credits', audio_seconds: audioSeconds });
    throw new Error(`insufficient credits for the measured duration (${audioSeconds}s needs ${cost})`);
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
      // Nothing to analyze and nothing to bill: mark it complete with the
      // sentinel transcript so the lecture page explains what happened.
      await pool.query('update lectures set status = $1, transcript = $2 where id = $3', ['complete', NO_SPEECH, lectureId]);
      return;
    }
    transcript = rawTranscript.trim();
    await pool.query('update lectures set transcript = $1, status = $2 where id = $3', [transcript, 'processing', lectureId]);
  }

  const lecture = (await pool.query('select * from lectures where id = $1', [lectureId])).rows[0];

  if (!lecture.ai_title) {
    // Everything the model wrote is bounded before it reaches a column. A
    // response_json_schema constrains the shape and not the size, and on
    // 3 Sep a stitched title looped into 252,075 characters and was stored
    // whole. See lib/analysisSanity.js.
    const analysis = cleanAnalysis(
      await extractFromTranscript(transcript, cls, lecture.date, llmUsage),
      { fallbackTitle: `Lecture — ${lecture.date}` },
    );
    await pool.query(
      `update lectures set ai_title=$1, ai_summary=$2, ai_concepts=$3, ai_vocabulary=$4, ai_definitions=$5, ai_formulas=$6, ai_action_items=$7, ai_exam_mentions=$8, status='complete' where id=$9`,
      [analysis.title, analysis.summary, analysis.concepts || [], analysis.vocabulary || [], JSON.stringify(analysis.definitions || []), analysis.formulas || [], analysis.action_items || [], analysis.exam_mentions || [], lectureId]);

    try {
      await detectAndCreateAssignments({ userId, classId: cls?.id, lectureId, dueDatedItems: analysis.due_dated_items });
    } catch (e) {
      // Non-fatal — the lecture and its analysis are already saved; nothing
      // was detected that the student can't still add manually.
      console.error('[recording] due-dated item detection failed:', e?.message || e);
    }
  } else {
    await pool.query("update lectures set status = 'complete' where id = $1", [lectureId]);
  }

  // Second pass: the structured study page (outline, concept cards with
  // transcript anchors, formulas verified against attached materials, worked
  // examples, exam radar, to-dos). See lib/lectureEnrichment.js. Runs after
  // status='complete' so the base analysis is visible while this finishes;
  // the page polls enriched_at and fills in when it lands. Non-fatal: the
  // student can re-run it from the lecture page (enrich-lecture route).
  try {
    const current = (await pool.query('select * from lectures where id = $1', [lectureId])).rows[0];
    if (!current.enriched_at) {
      const materialRows = await loadLectureMaterials(pool, userId, lectureId);
      const enrichment = await runEnrichment({
        transcript, cls, lectureDate: current.date,
        base: { title: current.ai_title, summary: current.ai_summary },
        materialRows, llmUsage,
      });
      await pool.query('update lectures set ai_enrichment = $1, enriched_at = now() where id = $2', [JSON.stringify(enrichment), lectureId]);
      await syncLectureTodos(pool, { userId, lecture: current, todos: enrichment.todos });
    }
  } catch (e) {
    console.error('[recording] enrichment failed (base analysis is stored; re-run from the lecture page):', e?.message || e);
  }

  try {
    const alreadyHave = (await pool.query('select 1 from flashcards where lecture_id = $1 limit 1', [lectureId])).rows;
    if (alreadyHave.length === 0) {
      const fresh = (await pool.query('select * from lectures where id = $1', [lectureId])).rows[0];
      await generateFlashcards(fresh, cls, userId, llmUsage);
    }
  } catch (e) {
    // Non-fatal — cards can be generated on demand from the Practice tab —
    // but never silent: an invisible failure here cost a debugging session.
    console.error('[recording] flashcard generation failed:', e?.message || e);
  }

  try {
    const fresh = (await pool.query('select date, ai_title from lectures where id = $1', [lectureId])).rows[0];
    await scheduleLectureReview({
      userId, lectureId, classId: cls?.id, lectureDate: fresh?.date, lectureTitle: fresh?.ai_title,
    });
  } catch (e) {
    // Non-fatal — the lecture and its analysis are already saved; a review
    // session can still be booked manually from the Study tab.
    console.error('[recording] auto-scheduling the review session failed:', e?.message || e);
  }

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
  if (transcriptionProvider === 'groq' || transcriptionProvider === 'mixed') models.unshift(GROQ_MODEL);
  if (transcriptionProvider === 'deepgram' || transcriptionProvider === 'mixed') models.unshift(DEEPGRAM_MODEL);

  await logUsage({
    user_id: userId, feature: 'process_lecture', lecture_id: lectureId, provider,
    model: [...new Set(models)].join(', ') || 'stored transcript',
    call_count: geminiCalls + base44Calls, base44_credits: base44Calls * 3,
    input_tokens: llmUsage.inputTokens, output_tokens: llmUsage.outputTokens, audio_seconds: audioSeconds,
    cedar_credits_charged: chargedNow, credit_operation_id: operationId,
    cost_cad: base44CostCad(base44Calls * 3) + llmUsage.costCad + transcriptionCostCad(transcriptionProvider, audioSeconds),
    tier_at_time: balance.tier, success: true, latency_ms: Date.now() - started,
  });

  console.log('[recording] processing complete for lecture', lectureId, 'in', Date.now() - started, 'ms');
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
        await logUsage({ user_id: userId, feature: 'process_lecture', tier_at_time: balance.tier, success: false, refusal: 'credits', audio_seconds: estimatedSeconds });
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
    const balance = await getBalance(userId);
    alreadyCharged = alreadyCharged || (balance.applied_credit_operations || []).includes(operationId);

    if (alreadyCharged && existing.status === 'complete' && existing.ai_title) {
      return res.json({ status: 'complete', lecture_id, credits_charged: 0 });
    }

    const minimumCost = durationCost(1, COST_PER_30MIN_PROCESS);
    if (!alreadyCharged && availableCredits(balance) < minimumCost) {
      await logUsage({ user_id: userId, feature: 'process_lecture', lecture_id, tier_at_time: balance.tier, success: false, refusal: 'credits' });
      return insufficientResponse(res, 'process_lecture', minimumCost, balance);
    }

    // Everything cheap has passed. Claim the lecture (or discover another
    // request already has it) and hand the heavy work to the background.
    const claimed = await claimLecture(lecture_id, userId);
    if (!claimed) {
      return res.status(202).json({ status: 'processing', lecture_id, already_processing: true });
    }

    runProcessingPipeline({ userId, lectureId: lecture_id, existing, cls, balance, alreadyCharged, operationId })
      .catch(async (error) => {
        console.error('[recording] processing failed:', error?.message || error);
        await releaseLecture(lecture_id, userId, describeProcessingFailure(error));
      });

    return res.status(202).json({ status: 'processing', lecture_id });
  } catch (error) {
    console.error('[recording] request failed:', error?.message || error);
    const status = Number(error?.status) || 500;
    res.status(status >= 400 && status < 600 ? status : 500).json({ error: error.message || 'Recording processing failed' });
  }
});

export default router;
