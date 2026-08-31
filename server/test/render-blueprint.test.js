import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Guards render.yaml against the two ways an inert file becomes dangerous.
 *
 * 1. Drift. The blueprint is not applied automatically, so nothing complains
 *    when it falls behind the live dashboard — and then one day someone syncs
 *    it. It had ALLOWED_ORIGINS and APP_ORIGIN on workers.dev and
 *    STRIPE_EXPECTED_MODE=test while the running service was on praelecta.ca
 *    in live mode. Syncing would have reverted a working payment config to test
 *    mode and returned paying students to a host being retired.
 *
 * 2. A secret written as a literal. Every credential here must be `sync: false`,
 *    which tells Render to prompt rather than read a value from the file. One
 *    slip puts a live Stripe key in git history permanently.
 */

const YAML = fs.readFileSync(new URL('../../render.yaml', import.meta.url), 'utf8');
const valueOf = (key) => YAML.match(new RegExp(`- key: ${key}\\n\\s+value: (.+)`))?.[1]?.trim();

const SECRETS = [
  'DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY',
  'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME',
  'GEMINI_API_KEY', 'GROQ_API_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
  'RESEND_API_KEY', 'EMAIL_FROM_ADDRESS', 'GRANT_TRIGGER_TOKEN', 'REMINDERS_TRIGGER_TOKEN',
];

test('no secret is ever written as a literal value', () => {
  for (const key of SECRETS) {
    assert.equal(valueOf(key), undefined,
      `${key} has a literal value in render.yaml — a credential committed to git`);
    assert.match(YAML, new RegExp(`- key: ${key}\\n\\s+(sync: false|fromService:)`),
      `${key} is neither sync:false nor sourced fromService`);
  }
});

test('no live-looking credential has leaked into the file', () => {
  assert.ok(!/sk_live_|sk_test_|whsec_|rk_live_/.test(YAML), 'a Stripe key or signing secret is in render.yaml');
  assert.ok(!/postgres(ql)?:\/\/[^\s]*:[^\s]*@/.test(YAML), 'a database URL with credentials is in render.yaml');
});

test('the blueprint matches the live payment configuration', () => {
  assert.equal(valueOf('STRIPE_EXPECTED_MODE'), 'live',
    'syncing this blueprint would put the live key into test mode and break every Stripe call');
  assert.equal(valueOf('APP_ORIGIN'), 'https://praelecta.ca',
    'syncing this blueprint would return paying students to the wrong host');
});

test('APP_ORIGIN is on the ALLOWED_ORIGINS list it is checked against', () => {
  const origins = valueOf('ALLOWED_ORIGINS').split(',').map((o) => o.trim());
  assert.ok(origins.includes(valueOf('APP_ORIGIN')),
    'checkout would return users to an origin this same file tells the API to refuse');
});

test('the cron jobs call the API by the hostname that is actually current', () => {
  const urls = [...YAML.matchAll(/- key: CEDAR_API_URL\n\s+value: (.+)/g)].map((m) => m[1].trim());
  assert.ok(urls.length >= 1, 'no cron service declares CEDAR_API_URL');
  for (const url of urls) {
    assert.equal(url, 'https://api.praelecta.ca', `a cron job would call ${url}`);
  }
});
