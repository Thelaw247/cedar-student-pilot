import assert from 'node:assert/strict';
import test from 'node:test';
import { isNoSuchCustomer } from '../lib/stripeErrors.js';

// The self-heal in createCheckoutSession hinges entirely on recognising the one
// error Stripe raises when the stored customer id does not exist in the current
// account+mode. If this match breaks, a stale (e.g. leftover test-mode) customer
// silently hard-fails every live checkout again — exactly the go-live outage
// this guards. Pin the real message and the negatives.

test('isNoSuchCustomer matches the live "no such customer" rejection', () => {
  const real = "Stripe checkout/sessions 400: No such customer: 'cus_V9R3stjUHNhFg1'; "
    + 'a similar object exists in test mode, but a live mode key was used to make this request.';
  assert.equal(isNoSuchCustomer(new Error(real)), true);
  assert.equal(isNoSuchCustomer(new Error("No such customer: 'cus_ABC'")), true);
});

test('isNoSuchCustomer does not swallow unrelated Stripe errors', () => {
  // These must propagate — recreating a customer would not fix any of them, and
  // retrying could double-charge or mask a real misconfiguration.
  assert.equal(isNoSuchCustomer(new Error('No such price: price_missing')), false);
  assert.equal(isNoSuchCustomer(new Error('Your card was declined.')), false);
  assert.equal(isNoSuchCustomer(new Error('Stripe checkout/sessions 401: Invalid API Key')), false);
  assert.equal(isNoSuchCustomer(new Error('')), false);
  assert.equal(isNoSuchCustomer(undefined), false);
  assert.equal(isNoSuchCustomer(null), false);
});
