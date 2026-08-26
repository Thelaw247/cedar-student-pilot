import assert from 'node:assert/strict';
import test from 'node:test';
import { triggerRoute } from '../jobs/triggerRoute.js';

test('scheduled route requires an HTTPS API and secret token', async () => {
  const old = { url: process.env.CEDAR_API_URL, token: process.env.TEST_TRIGGER_TOKEN };
  try {
    process.env.CEDAR_API_URL = 'http://unsafe.example';
    process.env.TEST_TRIGGER_TOKEN = 'secret';
    await assert.rejects(triggerRoute('/task', 'TEST_TRIGGER_TOKEN'), /HTTPS/);
    process.env.CEDAR_API_URL = 'https://api.example.test';
    delete process.env.TEST_TRIGGER_TOKEN;
    await assert.rejects(triggerRoute('/task', 'TEST_TRIGGER_TOKEN'), /not configured/);
  } finally {
    if (old.url === undefined) delete process.env.CEDAR_API_URL; else process.env.CEDAR_API_URL = old.url;
    if (old.token === undefined) delete process.env.TEST_TRIGGER_TOKEN; else process.env.TEST_TRIGGER_TOKEN = old.token;
  }
});

test('scheduled route sends the secret in a header and returns JSON', async () => {
  const old = { url: process.env.CEDAR_API_URL, token: process.env.TEST_TRIGGER_TOKEN, fetch: global.fetch };
  process.env.CEDAR_API_URL = 'https://api.example.test/';
  process.env.TEST_TRIGGER_TOKEN = ' secret ';
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  try {
    assert.deepEqual(await triggerRoute('/task', 'TEST_TRIGGER_TOKEN'), { ok: true });
    assert.equal(request.url, 'https://api.example.test/task');
    assert.equal(request.options.headers['x-cedar-trigger-token'], 'secret');
  } finally {
    global.fetch = old.fetch;
    if (old.url === undefined) delete process.env.CEDAR_API_URL; else process.env.CEDAR_API_URL = old.url;
    if (old.token === undefined) delete process.env.TEST_TRIGGER_TOKEN; else process.env.TEST_TRIGGER_TOKEN = old.token;
  }
});
