import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * A support contact that exists.
 *
 * The privacy policy and terms both told users to "reach out through the in-app
 * support link", and two error messages said "contact support". There was no
 * support link, route, or address anywhere in the app — every one of those was
 * a dead end, and the legal documents were making a promise nothing kept.
 *
 * Stripe's business profile and App Store Connect both require a reachable
 * support contact too, so this is not only a courtesy.
 */

const SRC = new URL('../../src/', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, SRC), 'utf8');
// legal.js lives in shared/ now, so the iOS app uses the same address.
// src/lib/legal.js re-exports it and every web import is unchanged.
const LEGAL = fs.readFileSync(new URL('../../shared/legal.js', import.meta.url), 'utf8');

const walk = (dir) => fs.readdirSync(new URL(dir, SRC), { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(`${dir}${e.name}/`) : (e.name.endsWith('.jsx') || e.name.endsWith('.js') ? [`${dir}${e.name}`] : []));
// Comments stripped. These are assertions about USER-VISIBLE COPY, and the
// comments explaining this change legitimately quote the old wording. Third
// time this exact shape has come up in this codebase: an absence assertion over
// source text has to ignore prose, the same way a presence assertion has to
// ignore commented-out code.
const strip = (src) => src
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const FILES = walk('').map((p) => [p, strip(read(p))]);

test('the support address is declared once, in shared/legal', () => {
  assert.match(LEGAL, /export const SUPPORT_EMAIL = '[^']+@[^']+'/);
  assert.match(LEGAL, /export const SUPPORT_MAILTO =/);
});

test('nothing hardcodes the address instead of importing it', () => {
  const email = LEGAL.match(/export const SUPPORT_EMAIL = '([^']+)'/)[1];
  for (const [p, src] of FILES) {
    if (p === 'lib/legal.js') continue; // the re-export stub, not a hardcode
    assert.ok(!src.includes(email), `${p} hardcodes the support address; it will drift when the address changes`);
  }
});

test('no copy points at a support link that does not exist', () => {
  for (const [p, src] of FILES) {
    assert.ok(!/in-app support/i.test(src), `${p} still points at a non-existent in-app support link`);
    assert.ok(!/contact support/i.test(src), `${p} says "contact support" without saying how`);
  }
});

test('both legal pages give a way to make contact', () => {
  for (const p of ['pages/PrivacyPolicy.jsx', 'pages/Terms.jsx']) {
    const src = read(p);
    assert.match(src, /SUPPORT_MAILTO/, `${p} has no reachable contact`);
    assert.match(src, /from '@\/lib\/legal'/);
  }
});

test('Settings carries the support section the documents promise', () => {
  const s = strip(read('pages/Settings.jsx'));
  assert.match(s, /title="Support"/, 'no Support section in Settings');
  assert.match(s, /href=\{SUPPORT_MAILTO\}/, 'the Support section has no working contact');
  for (const route of ['/privacy', '/terms']) {
    assert.ok(s.includes(`to="${route}"`), `Settings does not link to ${route}`);
  }
});

test('the mailto is built from the address, not typed twice', () => {
  assert.match(LEGAL, /SUPPORT_MAILTO = `mailto:\$\{SUPPORT_EMAIL\}`/);
});
