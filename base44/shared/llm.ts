import { secrets } from 'base44:runtime';
import { geminiCostCad } from './credits.ts';

/**
 * Single entry point for every LLM call in the app.
 *
 * WHY THIS EXISTS
 * Base44 bills integration credits PER CALL (~3 credits on Automatic), against a
 * shared 20,000/month pool. When that pool empties the app stops for EVERY user
 * and there is no mid-cycle top-up. At ~7 calls per 80-minute lecture that caps
 * the whole product at roughly 8 heavy users.
 *
 * Calls made with your OWN API key via fetch() consume ZERO Base44 credits and
 * have no ceiling — Base44's docs state this explicitly. Routing through here
 * moves the app from ~8 heavy users to effectively unlimited, and costs about
 * 56% less per lecture.
 *
 * BEHAVIOUR
 *   - GEMINI_API_KEY set   -> Gemini direct, 0 Base44 credits
 *   - not set, or it fails -> falls back to Core.InvokeLLM (costs credits)
 *
 * The fallback is deliberate: losing a student's lecture is worse than an
 * unexpected credit charge. Every fallback is logged loudly so a broken key
 * shows up in the function logs instead of silently draining the pool.
 *
 * Set the key with:  base44 secrets set GEMINI_API_KEY
 * Until then this file changes nothing — safe to deploy immediately.
 */

// Cheapest capable model. Flash-Lite is ~$0.10/$0.40 per 1M tokens vs $0.30/$2.50
// for 2.5 Flash. Extraction quality drives the exam-coverage feature, so if that
// degrades in testing, move EXTRACTION_MODEL up to 'gemini-2.5-flash'.
export const CHEAP_MODEL = 'gemini-2.5-flash-lite';
export const QUALITY_MODEL = 'gemini-2.5-flash';

export type LlmUsageTracker = {
  geminiCalls: number;
  base44Calls: number;
  inputTokens: number;
  outputTokens: number;
  costCad: number;
  models: Record<string, number>;
};

export function createLlmUsage(): LlmUsageTracker {
  return {
    geminiCalls: 0,
    base44Calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    costCad: 0,
    models: {},
  };
}

type ProviderUsage = {
  provider: 'gemini' | 'base44';
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCad: number;
};

function addUsage(tracker: LlmUsageTracker | undefined, usage: ProviderUsage) {
  if (!tracker) return;
  if (usage.provider === 'gemini') tracker.geminiCalls += 1;
  else tracker.base44Calls += 1;
  tracker.inputTokens += usage.inputTokens;
  tracker.outputTokens += usage.outputTokens;
  tracker.costCad += usage.costCad;
  tracker.models[usage.model] = (tracker.models[usage.model] || 0) + 1;
}

function usageFromGemini(data: any, requestedModel: string): ProviderUsage {
  const metadata = data?.usageMetadata || {};
  const inputTokens = Number(metadata.promptTokenCount || 0);
  const candidates = Number(metadata.candidatesTokenCount || 0);
  const thoughts = Number(metadata.thoughtsTokenCount || 0);
  const total = Number(metadata.totalTokenCount || 0);
  const outputTokens = candidates + thoughts || Math.max(0, total - inputTokens);
  const model = String(data?.modelVersion || requestedModel);
  return {
    provider: 'gemini',
    model,
    inputTokens,
    outputTokens,
    costCad: geminiCostCad(requestedModel, inputTokens, outputTokens),
  };
}

function usageError(message: string, usage: ProviderUsage) {
  const error: any = new Error(message);
  error.providerUsage = usage;
  return error;
}

const endpoint = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

/**
 * Gemini's responseSchema is a subset of OpenAPI 3.0 and its `type` values are
 * proto enums (STRING, OBJECT, ARRAY...). The schemas in this codebase were
 * written for Core.InvokeLLM using lowercase JSON-Schema types, so normalise
 * them rather than rewriting every call site.
 */
function toGeminiSchema(node: any): any {
  if (node === null || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(toGeminiSchema);
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === 'type' && typeof v === 'string') out[k] = v.toUpperCase();
    else out[k] = toGeminiSchema(v);
  }
  return out;
}

async function callGemini(prompt: string, schema: any, model: string, key: string) {
  const body: Record<string, any> = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  };
  if (schema) {
    body.generationConfig = {
      responseMimeType: 'application/json',
      responseSchema: toGeminiSchema(schema),
    };
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

  // A prompt blocked by safety filters returns 200 with no candidate, so a
  // status check alone is not enough. Keep its usage: Google may still report
  // billable input/output tokens even though Cedar falls back.
  const blocked = data?.promptFeedback?.blockReason;
  if (blocked) throw usageError(`Gemini blocked the prompt: ${blocked}`, usage);

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text || !text.trim()) throw usageError('Gemini returned an empty response', usage);

  if (!schema) return { value: text, usage };

  try {
    return { value: JSON.parse(text), usage };
  } catch {
    // responseSchema makes this very unlikely, but a truncated response would
    // otherwise poison the caller with a string where it expects an object.
    throw usageError('Gemini returned malformed JSON despite responseSchema', usage);
  }
}

/**
 * Drop-in replacement for base44.asServiceRole.integrations.Core.InvokeLLM.
 * Same argument names, so call sites only change which function they call.
 */
export async function invokeLLM(
  base44: any,
  opts: {
    prompt: string;
    response_json_schema?: any;
    model?: string;
    usage?: LlmUsageTracker;
    [key: string]: any;
  },
): Promise<any> {
  const { prompt, response_json_schema, model, usage } = opts;

  // secrets.get() must be called per request, never at module load.
  const key = secrets.get('GEMINI_API_KEY');

  if (key) {
    try {
      const result = await callGemini(prompt, response_json_schema, model || CHEAP_MODEL, key);
      addUsage(usage, result.usage);
      return result.value;
    } catch (e) {
      const failedUsage = (e as any)?.providerUsage;
      if (failedUsage) addUsage(usage, failedUsage);
      console.error('[llm] gemini failed, falling back to Base44 (this costs credits):', (e as Error).message);
    }
  }

  try {
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM(
      response_json_schema ? { prompt, response_json_schema } : { prompt },
    );
    addUsage(usage, {
      provider: 'base44',
      model: 'automatic',
      inputTokens: 0,
      outputTokens: 0,
      costCad: 0,
    });
    return result;
  } catch (error) {
    // Base44 bills per call rather than per token, so a failed round trip can
    // still matter to the platform credit pool.
    addUsage(usage, {
      provider: 'base44',
      model: 'automatic',
      inputTokens: 0,
      outputTokens: 0,
      costCad: 0,
    });
    throw error;
  }
}
