import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Characters of transcript fed to one cleaning call. Unchanged from before.
const CLEAN_CHUNK_SIZE = 12000;

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
 * Clean raw speech-to-text while preserving the professor's voice.
 * Unchanged in behaviour — only lifted out of the request handler so the
 * pipeline can skip it entirely when a cleaned transcript already exists.
 */
async function cleanTranscript(base44, rawTranscript) {
  const cleanOne = async (text, isChunk) => {
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a professional transcript editor for university lecture recordings. ${isChunk ? 'Clean up this raw speech-to-text chunk' : 'Your job is to clean up raw speech-to-text'} WITHOUT flattening the professor's voice. The value of this transcript is that it preserves how THIS professor actually explained things — their characteristic phrases, their emphasis, the cues a student will recognize later. Stay faithful to their wording.

DO fix (never compromise on these):
1. Punctuation, capitalization, and sentence boundaries
2. Spelling and obvious speech-to-text errors (homophones, misheard technical terms) using context — no misspelled words in the output
3. Genuine transcription garble: nonsensical fragments, noise artifacts, and words the recognizer clearly got wrong
4. Stutter-type repetition and false starts ONLY when they are disfluencies, e.g. "I think th- I think that" becomes "I think that"
5. Add paragraph breaks at natural topic transitions

DO NOT do (this is what preserves the professor's voice):
1. Do NOT summarize, paraphrase, or shorten — keep the professor's actual words and sentence structure
2. Do NOT remove a phrase just because the professor repeats it across the lecture. Deliberate repetition ("again, the key idea here is...", "remember...", "this is important...") is exactly what helps recall — keep every instance
3. Do NOT strip verbal cues and discourse markers that carry the professor's style ("so", "now", "okay so", "right", "the thing to notice is"). Keep them where they reflect how the professor actually talks. Only drop pure meaningless filler ("um", "uh", "er")
4. Do NOT standardize the professor's phrasing into generic textbook language — if they said "this guy blows up" about a term going to infinity, keep their words

The goal: read it back and it should sound like the professor talking, cleanly punctuated and correctly spelled — not like a summary of what they said.

Raw transcript${isChunk ? ' chunk' : ''}:
${text}

Return ONLY the cleaned transcript text, nothing else. No preamble, no explanation.`,
    });
    return asText(result);
  };

  if (rawTranscript.length <= CLEAN_CHUNK_SIZE) {
    return (await cleanOne(rawTranscript, false)).trim();
  }

  const cleanedChunks = [];
  for (const chunk of splitInto(rawTranscript, CLEAN_CHUNK_SIZE)) {
    cleanedChunks.push(await cleanOne(chunk, true));
  }
  return cleanedChunks.join('\n\n').trim();
}

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
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
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
    const stitched = await base44.asServiceRole.integrations.Core.InvokeLLM({
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
async function generateFlashcards(base44, lecture, cls) {
  const concepts = (lecture.ai_concepts || []).join(', ');
  const definitions = (lecture.ai_definitions || []).map(d => `${d.term}: ${d.definition}`).join('\n');
  const formulas = (lecture.ai_formulas || []).join('\n');

  if (!concepts && !definitions && !formulas) return;

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
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

  await base44.asServiceRole.entities.Flashcard.bulkCreate(cards.map(fc => ({
    lecture_id: lecture.id,
    class_id: lecture.class_id,
    front: fc.front,
    back: fc.back,
    ai_generated: true
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

    // Every stage below is resumable. Transcription and the cleaning pass are by
    // far the most expensive work in the app, so a failure later in the pipeline
    // must never make the caller pay for them twice. Each stage checks whether
    // its output is already persisted and skips if so.
    // Tolerate this lookup failing: it's only an optimisation, and the original
    // pipeline didn't read the lecture until after transcription. A miss here
    // must not block processing a brand-new recording.
    let existing = null;
    try {
      existing = await base44.asServiceRole.entities.Lecture.get(lecture_id);
    } catch (e) { /* treat as a fresh lecture */ }

    const NO_SPEECH = '[No speech detected in recording]';
    const hasTranscript = !!(existing?.transcript && existing.transcript.trim() && existing.transcript !== NO_SPEECH);

    let transcript = hasTranscript ? existing.transcript.trim() : '';

    if (!hasTranscript) {
      const transcriptResult = await base44.asServiceRole.integrations.Core.TranscribeAudio({ audio_url });
      const rawTranscript = typeof transcriptResult === 'string' ? transcriptResult : transcriptResult.text || JSON.stringify(transcriptResult);

      if (!rawTranscript || rawTranscript.trim().length === 0) {
        await base44.asServiceRole.entities.Lecture.update(lecture_id, { status: 'complete', transcript: NO_SPEECH });
        return Response.json({ error: 'No speech detected' }, { status: 400 });
      }

      transcript = await cleanTranscript(base44, rawTranscript);

      // Persist before any further LLM work, so a later failure resumes from
      // here instead of re-transcribing and re-cleaning.
      await base44.asServiceRole.entities.Lecture.update(lecture_id, { transcript, status: 'processing' });
    }

    const lecture = await base44.asServiceRole.entities.Lecture.get(lecture_id);
    const cls = lecture.class_id ? await base44.asServiceRole.entities.Class.get(lecture.class_id) : null;

    if (!lecture.ai_title) {
      const analysis = await extractFromTranscript(base44, transcript, cls, lecture.date);
      await base44.asServiceRole.entities.Lecture.update(lecture_id, {
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
      const alreadyHave = await base44.asServiceRole.entities.Flashcard.filter({ lecture_id });
      if (!alreadyHave || alreadyHave.length === 0) {
        const fresh = await base44.asServiceRole.entities.Lecture.get(lecture_id);
        await generateFlashcards(base44, fresh, cls);
      }
    } catch (e) {
      // Lecture itself is complete; cards can be regenerated on demand.
    }

    return Response.json({ status: 'complete', lecture_id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
