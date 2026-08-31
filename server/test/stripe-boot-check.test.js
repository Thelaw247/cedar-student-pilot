import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripeBootStatus, logStripeBootStatus } from '../lib/stripeBootCheck.js';

const LIVE = 'sk_live_exampleexampleexample';
const TEST = 'sk_test_exampleexampleexample';
const WHSEC = 'whsec_exampleexampleexample';

test('reports live mode as ok when key, expected mode and webhook secret all agree', () => {
  const status = stripeBootStatus({ STRIPE_EXPECTED_MODE: 'live', STRIPE_SECRET_KEY: LIVE, STRIPE_WEBHOOK_SECRET: WHSEC });
  assert.equal(status.ok, true);
  assert.equal(status.mode, 'live');
});

test('reports test mode as ok too — the check is about agreement, not about being live', () => {
  const status = stripeBootStatus({ STRIPE_EXPECTED_MODE: 'test', STRIPE_SECRET_KEY: TEST, STRIPE_WEBHOOK_SECRET: WHSEC });
  assert.equal(status.ok, true);
  assert.equal(status.mode, 'test');
});

test('flags a live key running under STRIPE_EXPECTED_MODE=test', () => {
  const status = stripeBootStatus({ STRIPE_EXPECTED_MODE: 'test', STRIPE_SECRET_KEY: LIVE, STRIPE_WEBHOOK_SECRET: WHSEC });
  assert.equal(status.ok, false);
  assert.match(status.message, /does not match/);
});

test('flags a test key running under STRIPE_EXPECTED_MODE=live', () => {
  const status = stripeBootStatus({ STRIPE_EXPECTED_MODE: 'live', STRIPE_SECRET_KEY: TEST, STRIPE_WEBHOOK_SECRET: WHSEC });
  assert.equal(status.ok, false);
  assert.match(status.message, /does not match/);
});

test('flags STRIPE_EXPECTED_MODE left unset', () => {
  const status = stripeBootStatus({ STRIPE_SECRET_KEY: LIVE, STRIPE_WEBHOOK_SECRET: WHSEC });
  assert.equal(status.ok, false);
  assert.match(status.message, /explicitly set/);
});

test('flags a missing webhook secret even when the key and mode agree', () => {
  const status = stripeBootStatus({ STRIPE_EXPECTED_MODE: 'live', STRIPE_SECRET_KEY: LIVE });
  assert.equal(status.ok, false);
  assert.equal(status.mode, 'live');
  assert.match(status.message, /STRIPE_WEBHOOK_SECRET is missing/);
});

test('never puts key material in the message', () => {
  const cases = [
    { STRIPE_EXPECTED_MODE: 'live', STRIPE_SECRET_KEY: LIVE, STRIPE_WEBHOOK_SECRET: WHSEC },
    { STRIPE_EXPECTED_MODE: 'test', STRIPE_SECRET_KEY: LIVE, STRIPE_WEBHOOK_SECRET: WHSEC },
    { STRIPE_EXPECTED_MODE: 'live', STRIPE_SECRET_KEY: LIVE },
  ];
  for (const env of cases) {
    const { message } = stripeBootStatus(env);
    assert.ok(!message.includes(LIVE), message);
    assert.ok(!message.includes(WHSEC), message);
  }
});

test('does not leak the probed env into the running process', () => {
  const before = { ...process.env };
  stripeBootStatus({ STRIPE_EXPECTED_MODE: 'test', STRIPE_SECRET_KEY: TEST, STRIPE_WEBHOOK_SECRET: WHSEC });
  assert.equal(process.env.STRIPE_EXPECTED_MODE, before.STRIPE_EXPECTED_MODE);
  assert.equal(process.env.STRIPE_SECRET_KEY, before.STRIPE_SECRET_KEY);
});

test('logs ok to log and problems to error, so a bad config is visible as an error line', () => {
  const seen = { log: [], error: [] };
  const logger = { log: (m) => seen.log.push(m), error: (m) => seen.error.push(m) };
  logStripeBootStatus({ STRIPE_EXPECTED_MODE: 'live', STRIPE_SECRET_KEY: LIVE, STRIPE_WEBHOOK_SECRET: WHSEC }, logger);
  assert.equal(seen.log.length, 1);
  assert.equal(seen.error.length, 0);
  logStripeBootStatus({ STRIPE_EXPECTED_MODE: 'test', STRIPE_SECRET_KEY: LIVE, STRIPE_WEBHOOK_SECRET: WHSEC }, logger);
  assert.equal(seen.error.length, 1);
});

test('the boot check is actually wired into index.js, not just written', () => {
  const src = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
  const code = src.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  assert.match(code, /import \{ logStripeBootStatus \}/);
  assert.match(code, /logStripeBootStatus\(\)/);
});
