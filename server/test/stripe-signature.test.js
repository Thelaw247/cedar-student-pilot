import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { verifyStripeSignature } from '../lib/stripe.js';

test('accepts a current Stripe signature', () => {
  const body = JSON.stringify({ id: 'evt_test' });
  const secret = 'whsec_test';
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');

  assert.deepEqual(
    verifyStripeSignature(body, `t=${timestamp},v1=${signature}`, secret),
    { ok: true },
  );
});

test('rejects expired and mismatched Stripe signatures', () => {
  const body = JSON.stringify({ id: 'evt_test' });
  const secret = 'whsec_test';
  const expired = Math.floor(Date.now() / 1000) - 301;

  assert.equal(
    verifyStripeSignature(body, `t=${expired},v1=bad`, secret).reason,
    'expired',
  );

  const current = Math.floor(Date.now() / 1000);
  assert.equal(
    verifyStripeSignature(body, `t=${current},v1=bad`, secret).reason,
    'signature_mismatch',
  );
});
