import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { secrets } from 'base44:runtime';
import { CHEAP_MODEL, QUALITY_MODEL } from '../../shared/llm.ts';

/**
 * TEMPORARY DIAGNOSTIC — safe to delete once both providers are confirmed.
 *
 * Verifies that GROQ_API_KEY and GEMINI_API_KEY are (a) set, (b) actually valid
 * against the live provider, and (c) that the exact models this app requests are
 * available to that key. A key can be present and still be wrong — expired,
 * from the wrong project, or missing the API enablement — so presence alone
 * proves nothing.
 *
 * Uses list endpoints, not generation, so it costs nothing at either provider.
 * Never returns key material: only a masked fingerprint (length + last 4).
 *
 * Run from the browser console while signed in:
 *   await base44.functions.invoke('verifyProviders', {})
 */

const mask = (k?: string) =>
  !k ? null : { length: k.length, ends_with: k.slice(-4), starts_with: k.slice(0, 4) };

async function checkGroq(key: string) {
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { ok: false, status: res.status, error: detail.slice(0, 200) };
  }
  const data = await res.json();
  const ids: string[] = (data?.data || []).map((m: any) => m.id);
  const want = 'whisper-large-v3-turbo';
  return {
    ok: true,
    key_valid: true,
    model_available: ids.includes(want),
    requested_model: want,
    whisper_models_visible: ids.filter((i) => i.includes('whisper')),
  };
}

async function checkGemini(key: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=200`,
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { ok: false, status: res.status, error: detail.slice(0, 200) };
  }
  const data = await res.json();
  // API returns names like "models/gemini-2.5-flash"
  const ids: string[] = (data?.models || []).map((m: any) => String(m.name).replace(/^models\//, ''));
  return {
    ok: true,
    key_valid: true,
    cheap_model: CHEAP_MODEL,
    cheap_model_available: ids.includes(CHEAP_MODEL),
    quality_model: QUALITY_MODEL,
    quality_model_available: ids.includes(QUALITY_MODEL),
    flash_models_visible: ids.filter((i) => i.includes('flash')).slice(0, 12),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const groqKey = secrets.get('GROQ_API_KEY');
    const gemKey = secrets.get('GEMINI_API_KEY');

    const out: Record<string, any> = {
      groq: { secret_set: !!groqKey, fingerprint: mask(groqKey) },
      gemini: { secret_set: !!gemKey, fingerprint: mask(gemKey) },
    };

    if (groqKey) {
      try { out.groq.live_check = await checkGroq(groqKey); }
      catch (e) { out.groq.live_check = { ok: false, error: (e as Error).message }; }
    }
    if (gemKey) {
      try { out.gemini.live_check = await checkGemini(gemKey); }
      catch (e) { out.gemini.live_check = { ok: false, error: (e as Error).message }; }
    }

    const groqOK = !!groqKey && out.groq.live_check?.ok && out.groq.live_check?.model_available;
    const gemOK =
      !!gemKey &&
      out.gemini.live_check?.ok &&
      out.gemini.live_check?.cheap_model_available &&
      out.gemini.live_check?.quality_model_available;

    out.verdict = {
      transcription: groqOK ? 'GROQ ACTIVE — 0 Base44 credits' : 'FALLING BACK TO BASE44 (costs credits)',
      llm: gemOK ? 'GEMINI ACTIVE — 0 Base44 credits' : 'FALLING BACK TO BASE44 (costs credits)',
      all_good: groqOK && gemOK,
    };

    return Response.json(out);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
