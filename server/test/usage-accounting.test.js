import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createLlmUsage, recordGeminiUsage } from '../lib/llm.js';

/**
 * Every AI call has to report what it cost.
 *
 * settleFeature writes input_tokens, output_tokens and cost_cad from the
 * llmUsage tracker it is handed. Hand it nothing and it logs zeros — silently,
 * with a successful-looking row. Eleven of twelve routes threaded a tracker
 * through; parseTimetableUpload did not, so every timetable import recorded zero
 * tokens and zero cost. It is the slowest feature measured and it is free to the
 * user, which makes it precisely the one whose cost has to be visible.
 *
 * Nothing about that failure is loud. The row exists, success is true, and only
 * comparing it against the other features gives it away — so it gets a test.
 */

const ROUTES = new URL('../routes/', import.meta.url);
const files = fs.readdirSync(ROUTES).filter((f) => f.endsWith('.js'));

test('every settleFeature call reports real token usage', () => {
  for (const f of files) {
    const src = fs.readFileSync(new URL(f, ROUTES), 'utf8');
    for (const m of src.matchAll(/settleFeature\(\s*(\w+)\s*,\s*\{([^}]*)\}/g)) {
      const opts = m[2];
      assert.match(opts, /\bllmUsage\b/,
        `${f} settles a feature without llmUsage — it will log zero tokens and zero cost`);
      assert.ok(!/\busedGemini\b/.test(opts),
        `${f} uses the usedGemini fallback instead of a real usage tracker`);
    }
  }
});

test('a route that calls Gemini directly still records usage', () => {
  const src = fs.readFileSync(new URL('parseTimetableUpload.js', ROUTES), 'utf8');
  assert.match(src, /createLlmUsage\(\)/);
  assert.match(src, /recordGeminiUsage\(llmUsage, data, QUALITY_MODEL\)/);
  // Recorded before the response body is parsed: the call cost money whether or
  // not its output was well-formed.
  const recordAt = src.indexOf('recordGeminiUsage(');
  const parseAt = src.indexOf('JSON.parse(text)');
  assert.ok(recordAt > -1 && parseAt > -1 && recordAt < parseAt,
    'usage is recorded after parsing, so a malformed response would cost money and log nothing');
});

test('recordGeminiUsage reads the shape Gemini actually returns', () => {
  const tracker = createLlmUsage();
  const usage = recordGeminiUsage(tracker, {
    modelVersion: 'gemini-2.5-flash',
    usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 300, thoughtsTokenCount: 50, totalTokenCount: 1550 },
  }, 'gemini-2.5-flash');
  assert.equal(usage.inputTokens, 1200);
  assert.equal(usage.outputTokens, 350, 'thinking tokens are billed and must be counted as output');
  assert.equal(tracker.geminiCalls, 1);
  assert.equal(tracker.inputTokens, 1200);
  assert.ok(tracker.costCad > 0, 'a real call costed at zero defeats the point of measuring it');
});

test('recordGeminiUsage falls back to totalTokenCount when the breakdown is absent', () => {
  const tracker = createLlmUsage();
  const usage = recordGeminiUsage(tracker, { usageMetadata: { promptTokenCount: 900, totalTokenCount: 1400 } }, 'gemini-2.5-flash');
  assert.equal(usage.outputTokens, 500);
});

test('a response with no usage metadata records zero rather than throwing', () => {
  const tracker = createLlmUsage();
  assert.doesNotThrow(() => recordGeminiUsage(tracker, {}, 'gemini-2.5-flash'));
  assert.equal(tracker.geminiCalls, 1, 'the call still happened and must still be counted');
});
