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

test('the public counts answer without a session — and never as a 401', async () => {
  // The landing page reads this signed out. With no database in the test
  // process the query fails, which must surface as "unavailable", not as a
  // demand to sign in, and never as a crash.
  const response = await fetch(`${baseUrl}/public/stats`);
  assert.notEqual(response.status, 401);
  assert.ok([200, 503].includes(response.status), `unexpected status ${response.status}`);
  const body = await response.json();
  assert.ok(body && typeof body === 'object');
});

test('unknown routes return JSON 404', async () => {
  const response = await fetch(`${baseUrl}/does-not-exist`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Not found' });
});

test('every user-data and provider route fails closed without authorization', async () => {
  const routes = [
    ['GET', '/me'],
    ['GET', '/export-user-data'],
    ['POST', '/export-user-data'],
    ['POST', '/delete-user-data'],
    ['POST', '/resolve-assignment'],
    ['POST', '/search-lectures'],
    ['POST', '/parse-timetable-upload'],
    ['POST', '/create-checkout-session'],
    ['POST', '/create-portal-session'],
    ['POST', '/confirm-checkout-session'],
    ['POST', '/clean-lecture-transcript'],
    ['POST', '/generate-study-material'],
    ['POST', '/predict-exam-topics'],
    ['POST', '/generate-study-schedule'],
    ['POST', '/verify-providers'],
    ['POST', '/detect-academic-risk'],
    ['POST', '/fit-project-time'],
    ['POST', '/generate-missed-lecture-summary'],
    ['POST', '/generate-lecture-review'],
    ['POST', '/generate-session-review'],
    ['POST', '/process-session-review'],
    ['POST', '/rebook-study-session'],
    ['POST', '/generate-project-roadmap'],
    ['POST', '/generate-class-handbook'],
    ['POST', '/owner-analytics'],
    ['POST', '/export-transcript'],
    ['POST', '/process-lecture-recording'],
    ['POST', '/send-study-reminders'],
    ['POST', '/grant-monthly-credits'],
    ['POST', '/files/recordings/upload-url'],
    ['POST', '/files/avatars/upload-url'],
    ['POST', '/files/avatars/confirm'],
    ['POST', '/files/recordings/confirm'],
    ['GET', '/files/download-url'],
    ['DELETE', '/files'],
    ['DELETE', '/data/lectures/00000000-0000-0000-0000-000000000000'],
    ['DELETE', '/data/classes/00000000-0000-0000-0000-000000000000'],
    ['DELETE', '/data/semesters/00000000-0000-0000-0000-000000000000'],
    ['POST', '/create-semester-import'],
  ];

  const results = await Promise.all(routes.map(async ([method, path]) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      ...(method === 'GET' ? {} : { headers: { 'Content-Type': 'application/json' }, body: '{}' }),
    });
    return { method, path, status: response.status };
  }));

  assert.deepEqual(
    results.filter((result) => result.status !== 401),
    [],
    `routes did not fail closed: ${JSON.stringify(results)}`,
  );
});

test('a preflight carrying the analytics session headers is allowed', async () => {
  // The browser SDK attaches X-POSTHOG-SESSION-ID (and the window id) to every
  // request bound for this API, because main.jsx lists it in tracingHosts.
  // Allow-Headers here is a fixed list, not a reflection of what was asked
  // for, so a header missing from it fails the preflight — and with it every
  // API call the app makes from the browser.
  const response = await fetch(`${baseUrl}/public/stats`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://staging.cedar.example',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization, x-posthog-session-id',
    },
  });
  assert.equal(response.status, 204);
  const allowed = (response.headers.get('access-control-allow-headers') || '')
    .split(',').map((header) => header.trim().toLowerCase());
  for (const header of ['authorization', 'content-type', 'stripe-signature', 'x-posthog-session-id', 'x-posthog-window-id']) {
    assert.ok(allowed.includes(header), `${header} is not allowed: ${allowed.join(', ')}`);
  }
});
