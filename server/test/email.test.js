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
