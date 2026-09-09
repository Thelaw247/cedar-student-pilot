import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * The signup email sends a link. The app demanded a code.
 *
 * Reported 6 Sep 2026 by the person it happened to, and visible in the
 * database: the newest account took nine and a half minutes between
 * confirmation_sent_at and email_confirmed_at, against fifty seconds for the
 * account before it. The link was never broken — the page the student was
 * looking at simply never noticed it had worked.
 *
 * Three separate things made that possible, and each gets a test here:
 *
 *   1. Register.jsx showed the six-digit box the instant signup returned and
 *      had no subscription to auth state, so a session arriving in another tab
 *      changed nothing on screen.
 *   2. The link pointed at /today — a protected route that knows nothing about
 *      finishing a sign-up. It only ever worked because supabase-js consumes an
 *      `#access_token=` fragment on whatever page it happens to load on;
 *      anything else in the link did nothing at all.
 *   3. Nothing rendered an error for an expired or already-used link. It was
 *      indistinguishable from a silent bounce to /login.
 *
 * Read from source rather than a bundle, the same way public-routes.test.js
 * does, because the frontend has no test runner of its own on this stack.
 */

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
const APP = read('../../src/App.jsx');
const CALLBACK = read('../../src/pages/AuthCallback.jsx');
const REGISTER = read('../../src/pages/Register.jsx');
const CLIENT = read('../../src/lib/cedarClient.js');
const BUILDER = read('../../scripts/build-email-templates.mjs');
const TEMPLATE = read('../../docs/email-templates/confirmation.html');

test('there is a route for an email link to land on, and it is public', () => {
  assert.ok(APP.includes('path="/auth/callback"'), '/auth/callback has no <Route> in App.jsx');
  const guard = APP.indexOf('<ProtectedRoute');
  assert.ok(guard > -1, 'ProtectedRoute not found — this test needs updating');
  assert.ok(APP.indexOf('path="/auth/callback"') < guard,
    'the route that signs you in is behind the guard that requires you to be signed in');
  assert.ok(fs.existsSync(new URL('../../src/pages/AuthCallback.jsx', import.meta.url)));
});

test('the email link points at that route, not at a protected page', () => {
  const redirects = [...CLIENT.matchAll(/emailRedirectTo(?::\s*|\s*=\s*)`([^`]+)`/g)].map((m) => m[1]);
  assert.ok(redirects.length >= 2, 'expected a redirect for signup and for resend');
  for (const target of redirects) {
    assert.match(target, /\/auth\/callback/, `an email still points at ${target}`);
    assert.doesNotMatch(target, /\/today/, 'a protected route cannot finish a sign-up');
  }
});

test('the callback answers every shape a link can arrive in', () => {
  // Which one the project sends is a dashboard setting, not a code fact, and
  // it can change without anyone touching this repository.
  assert.match(CALLBACK, /verifyOtp\(\{ token_hash/, 'a token_hash link is ignored');
  assert.match(CALLBACK, /exchangeCodeForSession/, 'a PKCE code is ignored');
  assert.match(CALLBACK, /getSession\(\)/, 'nothing confirms the session actually landed');
  assert.match(CALLBACK, /error_description/, 'an expired link produces no message');
});

test('the callback never sends anyone off the site', () => {
  assert.match(CALLBACK, /startsWith\('\/'\)/);
  assert.match(CALLBACK, /startsWith\('\/\/'\)/,
    'a protocol-relative //evil.example passes a naive leading-slash check');
});

test('the code screen leaves when the session arrives', () => {
  assert.match(REGISTER, /useAuth\(\)/, 'Register never subscribes to auth state');
  assert.match(REGISTER, /if \(showOtp && isAuthenticated\)/,
    'nothing dismisses the six-digit box for a browser that is already signed in');
  // Guarded on showOtp, so it cannot hijack someone who opened /register while
  // signed in for an unrelated reason.
  const effect = REGISTER.slice(REGISTER.indexOf('if (showOtp && isAuthenticated)'));
  assert.match(effect.slice(0, 400), /navigate\(/);
});

test('the email carries a six-digit code, not only a link', () => {
  // A link-only confirmation is the shape that broke. Mail apps open links in
  // their own in-app browser, with its own storage, so the tap signs in a
  // session the student cannot see while the tab they signed up in waits. A
  // code comes back to the screen already in front of them.
  assert.match(BUILDER, /code: \{ label: '[^']+', value: '\{\{ \.Token \}\}' \}/,
    'the confirmation template does not render Supabase\'s OTP');
  assert.match(TEMPLATE, /\{\{ \.Token \}\}/, 'the generated template has no code in it');
  assert.match(TEMPLATE, /\{\{ \.ConfirmationURL \}\}/, 'the one-tap link was dropped along with it');
  // Selectable text. Half of email clients block images, and nobody can copy a
  // picture of a code.
  assert.doesNotMatch(TEMPLATE, /<img[^>]*Token/, 'the code is rendered as an image');
});

test('the code is the primary path on both the email and the screen', () => {
  const card = TEMPLATE.slice(TEMPLATE.indexOf('<h1'), TEMPLATE.indexOf('Button not working'));
  assert.ok(card.indexOf('{{ .Token }}') < card.indexOf('{{ .ConfirmationURL }}'),
    'the link comes before the code in the email');
  const otp = REGISTER.slice(REGISTER.indexOf('if (showOtp)'));
  assert.match(otp, /8-digit code to \$\{email\}/, 'the screen no longer says a code is coming');
  assert.match(otp, /Enter it below/);
});

test('a burnt code explains itself', () => {
  // The code and the link are the same token, so using one invalidates the
  // other — and that is the case that actually happens.
  assert.match(REGISTER, /already been used/);
  assert.match(REGISTER, /your account is confirmed/);
});

test('the callback waits for the app to agree there is a session', () => {
  // Both destinations are behind ProtectedRoute, which reads AuthContext
  // rather than Supabase. The context learns through onAuthStateChange and
  // then an async re-check, so navigating the instant Supabase hands back a
  // session lands in a window where authChecked is true and isAuthenticated is
  // still false — and that window bounces straight to /login.
  assert.match(CALLBACK, /useAuth\(\)/);
  assert.match(CALLBACK, /if \(destination && isAuthenticated\) navigate\(destination/);
  const finish = CALLBACK.slice(CALLBACK.indexOf('const finish = async'), CALLBACK.indexOf('void finish()'));
  assert.doesNotMatch(finish, /navigate\(/,
    'the callback navigates from inside the exchange, before the app knows');
});

test('a bounce to login does not destroy the credential in the URL', () => {
  const redirect = APP.slice(APP.indexOf('const RedirectToLogin'), APP.indexOf('const AuthenticatedApp'));
  assert.match(redirect, /location\.hash/,
    'the fragment is dropped, so an email link that lands on a protected route becomes unusable');
});

test('the checked-in templates are what the builder produces', () => {
  // These files are pasted into a dashboard by hand, so a stale one means the
  // live email and the repository disagree with nobody noticing.
  const built = execFileSync(process.execPath,
    [fileURLToPath(new URL('../../scripts/build-email-templates.mjs', import.meta.url))],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.match(built, /wrote docs\/email-templates\/confirmation\.html/);
  assert.equal(read('../../docs/email-templates/confirmation.html'), TEMPLATE,
    'docs/email-templates/confirmation.html is out of date — run node scripts/build-email-templates.mjs');
});
