import test from 'node:test';
import assert from 'node:assert/strict';
import { invokeLLM, OVERLOAD_RETRIES, CHEAP_MODELS } from '../lib/llm.js';
import { usableFlashcards } from '../lib/flashcards.js';

/**
 * Two ways the analysis step lost a lecture on 1 Sep, neither the student's
 * fault:
 *
 *  - Gemini answered 503 "high demand" once, at 16:00 UTC, and the whole
 *    pipeline failed. The same call worked two hours later when the student
 *    noticed and pressed retry. A demand spike is measured in seconds; the
 *    server should absorb it.
 *  - The flashcard model returned a card with no back, twice. The column is
 *    NOT NULL, so the insert threw and the student got no flashcards at all
 *    from an otherwise complete lecture.
 */

const ok = (text) => new Response(JSON.stringify({
  candidates: [{ content: { parts: [{ text }] } }],
  usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
}), { status: 200 });
const overloaded = () => new Response('{"error":{"code":503,"status":"UNAVAILABLE"}}', { status: 503 });

function withFetch(responses, fn) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => { calls.push(String(url)); return responses.shift()(); };
  return fn(calls).finally(() => { globalThis.fetch = original; });
}

const fast = () => {
  const saved = [...OVERLOAD_RETRIES];
  OVERLOAD_RETRIES.splice(0, OVERLOAD_RETRIES.length, 1, 1);
  return () => OVERLOAD_RETRIES.splice(0, OVERLOAD_RETRIES.length, ...saved);
};

test('a 503 demand spike is retried on the same model before anything else', async () => {
  process.env.GEMINI_API_KEY = 'test';
  const restore = fast();
  try {
    await withFetch([overloaded, overloaded, () => ok('{"a":1}')], async (calls) => {
      const value = await invokeLLM({ prompt: 'x', response_json_schema: { type: 'object' } });
      assert.deepEqual(value, { a: 1 });
      assert.equal(calls.length, 3);
      assert.ok(calls.every((u) => u.includes(`/models/${CHEAP_MODELS[0]}:`)), 'all three tries hit the first model');
    });
  } finally { restore(); }
});

test('a model that stays overloaded hands the call to the next model in the chain', async () => {
  process.env.GEMINI_API_KEY = 'test';
  const restore = fast();
  try {
    await withFetch([overloaded, overloaded, overloaded, () => ok('plain')], async (calls) => {
      const value = await invokeLLM({ prompt: 'x' });
      assert.equal(value, 'plain');
      assert.equal(calls.length, 4);
      assert.ok(calls[3].includes(`/models/${CHEAP_MODELS[1]}:`));
    });
  } finally { restore(); }
});

test('a blocked prompt or bad JSON is not retried — it would fail identically', async () => {
  process.env.GEMINI_API_KEY = 'test';
  await withFetch([() => new Response('nope', { status: 400 })], async (calls) => {
    await assert.rejects(() => invokeLLM({ prompt: 'x' }), /Gemini 400/);
    assert.equal(calls.length, 1);
  });
});

test('flashcards missing a side are dropped, not stored and not fatal', () => {
  const cards = usableFlashcards([
    { front: 'What is osmosis?', back: 'Diffusion of water across a membrane' },
    { front: 'Define entropy' },
    { front: '', back: 'orphan' },
    { front: '  Mitosis  ', back: ' Cell division ' },
    null,
  ]);
  assert.deepEqual(cards, [
    { front: 'What is osmosis?', back: 'Diffusion of water across a membrane' },
    { front: 'Mitosis', back: 'Cell division' },
  ]);
  assert.deepEqual(usableFlashcards(undefined), []);
});
