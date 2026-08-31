import assert from 'node:assert/strict';
import test from 'node:test';
import { emailIsConfigured, escapeEmailHtml, sendEmail } from '../lib/email.js';

test('email configuration requires both provider key and sender', () => {
  const old = { key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM_ADDRESS };
  try {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM_ADDRESS;
    assert.equal(emailIsConfigured(), false);
    process.env.RESEND_API_KEY = 're_test';
    assert.equal(emailIsConfigured(), false);
    process.env.EMAIL_FROM_ADDRESS = 'Praelecta <hello@example.test>';
    assert.equal(emailIsConfigured(), true);
  } finally {
    if (old.key === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = old.key;
    if (old.from === undefined) delete process.env.EMAIL_FROM_ADDRESS; else process.env.EMAIL_FROM_ADDRESS = old.from;
  }
});

test('escapes user-controlled reminder content', () => {
  assert.equal(escapeEmailHtml('<img src=x onerror="bad">'), '&lt;img src=x onerror=&quot;bad&quot;&gt;');
});

test('sends through Resend with a bounded idempotency key', async () => {
  const old = { key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM_ADDRESS, fetch: global.fetch };
  process.env.RESEND_API_KEY = ' re_test ';
  process.env.EMAIL_FROM_ADDRESS = ' Praelecta <hello@example.test> ';
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, json: async () => ({ id: 'email_123' }) };
  };
  try {
    const result = await sendEmail({
      to: 'student@example.test', subject: 'Test', html: '<p>Hello</p>', idempotencyKey: 'x'.repeat(300),
    });
    assert.equal(result.id, 'email_123');
    assert.equal(request.url, 'https://api.resend.com/emails');
    assert.equal(request.options.headers.Authorization, 'Bearer re_test');
    assert.equal(request.options.headers['Idempotency-Key'].length, 256);
    assert.deepEqual(JSON.parse(request.options.body).to, ['student@example.test']);
  } finally {
    global.fetch = old.fetch;
    if (old.key === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = old.key;
    if (old.from === undefined) delete process.env.EMAIL_FROM_ADDRESS; else process.env.EMAIL_FROM_ADDRESS = old.from;
  }
});

// ---------------------------------------------------------------------------
// Sender-domain guard. The sender has to be a domain we control and have
// verified with the provider, or DMARC rejects it — praelecta.ca is p=reject
// with strict alignment. The root and any subdomain are both fine; choosing
// between them is a product decision, not something to enforce here.

import { readFileSync } from 'node:fs';
import { emailStatus, logEmailStatus } from '../lib/email.js';

const GOOD = { RESEND_API_KEY: 're_x', EMAIL_FROM_ADDRESS: 'noreply@praelecta.ca' };

test('the root domain is a valid sender', () => {
  const s = emailStatus(GOOD);
  assert.equal(s.ok, true, 'the root domain is the normal choice and must not be treated as an error');
  assert.match(s.message, /praelecta\.ca/);
});

test('a subdomain is equally valid', () => {
  assert.equal(emailStatus({ ...GOOD, EMAIL_FROM_ADDRESS: 'noreply@send.praelecta.ca' }).ok, true);
});

test('a domain we do not control is rejected', () => {
  const s = emailStatus({ ...GOOD, EMAIL_FROM_ADDRESS: 'noreply@gmail.com' });
  assert.equal(s.ok, false, 'an unverifiable sender would fail DMARC on every message');
  assert.match(s.message, /not praelecta\.ca/);
});

test('a lookalike domain does not slip through the suffix check', () => {
  for (const bad of ['noreply@notpraelecta.ca', 'noreply@praelecta.ca.evil.com', 'noreply@xpraelecta.ca']) {
    assert.equal(emailStatus({ ...GOOD, EMAIL_FROM_ADDRESS: bad }).ok, false, bad);
  }
});

test('the domain check is case-insensitive', () => {
  assert.equal(emailStatus({ ...GOOD, EMAIL_FROM_ADDRESS: 'NoReply@Praelecta.CA' }).ok, true);
});

test('a missing key or sender is named, not just flagged', () => {
  assert.match(emailStatus({ EMAIL_FROM_ADDRESS: GOOD.EMAIL_FROM_ADDRESS }).message, /RESEND_API_KEY/);
  assert.match(emailStatus({ RESEND_API_KEY: 're_x' }).message, /EMAIL_FROM_ADDRESS/);
  assert.match(emailStatus({}).message, /RESEND_API_KEY and EMAIL_FROM_ADDRESS/);
});

test('the API key never reaches the message', () => {
  const secret = 're_supersecretapikeyvalue';
  assert.ok(!emailStatus({ ...GOOD, RESEND_API_KEY: secret }).message.includes(secret));
});

test('problems log as errors so they show in a deploy log', () => {
  const seen = { log: [], error: [] };
  const logger = { log: (m) => seen.log.push(m), error: (m) => seen.error.push(m) };
  logEmailStatus(GOOD, logger);
  logEmailStatus({ ...GOOD, EMAIL_FROM_ADDRESS: 'noreply@gmail.com' }, logger);
  assert.equal(seen.log.length, 1);
  assert.equal(seen.error.length, 1);
});

test('the check is wired into index.js', () => {
  const src = readFileSync(new URL('../index.js', import.meta.url), 'utf8')
    .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  assert.match(src, /logEmailStatus\(\)/);
});
