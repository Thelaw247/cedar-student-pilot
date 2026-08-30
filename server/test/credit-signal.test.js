import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CREDITS_SPENT_HEADER, creditSignal, creditsSpent,
  recordCreditsSpent, runWithCreditSignal,
} from '../lib/creditSignal.js';
import { requestSecurity } from '../lib/http.js';

// Every paid action except the recording flow used to leave the client's
// credit meter on a stale number until the page was reloaded — credits looked
// like they vanished later, for no visible reason. spendCredits now records
// what it charged and the response carries X-Credits-Spent, so the client
// refreshes on the spot. These lock that contract.

function fakeRes() {
  const res = {
    headers: {}, body: null, headersSent: false,
    set(k, v) { if (typeof k === 'object') Object.assign(res.headers, k); else res.headers[k] = v; return res; },
    get(k) { return res.headers[k]; },
    json(body) { res.body = body; res.headersSent = true; return res; },
    status(code) { res.statusCode = code; return res; },
    sendStatus(code) { res.statusCode = code; return res; },
  };
  return res;
}

test('the tally starts empty and accumulates real charges', () => {
  runWithCreditSignal(() => {
    assert.equal(creditsSpent(), 0);
    recordCreditsSpent(3);
    recordCreditsSpent(5);
    assert.equal(creditsSpent(), 8);
  });
});

test('non-charges are ignored', () => {
  runWithCreditSignal(() => {
    recordCreditsSpent(0);
    recordCreditsSpent(-4);
    recordCreditsSpent(undefined);
    recordCreditsSpent('nope');
    assert.equal(creditsSpent(), 0);
  });
});

test('recording outside a request is a no-op, not a crash', () => {
  // The Stripe webhook and the monthly-grant cron both spend credits with no
  // request in scope. Nobody is waiting on a header there.
  assert.doesNotThrow(() => recordCreditsSpent(5));
  assert.equal(creditsSpent(), 0);
});

test('a response that charged carries the header', () => {
  const res = fakeRes();
  creditSignal({}, res, () => { recordCreditsSpent(6); res.json({ status: 'complete' }); });
  assert.equal(res.get(CREDITS_SPENT_HEADER), '6');
  assert.deepEqual(res.body, { status: 'complete' });
});

test('a response that charged nothing carries no header', () => {
  const res = fakeRes();
  creditSignal({}, res, () => { res.json({ status: 'already_clean' }); });
  assert.equal(res.get(CREDITS_SPENT_HEADER), undefined);
});

test('each request gets its own tally', () => {
  const a = fakeRes();
  const b = fakeRes();
  creditSignal({}, a, () => { recordCreditsSpent(3); a.json({}); });
  creditSignal({}, b, () => { b.json({}); });
  assert.equal(a.get(CREDITS_SPENT_HEADER), '3');
  assert.equal(b.get(CREDITS_SPENT_HEADER), undefined);
});

test('CORS exposes the header, or the browser would hide it', () => {
  process.env.ALLOWED_ORIGINS = 'https://app.example.com';
  const res = fakeRes();
  requestSecurity({ get: (h) => (h === 'Origin' ? 'https://app.example.com' : undefined), method: 'POST' }, res, () => {});
  const exposed = String(res.get('Access-Control-Expose-Headers') || '');
  assert.ok(exposed.includes(CREDITS_SPENT_HEADER), `expected ${CREDITS_SPENT_HEADER} in "${exposed}"`);
});

// spendCredits is the single place credits move. If it stops reporting, every
// paid feature silently goes back to a stale meter and no behavioural test
// here would notice, because the charge itself still works.
test('spendCredits reports every charge it applies', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../lib/credits.js', import.meta.url), 'utf8');
  assert.ok(src.includes("from './creditSignal.js'"), 'credits.js must import the signal');
  const applied = src.slice(src.indexOf('if (result.rowCount === 1)'));
  assert.ok(
    applied.slice(0, 400).includes('recordCreditsSpent('),
    'the successful-charge branch of spendCredits must record the amount',
  );
});

test('the app mounts the credit-signal middleware', async () => {
  const { readFile } = await import('node:fs/promises');
  const raw = await readFile(new URL('../index.js', import.meta.url), 'utf8');
  // Commented-out code is not mounted code — strip line comments first, or
  // this guard passes on the very thing it exists to catch.
  const src = raw.split('\n').filter((l) => !l.trimStart().startsWith('//')).join('\n');
  assert.ok(src.includes('app.use(creditSignal)'), 'creditSignal must be mounted');
  assert.ok(
    src.indexOf('app.use(creditSignal)') < src.indexOf("app.use('/clean-lecture-transcript'"),
    'creditSignal must sit above the routers that charge',
  );
});
