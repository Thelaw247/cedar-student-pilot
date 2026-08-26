import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRequireAdmin } from '../middleware/requireAdmin.js';

function responseRecorder() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

test('admin middleware rejects missing authenticated identity', async () => {
  const res = responseRecorder();
  let queried = false;
  const middleware = buildRequireAdmin(async () => { queried = true; return { rows: [] }; });

  await middleware({}, res, () => assert.fail('must not continue'));
  assert.equal(res.statusCode, 401);
  assert.equal(queried, false);
});

test('admin middleware rejects an ordinary user server-side', async () => {
  const res = responseRecorder();
  const middleware = buildRequireAdmin(async (_text, params) => {
    assert.deepEqual(params, ['user-1']);
    return { rows: [{ role: 'user' }] };
  });

  await middleware({ user: { id: 'user-1' } }, res, () => assert.fail('must not continue'));
  assert.equal(res.statusCode, 403);
});

test('admin middleware allows only a database-backed admin role', async () => {
  const res = responseRecorder();
  let continued = false;
  const middleware = buildRequireAdmin(async () => ({ rows: [{ role: 'admin' }] }));

  await middleware({ user: { id: 'owner-1' } }, res, () => { continued = true; });
  assert.equal(continued, true);
  assert.equal(res.statusCode, 200);
});
