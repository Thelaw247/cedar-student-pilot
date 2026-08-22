import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.ALLOWED_ORIGINS = 'https://staging.cedar.example';

const { app } = await import('../index.js');
let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test('health endpoint is available without authentication', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const body = await response.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.service, 'cedar-server');
});

test('allowed-origin preflight receives exact CORS headers', async () => {
  const response = await fetch(`${baseUrl}/health`, {
    method: 'OPTIONS',
    headers: { Origin: 'https://staging.cedar.example' },
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://staging.cedar.example');
  assert.equal(response.headers.get('vary'), 'Origin');
});

test('unknown browser origins are rejected', async () => {
  const response = await fetch(`${baseUrl}/health`, {
    headers: { Origin: 'https://attacker.example' },
  });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'Origin not allowed' });
});

test('unknown routes return JSON 404', async () => {
  const response = await fetch(`${baseUrl}/does-not-exist`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Not found' });
});
