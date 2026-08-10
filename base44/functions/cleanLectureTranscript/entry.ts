import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// On-demand transcript cleanup.
//
// This used to run automatically inside processLectureRecording for every
// lecture, which made it the single most expensive thing in the app: 4-5
// InvokeLLM calls per recording (~45% of the pipeline's credits) for a pass
// that only improves READABILITY. Extraction, concepts, exam mentions,
// flashcards and the coverage map all work identically on raw speech-to-text.
//
// Now it is a button the student presses when a specific recording came out
// noisy. Most lectures never need it, so most lectures never pay for it.
//
// Behaviour:
//   - idempotent: a lecture that is already cleaned returns early and costs
//     nothing, so a double-tap can't double-charge
//   - non-destructive: the raw transcript is preserved in `transcript_raw`
//   - ownership enforced by RLS via the user-scoped client (NOT asServiceRole)
//
// COST: ceil(chars / CLEAN_CHUNK_SIZE) InvokeLLM calls, ~3 credits each.
// A 50-minute lecture is ~45,000 chars => 4 calls => ~12 credits.

const CLEAN_CHUNK_SIZE = 12000;

function splitInto(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.substring(i, i + size));
  return out;
}

const asText = (r) => (typeof r === 'string' ? r : (r?.text || String(r ?? '')));

/** The prompt is unchanged from the original inline pass — it is tuned to keep
 *  the professor's voice rather than flatten it into generic prose. */
function cleanPrompt(text: string, isChunk: boolean): string {
  return `You are a professional transcript editor for university lecture recordings. ${isChunk ? 'Clean up this raw speech-to-text chunk' : 'Your job is to clean up raw speech-to-text'} WITHOUT flattening the professor's voice. The value of this transcript is that it preserves how THIS professor actually explained things — their characteristic phrases, their emphasis, the cues a student will recognize later. Stay faithful to their wording.

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

Return ONLY the cleaned transcript text, nothing else. No preamble, no explanation.`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { lecture_id } = await req.json();
    if (!lecture_id) return Response.json({ error: 'lecture_id is required' }, { status: 400 });

    // User-scoped read: RLS rejects a lecture the caller doesn't own, so no
    // separate ownership check is needed and no IDOR is possible.
    let lecture;
    try {
      lecture = await base44.entities.Lecture.get(lecture_id);
    } catch (e) {
      return Response.json({ error: 'Lecture not found' }, { status: 404 });
    }

    // TODO(credits): once CreditBalance exists, charge here — AFTER the checks
    // below and BEFORE the LLM calls, refunding if the work throws. Cost is
    // ceil(transcript.length / CLEAN_CHUNK_SIZE) calls.

    if (lecture.transcript_cleaned) {
      // Already paid for. Return success without spending anything.
      return Response.json({ status: 'already_clean', calls: 0, charged: false });
    }

    const source = (lecture.transcript || '').trim();
    if (!source || source === '[No speech detected in recording]') {
      return Response.json({ error: 'This lecture has no transcript to clean.' }, { status: 400 });
    }

    const chunks = splitInto(source, CLEAN_CHUNK_SIZE);
    const cleanedParts: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: cleanPrompt(chunks[i], chunks.length > 1),
      });
      const part = asText(result).trim();
      // A chunk that comes back empty would silently delete a section of the
      // transcript. Fall back to the original text for that chunk instead.
      cleanedParts.push(part.length > 0 ? part : chunks[i]);
    }

    const cleaned = cleanedParts.join('\n\n').trim();
    if (!cleaned) {
      return Response.json({ error: 'Cleanup produced no output. Nothing was changed.' }, { status: 502 });
    }

    await base44.entities.Lecture.update(lecture_id, {
      transcript_raw: source,   // preserve the original so this is reversible
      transcript: cleaned,
      transcript_cleaned: true,
    });

    return Response.json({
      status: 'complete',
      calls: chunks.length,
      charged: true,
      chars_before: source.length,
      chars_after: cleaned.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
