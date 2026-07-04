import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { lecture_id, audio_url } = body;
    if (!lecture_id || !audio_url) return Response.json({ error: 'lecture_id and audio_url are required' }, { status: 400 });

    // Step 1: Transcribe the audio
    const transcriptResult = await base44.asServiceRole.integrations.Core.TranscribeAudio({ audio_url });
    const rawTranscript = typeof transcriptResult === 'string' ? transcriptResult : transcriptResult.text || JSON.stringify(transcriptResult);

    if (!rawTranscript || rawTranscript.trim().length === 0) {
      await base44.asServiceRole.entities.Lecture.update(lecture_id, { status: 'complete', transcript: '[No speech detected in recording]' });
      return Response.json({ error: 'No speech detected' }, { status: 400 });
    }

    // Step 2: Clean the transcript — remove murmurs, filler, noise, false starts
    // For long recordings (60+ min), chunk the transcript and clean each section
    const CHUNK_SIZE = 12000;
    let cleanTranscript = '';

    if (rawTranscript.length <= CHUNK_SIZE) {
      const cleanResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are a professional transcript editor for university lecture recordings. Clean up this raw speech-to-text transcript.

Rules:
1. Remove filler words ("um", "uh", "er", "like", "you know") unless they change meaning
2. Remove murmurs, stutters, and false starts (e.g. "I think th- I think that...")
3. Remove noise artifacts, garbled words, and nonsensical fragments
4. Remove repeated phrases caused by stuttering or audio glitches
5. Fix obvious transcription errors (homophones, misheard words) using context
6. Preserve the speaker's original meaning, tone, and technical vocabulary
7. Do NOT summarize or shorten — keep ALL substantive content
8. Add paragraph breaks at natural topic transitions
9. Keep it as close to a readable lecture document as possible

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
          prompt: `You are a professional transcript editor for university lecture recordings. Clean up this raw speech-to-text transcript chunk.

Rules:
1. Remove filler words ("um", "uh", "er", "like", "you know") unless they change meaning
2. Remove murmurs, stutters, and false starts
3. Remove noise artifacts, garbled words, and nonsensical fragments
4. Remove repeated phrases caused by stuttering or audio glitches
5. Fix obvious transcription errors using context
6. Preserve the speaker's original meaning, tone, and technical vocabulary
7. Do NOT summarize or shorten — keep ALL substantive content
8. Add paragraph breaks at natural topic transitions

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