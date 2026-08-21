import { geminiCostCad } from './credits.js';

// Direct port of base44/shared/llm.ts, with ONE deliberate architecture
// change: the original fell back to base44.asServiceRole.integrations.Core.
// InvokeLLM when Gemini failed. That fallback provider does not exist on
// this stack — Base44 is what's being migrated away from. So here, a
// missing key or a failed Gemini call throws loudly instead of silently
// falling back to nothing. GEMINI_API_KEY is a hard requirement in
// production now, not a cost-optimization on top of a working default.

export const CHEAP_MODEL = 'gemini-2.5-flash-lite';
export const QUALITY_MODEL = 'gemini-2.5-flash';

export function createLlmUsage() {
  return { geminiCalls: 0, base44Calls: 0, inputTokens: 0, outputTokens: 0, costCad: 0, models: {} };
}

function addUsage(tracker, usage) {
  if (!tracker) return;
  tracker.geminiCalls += 1;
  tracker.inputTokens += usage.inputTokens;
  tracker.outputTokens += usage.outputTokens;
  tracker.costCad += usage.costCad;
  tracker.models[usage.model] = (tracker.models[usage.model] || 0) + 1;
}

function usageFromGemini(data, requestedModel) {
  const metadata = data?.usageMetadata || {};
  const inputTokens = Number(metadata.promptTokenCount || 0);
  const candidates = Number(metadata.candidatesTokenCount || 0);
  const thoughts = Number(metadata.thoughtsTokenCount || 0);
  const total = Number(metadata.totalTokenCount || 0);
  const outputTokens = candidates + thoughts || Math.max(0, total - inputTokens);
  return {
    model: String(data?.modelVersion || requestedModel),
    inputTokens, outputTokens,
    costCad: geminiCostCad(requestedModel, inputTokens, outputTokens),
  };
}

const endpoint = (model, key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

function toGeminiSchema(node) {
  if (node === null || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(toGeminiSchema);
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    out[k] = (k === 'type' && typeof v === 'string') ? v.toUpperCase() : toGeminiSchema(v);
  }
  return out;
}

async function callGemini(prompt, schema, model, key) {
  const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }] };
  if (schema) {
    body.generationConfig = { responseMimeType: 'application/json', responseSchema: toGeminiSchema(schema) };
  }

  const res = await fetch(endpoint(model, key), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Gemini ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const usage = usageFromGemini(data, model);

  const blocked = data?.promptFeedback?.blockReason;
  if (blocked) { const e = new Error(`Gemini blocked the prompt: ${blocked}`); e.providerUsage = usage; throw e; }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text || !text.trim()) { const e = new Error('Gemini returned an empty response'); e.providerUsage = usage; throw e; }

  if (!schema) return { value: text, usage };
  try {
    return { value: JSON.parse(text), usage };
  } catch {
    const e = new Error('Gemini returned malformed JSON despite responseSchema');
    e.providerUsage = usage;
    throw e;
  }
}

/** opts: { prompt, response_json_schema?, model?, usage? } */
export async function invokeLLM(opts) {
  const { prompt, response_json_schema, model, usage } = opts;
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not configured — there is no fallback provider on this stack.');

  try {
    const result = await callGemini(prompt, response_json_schema, model || CHEAP_MODEL, key);
    addUsage(usage, result.usage);
    return result.value;
  } catch (e) {
    if (e.providerUsage) addUsage(usage, e.providerUsage);
    throw e;
  }
}
