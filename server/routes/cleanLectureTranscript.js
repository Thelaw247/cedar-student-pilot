import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { invokeLLM, createLlmUsage } from '../lib/llm.js';
import { getBalance, availableCredits, insufficientResponse, spendCredits, logUsage, durationCost, COST_PER_30MIN_CLEAN, base44CostCad, tierAllows } from '../lib/credits.js';

// Direct port of base44/functions/cleanLectureTranscript/entry.ts. See that
// file's preserved header comment for why this is on-demand rather than
// automatic (it was ~45% of the whole pipeline's cost for a readability-only
// pass). Idempotent — an already-cleaned lecture costs nothing on a retry.

const router = express.Router();
const CLEAN_CHUNK_SIZE = 12000;

function splitInto(text, size) {
  const out = [];
  for (let i = 0; i < text.length; i += size) out.push(text.substring(i, i + size));
  return out;
}

const asText = (r) => (typeof r === 'string' ? r : (r?.text || String(r ?? '')));

function cleanPrompt(text, isChunk) {
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

router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { lecture_id } = req.body || {};
    if (!lecture_id) return res.status(400).json({ error: 'lecture_id is required' });

    const { rows } = await pool.query('select * from lectures where id = $1 and user_id = $2', [lecture_id, userId]);
    const lecture = rows[0];
    if (!lecture) return res.status(404).json({ error: 'Lecture not found' });

    if (lecture.transcript_cleaned) return res.json({ status: 'already_clean', calls: 0, charged: false });

    const source = (lecture.transcript || '').trim();
    if (!source || source === '[No speech detected in recording]') {
      return res.status(400).json({ error: 'This lecture has no transcript to clean.' });
    }

    const started = Date.now();
    const balance = await getBalance(userId);
    const audioSeconds = lecture.duration_seconds || 0;
    const cost = durationCost(audioSeconds, COST_PER_30MIN_CLEAN);

    // Tier gate (this route predates gateFeature's, so it carries its own):
    // cleanup is part of the Student everyday kit.
    if (!tierAllows(balance.tier || 'free', 'clean_transcript')) {
      await logUsage({ user_id: userId, feature: 'clean_transcript', lecture_id, tier_at_time: balance.tier, success: false, refusal: 'tier', audio_seconds: audioSeconds });
      return res.status(402).json({
        error: 'upgrade_required',
        feature: 'clean_transcript',
        tier: balance.tier || 'free',
        required_tier: 'student',
        options: ['upgrade'],
        message: 'Transcript cleanup ships with the Student plan and up. The raw transcript stays right here either way.',
      });
    }

    if (availableCredits(balance) < cost) {
      await logUsage({ user_id: userId, feature: 'clean_transcript', lecture_id, tier_at_time: balance.tier, success: false, refusal: 'credits', audio_seconds: audioSeconds });
      return insufficientResponse(res, 'clean_transcript', cost, balance);
    }

    const chunks = splitInto(source, CLEAN_CHUNK_SIZE);
    const cleanedParts = [];
    const llmUsage = createLlmUsage();
    const operationId = `clean:${lecture_id}`;

    // A chunk the model returns nothing for falls back to the raw text so one
    // bad chunk cannot delete part of a transcript. That fallback used to be
    // silent: the lecture was still marked cleaned and still charged in full,
    // and because the route is idempotent the student could never retry it.
    // Count them, and refuse to charge for a pass that did nothing.
    let fellBack = 0;
    for (const chunk of chunks) {
      const result = await invokeLLM({ usage: llmUsage, prompt: cleanPrompt(chunk, chunks.length > 1) });
      const part = asText(result).trim();
      if (part.length > 0) cleanedParts.push(part);
      else { cleanedParts.push(chunk); fellBack += 1; }
    }

    const cleaned = cleanedParts.join('\n\n').trim();
    if (!cleaned || fellBack === chunks.length) {
      await logUsage({
        user_id: userId, feature: 'clean_transcript', lecture_id, provider: 'gemini',
        model: Object.keys(llmUsage.models).join(', ') || 'automatic',
        call_count: Number(llmUsage.geminiCalls || 0), input_tokens: llmUsage.inputTokens,
        output_tokens: llmUsage.outputTokens, audio_seconds: audioSeconds,
        cedar_credits_charged: 0, cost_cad: llmUsage.costCad, tier_at_time: balance.tier,
        success: false, latency_ms: Date.now() - started,
      });
      return res.status(502).json({ error: 'Cleanup produced no output. Nothing was changed and you were not charged.' });
    }

    const settled = await spendCredits(balance, cost, operationId);
    const chargedNow = settled?._operationAppliedNow === false ? 0 : cost;

    await pool.query(
      'update lectures set transcript_raw = $1, transcript = $2, transcript_cleaned = true where id = $3 and user_id = $4',
      [source, cleaned, lecture_id, userId]);

    const geminiCalls = Number(llmUsage.geminiCalls || 0);
    const base44Calls = Number(llmUsage.base44Calls || 0);
    const provider = geminiCalls > 0 && base44Calls > 0 ? 'mixed' : geminiCalls > 0 ? 'gemini' : 'base44';
    await logUsage({
      user_id: userId, feature: 'clean_transcript', lecture_id, provider,
      model: Object.keys(llmUsage.models).join(', ') || 'automatic',
      call_count: geminiCalls + base44Calls, base44_credits: base44Calls * 3,
      input_tokens: llmUsage.inputTokens, output_tokens: llmUsage.outputTokens, audio_seconds: audioSeconds,
      cedar_credits_charged: chargedNow, credit_operation_id: operationId,
      cost_cad: base44CostCad(base44Calls * 3) + llmUsage.costCad, tier_at_time: balance.tier,
      success: true, latency_ms: Date.now() - started,
    });

    res.json({
      status: 'complete', calls: chunks.length, charged: chargedNow > 0, credits_charged: chargedNow,
      chars_before: source.length, chars_after: cleaned.length,
      // > 0 means some chunks came back empty and kept their raw text.
      chunks_unchanged: fellBack,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
