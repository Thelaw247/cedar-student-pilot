import test from 'node:test';
import assert from 'node:assert/strict';
import { CHEAP_MODELS, QUALITY_MODELS } from '../lib/llm.js';
import { RATES, geminiCostCad } from '../lib/credits.js';

/**
 * Two properties protect the margin when Google retires a model under us.
 *
 * Every model we might call has to have a published rate, because an
 * unpriced model is charged at a guess. And a fallback must never cost more
 * than the model it replaces, or a quiet retirement becomes a quiet bill —
 * gemini-3.5-flash is five times the input price of what we run today.
 */

const rateOf = (m) => RATES.geminiUsdPerMillion[m];

for (const [name, chain] of [['cheap', CHEAP_MODELS], ['quality', QUALITY_MODELS]]) {
  test(`every model in the ${name} chain has a published rate`, () => {
    assert.ok(chain.length > 0, `${name} chain is empty`);
    for (const model of chain) {
      assert.ok(rateOf(model), `${model} has no entry in RATES.geminiUsdPerMillion`);
    }
  });

  test(`the ${name} chain never falls back to a more expensive model`, () => {
    for (let i = 1; i < chain.length; i++) {
      const prev = rateOf(chain[i - 1]);
      const next = rateOf(chain[i]);
      assert.ok(
        next.input <= prev.input && next.output <= prev.output,
        `${chain[i]} (${next.input}/${next.output}) is dearer than ${chain[i - 1]} (${prev.input}/${prev.output}); a fallback must not raise the bill`,
      );
    }
  });
}

test('an unknown model is costed at the dearest known rate, never the cheapest', () => {
  const dearest = Object.values(RATES.geminiUsdPerMillion).sort((a, b) => b.output - a.output)[0];
  const unknown = geminiCostCad('gemini-9.9-imaginary', 1_000_000, 1_000_000);
  const expected = (dearest.input + dearest.output) * RATES.usdToCad;
  assert.ok(Math.abs(unknown - expected) < 1e-9, 'unknown models must not be priced cheaply');
});

test('the retired flash-lite is not the head of either chain', () => {
  assert.notEqual(CHEAP_MODELS[0], 'gemini-2.5-flash-lite');
  assert.notEqual(QUALITY_MODELS[0], 'gemini-2.5-flash-lite');
});

test('3.5-flash-lite is priced as its own model, not as 2.5 flash-lite', () => {
  const lite25 = geminiCostCad('gemini-2.5-flash-lite', 1_000_000, 1_000_000);
  const lite35 = geminiCostCad('gemini-3.5-flash-lite', 1_000_000, 1_000_000);
  assert.ok(lite35 > lite25 * 2, 'the substring match that priced them the same is back');
});
