import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isRunningInDesktopApp } from '../../src/lib/desktopDownloads.js';

/**
 * A student who is signed in is let in, and is never told otherwise.
 *
 * Reported 21 Sep 2026 as "the desktop app makes me log in every time I open
 * it". It never logged anyone out. Supabase's logs for the one desktop user
 * show every launch restoring the stored session (a refresh_token grant with
 * reuse=false, then /auth/v1/user and the profile both 200), followed half a
 * minute later by a password grant: a second session, five of them in two
 * weeks. On 14 Sep the two password attempts failed while the session was
 * perfectly valid. The shell opens praelecta.ca/, the homepage, whose nav says
 * "Sign in" to everyone; /login asked for a password without looking whether
 * one was needed.
 *
 * Read from source, like public-routes.test.js and signup-email-flow.test.js,
 * because the frontend has no test runner of its own on this stack.
 */

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
const APP = read('../../src/App.jsx');
const LOGIN = read('../../src/pages/Login.jsx');
const PROTECTED = read('../../src/components/ProtectedRoute.jsx');
const AUTH = read('../../src/lib/AuthContext.jsx');
const CLIENT = read('../../src/lib/cedarClient.js');
const SHELL = read('../../desktop/main.cjs');

// The user agent the Windows desktop app 1.0.2 actually sent, from the logs.
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Praelecta/1.0.2 Chrome/152.0.7977.65 Safari/537.36 PraelectaDesktop/1.0.2';
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.7977.65 Safari/537.36';

function inPage({ userAgent, bridge }, fn) {
  const hadWindow = Object.hasOwn(globalThis, 'window');
  const previousWindow = globalThis.window;
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  globalThis.window = bridge ? { praelectaDesktop: bridge } : {};
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent }, configurable: true });
  try {
    return fn();
  } finally {
    if (hadWindow) globalThis.window = previousWindow; else delete globalThis.window;
    if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
    else delete globalThis.navigator;
  }
}

test('the desktop app opens on Today, not on the homepage', () => {
  const home = APP.match(/<Route path="\/" element=\{([^\n]+)\} \/>/)?.[1];
  assert.ok(home, 'no <Route path="/"> in App.jsx');
  assert.match(home, /^isRunningInDesktopApp\(\) \? <Navigate to="\/today" replace \/> : <Landing \/>$/,
    'the desktop app lands on the homepage, whose "Sign in" link reads as signed out');
  // Today sits behind ProtectedRoute, which is what sends a signed-out window
  // on to /login and back; that is the whole of the desktop app's sign-in.
  assert.ok(APP.indexOf('path="/today"') > APP.indexOf('<ProtectedRoute'), '/today is expected behind ProtectedRoute');
});

test('the site recognises every desktop app already installed, not only the next one', () => {
  // Shells before 1.0.3 carry only the user-agent token, so the token alone
  // has to be enough. The redirect lives in the site for exactly this reason:
  // it reaches installed apps without anyone downloading a new version.
  assert.match(SHELL, /PraelectaDesktop\/\$\{app\.getVersion\(\)\}/, 'the shell stopped announcing itself in the user agent');
  assert.equal(inPage({ userAgent: DESKTOP_UA }, isRunningInDesktopApp), true);
  assert.equal(inPage({ userAgent: CHROME_UA, bridge: { isDesktop: true } }, isRunningInDesktopApp), true);
  assert.equal(inPage({ userAgent: CHROME_UA }, isRunningInDesktopApp), false, 'a browser tab would lose the homepage');
});

test('/login lets a signed-in visitor through, on exactly the terms ProtectedRoute lets them in', () => {
  // If the two disagreed, a visitor could be passed back and forth between
  // them forever. ProtectedRoute renders its page only once auth has settled
  // with no error and a user; /login forwards on that same condition.
  assert.match(PROTECTED, /if \(isLoadingAuth \|\| !authChecked\) \{\s*return fallback;/);
  assert.match(PROTECTED, /if \(authError\) \{/);
  assert.match(PROTECTED, /if \(!isAuthenticated\) \{\s*return unauthenticatedElement;/);
  assert.match(LOGIN, /const \{ isAuthenticated, isLoadingAuth, authChecked, authError \} = useAuth\(\);/);
  assert.match(LOGIN, /if \(!loading && authChecked && !isLoadingAuth && !authError && isAuthenticated\) \{\s*return <Navigate to=\{destination\} replace \/>;/);
  // The destination is read once. Read again during the redirect, the URL
  // already shows /classes, has no returnTo, and the visitor was sent to /today.
  assert.match(LOGIN, /const \[destination\] = useState\(safeReturnTo\);/);
  // The form still renders while auth is unresolved: a spinner there once made
  // /login unreachable exactly when it was needed (see App.jsx).
  assert.doesNotMatch(LOGIN, /if \(!authChecked\)[^\n]*return/);
});

test('signing in with the form leaves the navigation to the form', () => {
  // `loading` is what keeps the signed-in check from racing the full-page
  // navigation the form starts on success, so success must not clear it.
  const submit = LOGIN.slice(LOGIN.indexOf('const handleSubmit'), LOGIN.indexOf('const handleApple'));
  assert.match(submit, /window\.location\.href = safeReturnTo\(\);\s*\} catch \(err\) \{\s*setError\([^\n]+\);\s*setLoading\(false\);/);
  assert.doesNotMatch(submit, /finally/, 'loading is cleared on success again');
});

test('a successful auth check retires an earlier "sign in" verdict', () => {
  const check = AUTH.slice(AUTH.indexOf('const checkUserAuth = useCallback'), AUTH.indexOf('const clearOfflineData'));
  const success = check.slice(0, check.indexOf('} catch (error) {'));
  assert.match(success, /setAuthError\(\(current\) => \(current\?\.type === 'auth_required' \? null : current\)\);/,
    'a tab signed in from another tab is still sent to /login');
});

test('Supabase being unreachable is not reported as being signed out', () => {
  // On a 401 or 403, and only then, AuthContext clears the offline data on
  // the device, the crash-recovery audio of a lecture waiting to upload
  // included. me() used to turn every missing user into a 401, a network
  // failure included.
  const me = CLIENT.slice(CLIENT.indexOf('async me() {'), CLIENT.indexOf('async updateMe('));
  assert.match(CLIENT, /import \{ isAuthRetryableFetchError \} from '@supabase\/supabase-js';/);
  const passThrough = me.indexOf('if (isAuthRetryableFetchError(userError)) throw userError;');
  assert.ok(passThrough > -1, 'me() reports an unreachable server as a sign-out');
  assert.ok(passThrough < me.indexOf('error.status = 401;'), 'the network check must come before the 401');
  assert.match(AUTH, /const isAuthRejection = error\.status === 401 \|\| error\.status === 403;/);
  assert.match(AUTH, /if \(isAuthRejection\) \{\s*const previousUserId = getCachedUserId\(\);\s*await purgeUserOfflineData\(previousUserId\);/);
});
