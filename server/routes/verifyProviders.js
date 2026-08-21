import express from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { CHEAP_MODEL, QUALITY_MODEL } from '../lib/llm.js';

// Direct port of base44/functions/verifyProviders/entry.ts — diagnostic only,
// checks GROQ_API_KEY/GEMINI_API_KEY are set AND valid against the live
// provider (presence alone proves nothing). Never returns key material.

const router = express.Router();
const mask = (k) => (!k ? null : { length: k.length, ends_with: k.slice(-4), starts_with: k.slice(0, 4) });

async function checkGroq(key) {
  const res = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) return { ok: false, status: res.status, error: (await res.text().catch(() => '')).slice(0, 200) };
  const data = await res.json();
  const ids = (data?.data || []).map((m) => m.id);
  const want = 'whisper-large-v3-turbo';
  return { ok: true, key_valid: true, model_available: ids.includes(want), requested_model: want, whisper_models_visible: ids.filter((i) => i.includes('whisper')) };
}

async function checkGemini(key) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=200`);
  if (!res.ok) return { ok: false, status: res.status, error: (await res.text().catch(() => '')).slice(0, 200) };
  const data = await res.json();
  const ids = (data?.models || []).map((m) => String(m.name).replace(/^models\//, ''));
  return { ok: true, key_valid: true, cheap_model: CHEAP_MODEL, cheap_model_available: ids.includes(CHEAP_MODEL), quality_model: QUALITY_MODEL, quality_model_available: ids.includes(QUALITY_MODEL), flash_models_visible: ids.filter((i) => i.includes('flash')).slice(0, 12) };
}

router.post('/', requireAuth, async (req, res) => {
  try {
    const groqKey = process.env.GROQ_API_KEY;
    const gemKey = process.env.GEMINI_API_KEY;
    const out = { groq: { secret_set: !!groqKey, fingerprint: mask(groqKey) }, gemini: { secret_set: !!gemKey, fingerprint: mask(gemKey) } };

    if (groqKey) { try { out.groq.live_check = await checkGroq(groqKey); } catch (e) { out.groq.live_check = { ok: false, error: e.message }; } }
    if (gemKey) { try { out.gemini.live_check = await checkGemini(gemKey); } catch (e) { out.gemini.live_check = { ok: false, error: e.message }; } }

    const groqOK = !!groqKey && out.groq.live_check?.ok && out.groq.live_check?.model_available;
    const gemOK = !!gemKey && out.gemini.live_check?.ok && out.gemini.live_check?.cheap_model_available && out.gemini.live_check?.quality_model_available;

    out.verdict = {
      transcription: groqOK ? 'GROQ ACTIVE — 0 cost provider' : 'NOT CONFIGURED (transcription will fail — no fallback on this stack)',
      llm: gemOK ? 'GEMINI ACTIVE — 0 cost provider' : 'NOT CONFIGURED (LLM calls will fail — no fallback on this stack)',
      all_good: groqOK && gemOK,
    };
    res.json(out);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
