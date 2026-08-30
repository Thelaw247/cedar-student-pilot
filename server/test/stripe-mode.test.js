import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkoutEntitlement, entitlementForPriceId, expectedStripeMode, isTestMode,
  packPrices, subscriptionEntitlement, subscriptionPrices,
} from '../lib/stripePrices.js';

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

test('derives checkout credits and tiers from the configured Stripe price', () => {
  const old = { expected: process.env.STRIPE_EXPECTED_MODE, key: process.env.STRIPE_SECRET_KEY };
  try {
    process.env.STRIPE_EXPECTED_MODE = 'test';
    process.env.STRIPE_SECRET_KEY = 'rk_test_example';
    const monthly = subscriptionPrices().student.monthly;
    const pack = packPrices().medium;

    assert.deepEqual(entitlementForPriceId(monthly), {
      kind: 'subscription', tier: 'student', period: 'monthly', priceId: monthly,
    });
    assert.deepEqual(checkoutEntitlement({
      mode: 'payment',
      metadata: { cedar_pack: 'medium', cedar_credits: String(pack.credits) },
      line_items: { data: [{ quantity: 1, price: { id: pack.priceId } }] },
    }), { kind: 'pack', pack: 'medium', credits: 250, priceId: pack.priceId });

    assert.throws(() => checkoutEntitlement({
      mode: 'payment', metadata: { cedar_credits: '5000' },
      line_items: { data: [{ quantity: 1, price: pack.priceId }] },
    }), /credit metadata does not match/);
    assert.throws(() => checkoutEntitlement({
      mode: 'subscription', metadata: {},
      line_items: { data: [{ quantity: 1, price: 'price_unknown' }] },
    }), /unknown Praelecta price/);
  } finally {
    if (old.expected === undefined) delete process.env.STRIPE_EXPECTED_MODE; else process.env.STRIPE_EXPECTED_MODE = old.expected;
    if (old.key === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = old.key;
  }
});

test('derives subscription renewals from price and rejects metadata drift', () => {
  const old = { expected: process.env.STRIPE_EXPECTED_MODE, key: process.env.STRIPE_SECRET_KEY };
  try {
    process.env.STRIPE_EXPECTED_MODE = 'test';
    process.env.STRIPE_SECRET_KEY = 'sk_test_example';
    const priceId = subscriptionPrices().scholar.semester;
    assert.equal(subscriptionEntitlement({
      metadata: { cedar_tier: 'scholar', cedar_period: 'semester' },
      items: { data: [{ quantity: 1, price: { id: priceId } }] },
    }).tier, 'scholar');
    assert.throws(() => subscriptionEntitlement({
      metadata: { cedar_tier: 'unlimited' },
      items: { data: [{ quantity: 1, price: priceId }] },
    }), /tier metadata does not match/);
  } finally {
    if (old.expected === undefined) delete process.env.STRIPE_EXPECTED_MODE; else process.env.STRIPE_EXPECTED_MODE = old.expected;
    if (old.key === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = old.key;
  }
});
