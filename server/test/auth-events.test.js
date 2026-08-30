import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldRecheckAuth, IDENTITY_EVENTS } from '../../src/lib/authEvents.js';

// Returning to the tab reloaded the whole app: supabase-js re-validates on
// visibility and emits TOKEN_REFRESHED, AuthContext answered every event by
// re-running checkUserAuth, that set isLoadingAuth, and ProtectedRoute renders
// a spinner instead of <Outlet /> while it is set — unmounting every page and
// the RecordingProvider with them.

const USER = 'user-1';

test('a token refresh for the same user is ignored', () => {
  assert.equal(shouldRecheckAuth('TOKEN_REFRESHED', USER, USER), false);
});

test('a re-emitted sign-in for the same user is ignored', () => {
  // Some supabase-js versions emit SIGNED_IN again on tab focus.
  assert.equal(shouldRecheckAuth('SIGNED_IN', USER, USER), false);
});

test('the initial session event is ignored — the provider already checks on mount', () => {
  assert.equal(shouldRecheckAuth('INITIAL_SESSION', USER, USER), false);
});

test('signing in as a different user re-checks', () => {
  assert.equal(shouldRecheckAuth('SIGNED_IN', 'user-2', USER), true);
});

test('signing in from signed-out re-checks', () => {
  assert.equal(shouldRecheckAuth('SIGNED_IN', USER, null), true);
});

test('signing out always re-checks, even with no session on either side', () => {
  assert.equal(shouldRecheckAuth('SIGNED_OUT', null, USER), true);
  assert.equal(shouldRecheckAuth('SIGNED_OUT', null, null), true);
});

test('a user record update always re-checks', () => {
  assert.equal(shouldRecheckAuth('USER_UPDATED', USER, USER), true);
});

test('an unknown future event with an unchanged user is ignored', () => {
  // The safe default: Supabase just confirmed the session we already hold.
  assert.equal(shouldRecheckAuth('SOME_NEW_EVENT', USER, USER), false);
  assert.equal(shouldRecheckAuth('SOME_NEW_EVENT', 'user-2', USER), true);
});

test('undefined and null session ids compare as the same absence', () => {
  assert.equal(shouldRecheckAuth('TOKEN_REFRESHED', undefined, null), false);
  assert.equal(shouldRecheckAuth('TOKEN_REFRESHED', null, undefined), false);
});

test('the identity event set is the documented one', () => {
  assert.deepEqual([...IDENTITY_EVENTS].sort(), ['SIGNED_OUT', 'USER_UPDATED']);
});

// The event filter alone is not enough: a genuine re-check (signing in as
// someone else) must also not blank the screen for an already-checked session
// any longer than it has to. Guard the two wiring facts that make that true.
test('AuthContext gates the loading spinner on the first check only', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../../src/lib/AuthContext.jsx', import.meta.url), 'utf8');
  assert.ok(
    src.includes('if (!authCheckedRef.current) setIsLoadingAuth(true);'),
    'a re-check must not raise isLoadingAuth — that unmounts the whole tree',
  );
  assert.ok(!/^\s*setIsLoadingAuth\(true\);/m.test(src), 'no unconditional setIsLoadingAuth(true)');
});

test('AuthContext filters auth events instead of re-checking on all of them', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../../src/lib/AuthContext.jsx', import.meta.url), 'utf8');
  assert.ok(src.includes('shouldRecheckAuth('), 'onAuthStateChange must filter');
  assert.ok(
    !/onAuthStateChange\(\(\) =>/.test(src),
    'the handler must receive (event, session), not ignore them',
  );
});
