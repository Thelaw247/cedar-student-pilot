import assert from 'node:assert/strict';
import test from 'node:test';
import { expectedStripeMode, isTestMode, subscriptionPrices } from '../lib/stripePrices.js';

test('Stripe mode must be explicit and match the configured key', () => {
  const old = { expected: process.env.STRIPE_EXPECTED_MODE, key: process.env.STRIPE_SECRET_KEY };
  try {
    delete process.env.STRIPE_EXPECTED_MODE;
    process.env.STRIPE_SECRET_KEY = 'sk_test_example';
    assert.throws(() => expectedStripeMode(), /explicitly set/);

    process.env.STRIPE_EXPECTED_MODE = 'test';
    assert.equal(isTestMode(), true);
    assert.match(subscriptionPrices().student.monthly, /^price_/);

    process.env.STRIPE_SECRET_KEY = 'sk_live_example';
    assert.throws(() => isTestMode(), /does not match/);

    process.env.STRIPE_EXPECTED_MODE = 'live';
    assert.equal(isTestMode(), false);
  } finally {
    if (old.expected === undefined) delete process.env.STRIPE_EXPECTED_MODE; else process.env.STRIPE_EXPECTED_MODE = old.expected;
    if (old.key === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = old.key;
  }
});
