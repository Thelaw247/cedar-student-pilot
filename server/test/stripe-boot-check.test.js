import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripeModeStatus, checkoutReturnStatus, logStripeBootStatus } from '../lib/stripeBootCheck.js';

const LIVE = 'sk_live_exampleexampleexample';
const TEST = 'sk_test_exampleexampleexample';
const WHSEC = 'whsec_exampleexampleexample';
const ORIGINS = 'https://praelecta.ca,https://www.praelecta.ca,https://cedar-student-pilot.dewetluus.workers.dev';
const GOOD = { STRIPE_EXPECTED_MODE: 'live', STRIPE_SECRET_KEY: LIVE, STRIPE_WEBHOOK_SECRET: WHSEC, APP_ORIGIN: 'https://praelecta.ca', ALLOWED_ORIGINS: ORIGINS };

test('reports live mode as ok when key, expected mode and webhook secret all agree', () => {
  const status = stripeModeStatus(GOOD);
  assert.equal(status.ok, true);
  assert.equal(status.mode, 'live');
});

test('reports test mode as ok too — the check is about agreement, not about being live', () => {
  const status = stripeModeStatus({ ...GOOD, STRIPE_EXPECTED_MODE: 'test', STRIPE_SECRET_KEY: TEST });
  assert.equal(status.ok, true);
  assert.equal(status.mode, 'test');
});

test('flags a live key running under STRIPE_EXPECTED_MODE=test', () => {
  const status = stripeModeStatus({ ...GOOD, STRIPE_EXPECTED_MODE: 'test' });
  assert.equal(status.ok, false);
  assert.match(status.message, /does not match/);
});

test('flags a test key running under STRIPE_EXPECTED_MODE=live', () => {
  const status = stripeModeStatus({ ...GOOD, STRIPE_SECRET_KEY: TEST });
  assert.equal(status.ok, false);
  assert.match(status.message, /does not match/);
});

test('flags STRIPE_EXPECTED_MODE left unset', () => {
  const status = stripeModeStatus({ ...GOOD, STRIPE_EXPECTED_MODE: undefined });
  assert.equal(status.ok, false);
  assert.match(status.message, /explicitly set/);
});

test('flags a missing webhook secret even when the key and mode agree', () => {
  const status = stripeModeStatus({ ...GOOD, STRIPE_WEBHOOK_SECRET: undefined });
  assert.equal(status.ok, false);
  assert.equal(status.mode, 'live');
  assert.match(status.message, /STRIPE_WEBHOOK_SECRET is missing/);
});

test('accepts an APP_ORIGIN that is on ALLOWED_ORIGINS', () => {
  const status = checkoutReturnStatus(GOOD);
  assert.equal(status.ok, true);
  assert.equal(status.origin, 'https://praelecta.ca');
});

test('flags a valid-but-wrong APP_ORIGIN — this is the whole point of the check', () => {
  const status = checkoutReturnStatus({ ...GOOD, APP_ORIGIN: 'https://praelecta.com' });
  assert.equal(status.ok, false);
  assert.match(status.message, /not on ALLOWED_ORIGINS/);
});

test('a trailing slash on APP_ORIGIN still matches — appOrigin strips it', () => {
  const status = checkoutReturnStatus({ ...GOOD, APP_ORIGIN: 'https://praelecta.ca/' });
  assert.equal(status.ok, true);
});

test('a trailing slash on the ALLOWED_ORIGINS entry still matches', () => {
  const status = checkoutReturnStatus({ ...GOOD, ALLOWED_ORIGINS: 'https://praelecta.ca/' });
  assert.equal(status.ok, true);
});

test('flags APP_ORIGIN unset, and http rather than https', () => {
  // Asserting ok as well as the message on purpose. An earlier version of this
  // test checked only the text, and a deliberately reintroduced bug that
  // reported the failure as ok:true passed all sixteen tests.
  const unset = checkoutReturnStatus({ ...GOOD, APP_ORIGIN: undefined });
  assert.equal(unset.ok, false);
  assert.match(unset.message, /not configured/);
  const insecure = checkoutReturnStatus({ ...GOOD, APP_ORIGIN: 'http://praelecta.ca' });
  assert.equal(insecure.ok, false);
  assert.match(insecure.message, /not a valid https origin/);
});

test('flags an empty ALLOWED_ORIGINS rather than treating it as permissive', () => {
  const status = checkoutReturnStatus({ ...GOOD, ALLOWED_ORIGINS: undefined });
  assert.equal(status.ok, false);
});

test('a failing check never reports ok, whatever its message says', () => {
  const failures = [
    checkoutReturnStatus({ ...GOOD, APP_ORIGIN: undefined }),
    checkoutReturnStatus({ ...GOOD, APP_ORIGIN: 'not-a-url' }),
    checkoutReturnStatus({ ...GOOD, APP_ORIGIN: 'https://praelecta.com' }),
    stripeModeStatus({ ...GOOD, STRIPE_SECRET_KEY: 'garbage' }),
    stripeModeStatus({ ...GOOD, STRIPE_EXPECTED_MODE: 'sandbox' }),
  ];
  for (const status of failures) assert.equal(status.ok, false, status.message);
});

test('never puts key material in any message', () => {
  const cases = [GOOD, { ...GOOD, STRIPE_EXPECTED_MODE: 'test' }, { ...GOOD, STRIPE_WEBHOOK_SECRET: undefined }];
  for (const env of cases) {
    for (const { message } of [stripeModeStatus(env), checkoutReturnStatus(env)]) {
      assert.ok(!message.includes(LIVE), message);
      assert.ok(!message.includes(WHSEC), message);
    }
  }
});

test('does not leak the probed env into the running process', () => {
  const before = PROBED_SNAPSHOT();
  stripeModeStatus({ ...GOOD, STRIPE_EXPECTED_MODE: 'test', STRIPE_SECRET_KEY: TEST });
  checkoutReturnStatus({ ...GOOD, APP_ORIGIN: 'https://elsewhere.example' });
  assert.deepEqual(PROBED_SNAPSHOT(), before);
});
function PROBED_SNAPSHOT() {
  return ['STRIPE_EXPECTED_MODE', 'STRIPE_SECRET_KEY', 'APP_ORIGIN', 'ALLOWED_ORIGINS']
    .map((k) => [k, process.env[k]]);
}

test('logs ok to log and problems to error, so a bad config is visible as an error line', () => {
  const seen = { log: [], error: [] };
  const logger = { log: (m) => seen.log.push(m), error: (m) => seen.error.push(m) };
  logStripeBootStatus(GOOD, logger);
  assert.equal(seen.log.length, 2);
  assert.equal(seen.error.length, 0);
  logStripeBootStatus({ ...GOOD, APP_ORIGIN: 'https://praelecta.com' }, logger);
  assert.equal(seen.error.length, 1);
});

test('the boot check is actually wired into index.js, not just written', () => {
  const src = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
  const code = src.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  assert.match(code, /import \{ logStripeBootStatus \}/);
  assert.match(code, /logStripeBootStatus\(\)/);
});
