import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// The live price IDs were verified once, by reading them out of the live
// Stripe account and checking every amount, currency and interval. That
// verification is a moment in time; these guard the shape of what it produced.
//
// The failure this prevents is specific and expensive: a live price ID that is
// wrong, stale or duplicated across tiers charges a real card the wrong amount,
// and the grandfather rule then holds that customer at it permanently.

async function src() {
  return readFile(new URL('../lib/stripePrices.js', import.meta.url), 'utf8');
}
function block(text, name) {
  const m = text.match(new RegExp(`const ${name} = \\{([\\s\\S]*?)\\n\\};`));
  assert.ok(m, `${name} must exist`);
  return m[1];
}
const ids = (b) => b.match(/price_[A-Za-z0-9]+/g) || [];

test('the live catalogue has exactly six subscription prices and three packs', async () => {
  const t = await src();
  assert.equal(ids(block(t, 'LIVE_SUBSCRIPTION_PRICES')).length, 6);
  assert.equal(ids(block(t, 'LIVE_PACK_PRICES')).length, 3);
});

test('no live price id is reused across tiers or periods', async () => {
  // One id in two slots silently bills two different plans at one rate.
  const t = await src();
  const all = ids(block(t, 'LIVE_SUBSCRIPTION_PRICES')).concat(ids(block(t, 'LIVE_PACK_PRICES')));
  assert.equal(new Set(all).size, all.length, 'duplicate live price id');
});

test('live and test catalogues share no ids', async () => {
  // A test id in the live map takes real money against a price that does not
  // exist in live mode; a live id in the test map does the reverse.
  const t = await src();
  const live = new Set(ids(block(t, 'LIVE_SUBSCRIPTION_PRICES')).concat(ids(block(t, 'LIVE_PACK_PRICES'))));
  const testIds = ids(block(t, 'TEST_SUBSCRIPTION_PRICES')).concat(ids(block(t, 'TEST_PACK_PRICES')));
  for (const id of testIds) assert.ok(!live.has(id), `${id} appears in both catalogues`);
});

test('the retired live ids are gone', async () => {
  // These pointed at prices that no longer exist in the live account at all.
  const t = await src();
  for (const stale of ['price_1U4ZFb', 'price_1U4ZFR', 'price_1U4ZFN',
                       'price_1U5YKe', 'price_1U5YKi', 'price_1U5YKm',
                       'price_1U5YKq', 'price_1U5YKu']) {
    assert.ok(!t.includes(stale), `stale live price ${stale} still referenced`);
  }
});

test('every live pack still declares its credit count', async () => {
  const t = await src();
  const b = block(t, 'LIVE_PACK_PRICES');
  for (const [pack, credits] of [['small', 100], ['medium', 250], ['large', 500]]) {
    assert.ok(new RegExp(`${pack}:[^\\n]*credits: ${credits}`).test(b),
      `${pack} must grant ${credits} credits`);
  }
});
