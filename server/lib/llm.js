import { geminiCostCad } from './credits.js';

// Direct port of base44/shared/llm.ts, with ONE deliberate architecture
// change: the original fell back to base44.asServiceRole.integrations.Core.
// InvokeLLM when Gemini failed. That fallback provider does not exist on
// this stack — Base44 is what's being migrated away from. So here, a
// missing key or a failed Gemini call throws loudly instead of silently
// falling back to nothing. GEMINI_API_KEY is a hard requirement in
// production now, not a cost-optimization on top of a working default.

// Google retires models on its own schedule and without warning us. On
// 2026-08-30 every transcript cleanup started failing with
//
//   404 ... "models/gemini-2.5-flash-lite is no longer available to new
//   users. Please update your code to use models/gemini-3.5-flash-lite"
//
// A single hardcoded name turns that into an outage for one feature that
// nobody notices until a student reports it — this one had never produced a
// single successful call on this stack. So each tier is a CHAIN: the first
// model that answers wins, and a retirement costs one wasted round trip
// instead of a feature.
//
// Order is by cost, never upward. gemini-3.5-flash ($1.50/$9.00 per million)
// is deliberately absent from both chains: it is five times the input and
// three and a half times the output of what we run now, and a fallback that
// quietly multiplies the bill is worse than one that fails and tells you.
// server/test/gemini-models.test.js enforces both properties.
//
// Override per environment with GEMINI_CHEAP_MODELS / GEMINI_QUALITY_MODELS
// (comma-separated) so the next retirement is an env change, not a deploy.
function chainFromEnv(name, fallback) {
  const raw = String(process.env[name] || '').trim();
  if (!raw) return fallback;
  const list = raw.split(',').map((m) => m.trim()).filter(Boolean);
  return list.length ? list : fallback;
}

export const CHEAP_MODELS = chainFromEnv('GEMINI_CHEAP_MODELS', ['gemini-3.5-flash-lite', 'gemini-2.5-flash']);
export const QUALITY_MODELS = chainFromEnv('GEMINI_QUALITY_MODELS', ['gemini-2.5-flash', 'gemini-3.5-flash-lite']);

// The head of each chain. Routes keep importing these, so no call site changes.
export const CHEAP_MODEL = CHEAP_MODELS[0];
export const QUALITY_MODEL = QUALITY_MODELS[0];

/** The chain a requested model belongs to, so an explicit model still fails over. */
function chainFor(model) {
  if (!model || model === CHEAP_MODEL) return CHEAP_MODELS;
  if (model === QUALITY_MODEL) return QUALITY_MODELS;
  return [model];
}

/** A 404 that means "this model is gone", not "your request was wrong". */
function isRetiredModel(status, detail) {
  return status === 404 && /NOT_FOUND|no longer available|is not found|not supported/i.test(detail);
}

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
    costCad: geminiCostCad(String(data?.modelVersion || requestedModel), inputTokens, outputTokens),
  };
}

/**
 * Record a Gemini response against a usage tracker.
 *
 * For calls that cannot go through invokeLLM — parseTimetableUpload talks to
 * Gemini directly because it needs inline image input — this is how they still
 * report tokens and cost. Exported rather than reimplemented at the call site
 * on purpose: token accounting that exists in two places drifts, and the whole
 * point of the number is that the margin model can be trusted.
 */
export function recordGeminiUsage(tracker, data, requestedModel) {
  const usage = usageFromGemini(data, requestedModel);
  addUsage(tracker, usage);
  return usage;
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

const GEMINI_TIMEOUT_MS = 120_000;

async function callGemini(prompt, schema, model, key) {
  const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }] };
  if (schema) {
    body.generationConfig = { responseMimeType: 'application/json', responseSchema: toGeminiSchema(schema) };
  }

  const res = await fetch(endpoint(model, key), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    // Node's fetch has no default timeout: a provider that accepts the
    // connection and then stalls would hang this request forever, holding the
    // request open and leaving the caller's record mid-flight.
    signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const err = new Error(`Gemini ${res.status}: ${detail.slice(0, 300)}`);
    err.providerStatus = res.status;
    err.providerDetail = detail;
    throw err;
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

  const chain = chainFor(model);
  let lastError;
  for (let i = 0; i < chain.length; i++) {
    const candidate = chain[i];
    try {
      const result = await callGemini(prompt, response_json_schema, candidate, key);
      addUsage(usage, result.usage);
      return result.value;
    } catch (e) {
      if (e.providerUsage) addUsage(usage, e.providerUsage);
      lastError = e;
      // Only a retirement is worth retrying on another model. A blocked
      // prompt, malformed JSON, a timeout or a rate limit would fail the same
      // way on every model in the chain, and retrying would just spend money
      // and time to arrive at the same error.
      const retired = isRetiredModel(e.providerStatus, e.providerDetail || '');
      if (!retired || i === chain.length - 1) throw e;
      console.warn(`[llm] ${candidate} is retired; falling back to ${chain[i + 1]}. Update GEMINI_CHEAP_MODELS / GEMINI_QUALITY_MODELS.`);
    }
  }
  throw lastError;
}
