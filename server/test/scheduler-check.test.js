import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { schedulerStatus, logSchedulerStatus, TRIGGERS } from '../lib/schedulerCheck.js';

const BOTH = { GRANT_TRIGGER_TOKEN: 'g', REMINDERS_TRIGGER_TOKEN: 'r' };

test('both tokens set reads as ready', () => {
  const s = schedulerStatus(BOTH);
  assert.equal(s.ok, true);
  assert.deepEqual(s.missing, []);
});

test('a missing token is named, with the route it breaks', () => {
  const s = schedulerStatus({ REMINDERS_TRIGGER_TOKEN: 'r' });
  assert.equal(s.ok, false);
  assert.deepEqual(s.missing, ['GRANT_TRIGGER_TOKEN']);
  assert.match(s.message, /grant-monthly-credits/);
  assert.match(s.message, /401/);
});

test('whitespace is not a token', () => {
  assert.equal(schedulerStatus({ ...BOTH, GRANT_TRIGGER_TOKEN: '   ' }).ok, false);
});

test('neither set reports both, not just the first', () => {
  const s = schedulerStatus({});
  assert.equal(s.missing.length, 2);
});

test('the token values never reach the message', () => {
  const secret = 'super-secret-trigger-value';
  const { message } = schedulerStatus({ GRANT_TRIGGER_TOKEN: secret, REMINDERS_TRIGGER_TOKEN: secret });
  assert.ok(!message.includes(secret));
});

test('every declared trigger matches a route that actually checks it', () => {
  for (const t of TRIGGERS) {
    const file = t.route.replace(/^\/|-./g, (m) => (m === '/' ? '' : m[1].toUpperCase()));
    const src = fs.readFileSync(new URL(`../routes/${file}.js`, import.meta.url), 'utf8');
    assert.match(src, new RegExp(`process\\.env\\.${t.env}`), `${t.route} does not read ${t.env}`);
  }
});

test('problems log as errors so they are visible in a deploy log', () => {
  const seen = { log: [], error: [] };
  const logger = { log: (m) => seen.log.push(m), error: (m) => seen.error.push(m) };
  logSchedulerStatus(BOTH, logger);
  logSchedulerStatus({}, logger);
  assert.equal(seen.log.length, 1);
  assert.equal(seen.error.length, 1);
});

test('the check is wired into index.js', () => {
  const c = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8')
    .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  assert.match(c, /logSchedulerStatus\(\)/);
});
