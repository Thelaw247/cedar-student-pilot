import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { canDeleteAuthUsers, deleteAuthUser } from '../lib/accountDeletion.js';

/**
 * Account deletion has to delete the account.
 *
 * It used to wipe the data and keep the auth.users row, while the button said
 * "Permanently delete your account". App Store guideline 5.1.1(v) requires real
 * deletion, and review checks it by hand, so this is a rejection if it regresses.
 *
 * The delete also has to sit inside the data transaction. Outside it, a failure
 * leaves someone signed in with an empty account and no way to remove it — worse
 * than either doing nothing or finishing the job.
 */

const ROUTE = fs.readFileSync(new URL('../routes/deleteUserData.js', import.meta.url), 'utf8');
const UI = fs.readFileSync(new URL('../../src/components/DeleteAccountSection.jsx', import.meta.url), 'utf8');
const INDEX = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
const code = (s) => s.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');

const fakeDb = (impl) => ({ query: async (...a) => impl(...a) });

test('deleteAuthUser removes exactly the row it was given', async () => {
  let seen;
  const n = await deleteAuthUser(fakeDb((sql, params) => { seen = { sql, params }; return { rowCount: 1 }; }), 'u-1');
  assert.equal(n, 1);
  assert.match(seen.sql, /delete from auth\.users where id = \$1/i);
  assert.deepEqual(seen.params, ['u-1'], 'the delete is not scoped to the caller');
});

test('deleteAuthUser refuses a missing user id rather than deleting broadly', async () => {
  await assert.rejects(() => deleteAuthUser(fakeDb(() => ({ rowCount: 99 })), ''), /requires a user id/);
  await assert.rejects(() => deleteAuthUser(fakeDb(() => ({ rowCount: 99 })), undefined), /requires a user id/);
});

test('the privilege probe reports honestly in both directions', async () => {
  assert.equal((await canDeleteAuthUsers(fakeDb(() => ({ rows: [{ ok: true }] })))).ok, true);
  const denied = await canDeleteAuthUsers(fakeDb(() => ({ rows: [{ ok: false }] })));
  assert.equal(denied.ok, false);
  assert.match(denied.message, /CANNOT/);
  const broken = await canDeleteAuthUsers(fakeDb(() => { throw new Error('connection refused'); }));
  assert.equal(broken.ok, false, 'a failed probe must not read as permission granted');
});

test('the route deletes the auth user, inside the transaction', () => {
  const c = code(ROUTE);
  assert.match(c, /deleteAuthUser\(db, userId\)/, 'the route never deletes the account');
  const at = c.indexOf('deleteAuthUser(db, userId)');
  const commit = c.indexOf("db.query('commit')");
  const rollback = c.indexOf("db.query('rollback')");
  assert.ok(at > -1 && commit > -1 && at < commit,
    'the account delete runs after commit; a failure would leave an empty un-deletable account');
  assert.ok(rollback > -1, 'the transaction has no rollback path');
});

test('a delete that removed no row is treated as a failure', () => {
  assert.match(code(ROUTE), /if \(!authUserDeleted\) throw/,
    'a delete matching zero rows would be reported to the user as success');
});

test('the route no longer describes itself as a reset', () => {
  // Comments stripped: this asserts what the SERVICE SAYS to the user, and the
  // header comment legitimately quotes the old wording to explain the change.
  assert.ok(!/login remains available|fresh free tier/i.test(code(ROUTE)),
    'the response still tells the user their login survives');
  assert.match(ROUTE, /auth_user_deleted/, 'the response does not say whether the account was actually deleted');
});

test('the UI does not promise deletion and report a reset', () => {
  assert.ok(!/has been reset/i.test(UI), 'the success message still says the account was reset');
  assert.match(UI, /has been deleted/i);
  assert.ok(!/will start a fresh free account/i.test(UI),
    'the UI still tells the user they can sign back in to the same account');
});

test('signing out after deletion cannot surface as an error', () => {
  // The session is cascade-deleted with the user, so logout() can legitimately
  // fail. An unhandled rejection after a success message is a confusing bug.
  assert.match(UI, /logout\(\)\)\.catch\(/, 'logout is not guarded after the account is gone');
});

test('the privilege is checked at boot, not at the user\'s one attempt', () => {
  const c = code(INDEX);
  assert.match(c, /canDeleteAuthUsers\(pool\)/, 'nothing checks the auth.users privilege at startup');
  assert.match(c, /\.catch\(/, 'the boot probe is unguarded and could crash the listener callback');
});
