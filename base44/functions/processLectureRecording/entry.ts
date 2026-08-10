import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Characters of transcript fed to a single extraction call. Long lectures are
// split across several calls and merged, so late-lecture content is never lost.
const EXTRACT_CHUNK_SIZE = 15000;

// Case-insensitive union that keeps the first-seen spelling of each entry.
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

// Same idea for {term, definition} pairs, keyed on the term.
function mergeDefinitions(lists) {
  const seen = new Map();
  for (const list of lists) {
    for (const def of (list || [])) {
      const term = def?.term?.trim();
      if (!term) continue;
      const key = term.toLowerCase();
      if (!seen.has(key)) seen.set(key, { term, definition: def.definition || '' });
    }
  }
  return [...seen.values()];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { lecture_id, audio_url } = body;
    if (!lecture_id || !audio_url) return Response.json({ error: 'lecture_id and audio_url are required' }, { status: 400 });

    // Every stage below is resumable. Transcription and the cleaning pass are
    // by far the most expensive work in the app, so a failure late in the
    // pipeline must never force the caller to pay for them a second time. Each
    // stage checks whether its output is already persisted and skips if so.
    const existing = await base44.asServiceRole.entities.Lecture.get(lecture_id);
    const hasTranscript = !!(existing?.transcript && existing.transcript.trim() && existing.transcript !== '[No speech detected in recording]');

    let transcript = hasTranscript ? existing.transcript.trim() : '';

    if (!hasTranscript) {
      // Step 1: Transcribe the audio
      const transcriptResult = await base44.asServiceRole.integrations.Core.TranscribeAudio({ audio_url });
      const rawTranscript = typeof transcriptResult === 'string' ? transcriptResult : transcriptResult.text || JSON.stringify(transcriptResult);

      if (!rawTranscript || rawTranscript.trim().length === 0) {
        await base44.asServiceRole.entities.Lecture.update(lecture_id, { status: 'complete', transcript: '[No speech detected in recording]' });
        return Response.json({ error: 'No speech detected' }, { status: 400 });
      }

      transcript = await cleanTranscript(base44, rawTranscript);

      // Persist immediately, before any further LLM work. If analysis fails,
      // a retry resumes from here instead of re-transcribing and re-cleaning.
      await base44.asServiceRole.entities.Lecture.update(lecture_id, { transcript, status: 'processing' });
    }

    // Step 3: Get class context
    const lecture = await base44.asServiceRole.entities.Lecture.get(lecture_id);
    const cls = lecture.class_id ? await base44.asServiceRole.entities.Class.get(lecture.class_id) : null;

    // Step 4: Extract structured content — skipped if already done.
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

    // Step 5: Flashcards. Non-fatal and idempotent — previously a failure here
    // returned 500 on an otherwise-successful lecture, and the retry both
    // re-paid for the whole pipeline and duplicated the cards.
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

/** Clean raw speech-to-text while preserving the professor's voice. */
async function cleanTranscript(base44, rawTranscript) {
    // For long recordings (60+ min), chunk the transcript and clean each section
    const CHUNK_SIZE = 12000;
    let cleanTranscript = '';

    if (rawTranscript.length <= CHUNK_SIZE) {
      const cleanResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are a professional transcript editor for university lecture recordings. Your job is to clean up raw speech-to-text WITHOUT flattening the professor's voice. The value of this transcript is that it preserves how THIS professor actually explained things — their characteristic phrases, their emphasis, the cues a student will recognize later. Stay faithful to their wording.

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

Raw transcript:
${rawTranscript}

Return ONLY the cleaned transcript text, nothing else. No preamble, no explanation.`,
      });
      cleanTranscript = typeof cleanResult === 'string' ? cleanResult : (cleanResult.text || String(cleanResult));
    } else {
      // Chunk and clean for long recordings
      const chunks = [];
      for (let i = 0; i < rawTranscript.length; i += CHUNK_SIZE) {
        chunks.push(rawTranscript.substring(i, i + CHUNK_SIZE));
      }
      const cleanedChunks = [];
      for (const chunk of chunks) {
        const cleanResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are a professional transcript editor for university lecture recordings. Clean up this raw speech-to-text chunk WITHOUT flattening the professor's voice — preserve how THIS professor actually explained things (their characteristic phrases, emphasis, and cues), because that is what helps a student recall the lecture.

DO fix (never compromise on these):
1. Punctuation, capitalization, and sentence boundaries
2. Spelling and obvious speech-to-text errors (homophones, misheard technical terms) using context — no misspelled words
3. Genuine transcription garble: nonsensical fragments and noise artifacts
4. Stutter-type repetition and false starts ONLY when they are disfluencies ("I think th- I think that" -> "I think that")
5. Add paragraph breaks at natural topic transitions

DO NOT do:
1. Do NOT summarize, paraphrase, or shorten — keep the professor's actual words and sentence structure
2. Do NOT remove deliberate repetition ("again...", "remember...", "this is important...") — keep every instance; it aids recall
3. Do NOT strip discourse markers that carry the professor's style ("so", "now", "okay so", "right") — only drop pure filler ("um", "uh", "er")
4. Do NOT standardize their phrasing into generic textbook language

Raw transcript chunk:
${chunk}

Return ONLY the cleaned transcript text, nothing else.`,
        });
        cleanedChunks.push(typeof cleanResult === 'string' ? cleanResult : (cleanResult.text || String(cleanResult)));
      }
      cleanTranscript = cleanedChunks.join('\n\n');
    }

    const transcript = cleanTranscript.trim();

    // Step 3: Get class context
    const lecture = await base44.asServiceRole.entities.Lecture.get(lecture_id);
    const cls = lecture.class_id ? await base44.asServiceRole.entities.Class.get(lecture.class_id) : null;

    // Step 4: Generate AI analysis from cleaned transcript
    const analysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are an AI academic assistant analyzing a university lecture transcript. The class is "${cls?.name || 'Unknown'}" taught by ${cls?.instructor || 'Unknown instructor'} on ${lecture.date}.

Analyze this lecture transcript and generate:

1. A concise, descriptive title (5-8 words)
2. A comprehensive summary (2-3 paragraphs) covering the main topics
3. Key concepts discussed (array of 5-10 items)
4. Important vocabulary terms (array of 5-10 items)
5. Key definitions (array of objects with "term" and "definition")
6. Formulas mentioned (array of strings, empty if none)
7. Action items for the student (array of tasks like "Review X", "Read chapter Y")
8. Exam or test announcements mentioned (array, empty if none)

Transcript:
${transcript.substring(0, 15000)}`,
      response_json_schema: {
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
      }
    });

    // Step 5: Update the lecture with all AI-generated content
    await base44.asServiceRole.entities.Lecture.update(lecture_id, {
      transcript,
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

    // Step 6: Generate flashcards from the lecture
    const flashcardResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Based on this university lecture transcript for "${cls?.name || 'the class'}", generate 8 flashcards. Each flashcard has a front (question or term) and back (answer or definition). Focus on the most important concepts.

Transcript:
${transcript.substring(0, 12000)}`,
      response_json_schema: {
        type: 'object',
        properties: {
          flashcards: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                front: { type: 'string' },
                back: { type: 'string' }
              }
            }
          }
        }
      }
    });

    if (flashcardResult.flashcards && flashcardResult.flashcards.length > 0) {
      const flashcards = flashcardResult.flashcards.map(fc => ({
        lecture_id: lecture_id,
        class_id: lecture.class_id,
        front: fc.front,
        back: fc.back,
        ai_generated: true
      }));
      await base44.asServiceRole.entities.Flashcard.bulkCreate(flashcards);
    }

    return Response.json({ status: 'complete', lecture_id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});