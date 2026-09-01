import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Guards the terms-and-privacy consent gate on account creation.
 *
 * Three separate paths create an account: the email form on /register, and the
 * Apple and Facebook buttons — which appear on BOTH /register and /login,
 * because Supabase's signInWithOAuth creates the account on first use. Gating
 * only the form would leave two working ways to sign up having agreed to
 * nothing, which is the failure this file exists to prevent.
 *
 * Source-level assertions: there is no frontend test runner on this stack, and
 * the same cross-boundary approach already backs public-routes.test.js and
 * scripts/check-api-contract.mjs.
 */

const read = (p) => fs.readFileSync(new URL(`../../src/${p}`, import.meta.url), 'utf8');
const REGISTER = read('pages/Register.jsx');
const LOGIN = read('pages/Login.jsx');
const CLIENT = read('lib/cedarClient.js');
// legal.js lives in shared/ now — it is used by both the web app and iOS.
const LEGAL = fs.readFileSync(new URL('../../shared/legal.js', import.meta.url), 'utf8');

test('the consent box starts unticked — a pre-checked box is not consent', () => {
  assert.match(REGISTER, /useState\(false\)/, 'no false-initialised state found');
  const agreed = REGISTER.match(/const \[agreed, setAgreed\] = useState\((\w+)\)/);
  assert.ok(agreed, 'no `agreed` state on the register page');
  assert.equal(agreed[1], 'false', 'the consent checkbox is pre-ticked');
  assert.ok(!/id="legal-consent"[^>]*defaultChecked/s.test(REGISTER), 'consent checkbox is defaultChecked');
});

test('the consent box links to both documents, in a new tab so the form survives', () => {
  for (const path of ['/terms', '/privacy']) {
    const link = REGISTER.match(new RegExp(`<Link\\s+to="${path}"[^>]*>`, 's'));
    assert.ok(link, `the register page does not link to ${path}`);
    assert.match(link[0], /target="_blank"/, `${path} link would navigate away from the half-filled form`);
    assert.match(link[0], /rel="noopener noreferrer"/, `${path} link is missing rel="noopener noreferrer"`);
  }
});

test('every account-creating path on /register is behind the guard', () => {
  for (const handler of ['handleSubmit', 'handleApple', 'handleFacebook']) {
    const body = REGISTER.slice(REGISTER.indexOf(`const ${handler} = `));
    const end = body.indexOf('\n  };');
    assert.ok(end > -1, `could not read the body of ${handler}`);
    assert.match(body.slice(0, end), /requireAgreement\(\)/, `${handler} can create an account without consent`);
  }
});

test('the guard actually blocks — it returns false when unticked', () => {
  const guard = REGISTER.slice(REGISTER.indexOf('const requireAgreement'));
  const body = guard.slice(0, guard.indexOf('\n  };'));
  assert.match(body, /if \(agreed\) return true;/);
  assert.match(body, /return false;/);
});

test('/login warns that a first social sign-in creates an account', () => {
  assert.match(LOGIN, /creates an account/i, 'no notice on the login page');
  for (const path of ['/terms', '/privacy']) {
    assert.ok(LOGIN.includes(`to="${path}"`), `the login notice does not link to ${path}`);
  }
});

test('the client refuses to sign up without a recorded consent version', () => {
  const fn = CLIENT.slice(CLIENT.indexOf('async register('));
  const body = fn.slice(0, fn.indexOf('\n  },'));
  assert.match(body, /legalVersion/, 'register() does not take a legal version');
  assert.match(body, /if \(!legalVersion\) throw/, 'register() would sign someone up with no consent recorded');
  assert.match(body, /legal_version: legalVersion/, 'the consent version is not persisted');
  assert.match(body, /legal_accepted_at/, 'the consent timestamp is not persisted');
});

test('the register page passes the shared version, not a literal', () => {
  assert.match(REGISTER, /import \{ LEGAL_VERSION \} from "@\/lib\/legal"/);
  assert.match(REGISTER, /legalVersion: LEGAL_VERSION/);
});

test('lib/legal is the one source for the version and both effective dates', () => {
  assert.match(LEGAL, /export const LEGAL_VERSION = '[\d-]+'/);
  for (const [file, name] of [['pages/Terms.jsx', 'TERMS_EFFECTIVE_DATE'], ['pages/PrivacyPolicy.jsx', 'PRIVACY_EFFECTIVE_DATE']]) {
    const src = read(file);
    assert.match(LEGAL, new RegExp(`export const ${name} = '`), `${name} is not exported from lib/legal`);
    assert.match(src, new RegExp(`const EFFECTIVE_DATE = ${name}`), `${file} hardcodes its effective date`);
  }
});
