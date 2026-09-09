import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * A real signup could not verify by code.
 *
 * The student got the email, copied the code, pasted it back into the tab, and
 * it was rejected as expired/invalid — every time. Only the magic-link button
 * worked. It was not an expiry problem: Supabase Auth issues an EIGHT-digit
 * email OTP for this project (proven by taking the sha224 preimage of the live
 * confirmation tokens: sha224(email + 8 digits) matched, six digits never
 * did). The verification box had six slots, so a pasted 8-digit code was
 * truncated to its first six and could never match — GoTrue returns the same
 * generic otp_expired for a wrong code as for an expired one, which is why it
 * read as "expired super quick".
 *
 * The box length MUST equal Supabase's "Email OTP Length". This guards that.
 */

const REGISTER = fs.readFileSync(new URL('../../src/pages/Register.jsx', import.meta.url), 'utf8');

test('the code box holds the whole 8-digit code Supabase sends', () => {
  assert.match(REGISTER, /const OTP_LENGTH = 8;/,
    'OTP_LENGTH must match Supabase Auth → Email OTP Length (8), or a pasted code is truncated');
  // The input and the submit gate both read the constant — no stray 6 that
  // would silently truncate again.
  assert.match(REGISTER, /maxLength=\{OTP_LENGTH\}/);
  assert.match(REGISTER, /otpCode\.length < OTP_LENGTH/);
  assert.doesNotMatch(REGISTER, /maxLength=\{6\}/, 'a hard-coded six-slot box is back');
  assert.doesNotMatch(REGISTER, /otpCode\.length < 6\b/, 'the submit gate still expects six digits');
});

test('the slots are generated from the length, not hand-counted', () => {
  // Six hand-written <InputOTPSlot index={0..5}/> is how it drifted from the
  // real code length in the first place.
  assert.match(REGISTER, /Array\.from\(\{ length: OTP_LENGTH \}/);
});
