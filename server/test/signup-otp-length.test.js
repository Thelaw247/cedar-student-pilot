import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * A real signup could not verify by code.
 *
 * The student got the email, copied the code, pasted it back into the tab, and
 * it was rejected as expired/invalid — every time; only the magic-link button
 * worked. It was never an expiry problem. The verification box and Supabase
 * Auth's "Email OTP Length" are two halves of one setting: if the box has FEWER
 * slots than the code Supabase mails, a pasted code is truncated to its first N
 * and can never match — and GoTrue returns the same generic otp_expired for a
 * wrong code as for an expired one, which is why it read as "expired super
 * quick". (The box had six slots against an eight-digit code; both are eight now.)
 *
 * Two things keep it from drifting again, and this guards the first: the box
 * length is ONE constant read everywhere, never a hand-counted row of slots.
 * The second — that the constant equals the Supabase dashboard setting — is a
 * deploy step a test cannot see, so the constant is pinned here with that note.
 */

const REGISTER = fs.readFileSync(new URL('../../src/pages/Register.jsx', import.meta.url), 'utf8');

test('the box length is one constant, matched to the Supabase setting', () => {
  // MUST equal Supabase Auth → Email OTP Length. Change both together; the box
  // must never be SHORTER than the setting or a pasted code is truncated.
  assert.match(REGISTER, /const OTP_LENGTH = 8;/,
    'OTP_LENGTH must equal Supabase Auth → Email OTP Length (8)');
});

test('the input and the submit gate read the constant, not a hard-coded count', () => {
  assert.match(REGISTER, /maxLength=\{OTP_LENGTH\}/);
  assert.match(REGISTER, /otpCode\.length < OTP_LENGTH/);
  // A literal digit anywhere in the box is exactly how it drifted from the real
  // code length the first time — six hand-written slots against an 8-digit code.
  assert.doesNotMatch(REGISTER, /maxLength=\{\d+\}/, 'the box length must come from OTP_LENGTH, not a literal');
  assert.doesNotMatch(REGISTER, /otpCode\.length < \d/, 'the submit gate must read OTP_LENGTH, not a literal');
});

test('the slots are generated from the length, not hand-counted', () => {
  // Hand-written <InputOTPSlot index={0..5}/> is how it drifted the first time.
  assert.match(REGISTER, /Array\.from\(\{ length: OTP_LENGTH \}/);
});
