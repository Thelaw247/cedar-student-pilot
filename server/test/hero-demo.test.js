import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * The hero shows the product in use: a muted, looping screen recording of a
 * real account, in the window frame beside the headline. These tests hold
 * the things that make a hero video work rather than hurt — it plays by
 * itself on every phone, it is small, it is cached for a year under a
 * versioned name, a visitor who asked for less motion gets a still, and
 * the file the page names is the file in the deploy.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const HERO = read('../../src/components/landing/LandingHero.jsx');
const HEADERS = read('../../public/_headers');
const stat = (p) => fs.statSync(new URL(p, import.meta.url));

test('the loop autoplays everywhere a muted video can, with no controls and no sound', () => {
  const video = HERO.slice(HERO.indexOf('<video'), HERO.indexOf('/>', HERO.indexOf('<video')));
  for (const attr of ['autoPlay', 'muted', 'loop', 'playsInline', 'disablePictureInPicture']) {
    assert.match(video, new RegExp(`\\s${attr}\\s`), `${attr} is missing — iOS Safari will not start the loop without it`);
  }
  assert.doesNotMatch(video, /\scontrols\s/, 'a control bar on a hero loop invites a pause');
  assert.match(video, /poster=\{HERO_DEMO_POSTER\}/, 'the first frame shows before the first byte of video arrives');
  assert.match(video, /aria-label=\{HERO_DEMO_ALT\}/, 'a screen reader gets the same description as the loop');
  assert.match(video, /width="1386"\s+height="780"/, 'the box is sized before the file loads, so nothing shifts');
});

test('the loop plays from a blob: URL, because the static host will not answer a range request and Safari needs one', () => {
  // A Range request to praelecta.ca gets the whole file and a 200; Safari
  // stops on that. The browser serves a blob: URL to itself with ranges.
  const video = HERO.slice(HERO.indexOf('<video'), HERO.indexOf('/>', HERO.indexOf('<video')));
  assert.match(video, /src=\{src \|\| undefined\}/, 'the video points at its own address again; Safari will show only the poster');
  assert.doesNotMatch(video, /src=\{HERO_DEMO_VIDEO\}/);
  assert.match(HERO, /fetch\(HERO_DEMO_VIDEO, \{ signal: controller\.signal, priority: 'low' \}\)/);
  assert.match(HERO, /objectUrl = URL\.createObjectURL\(blob\);/);
  // Nothing outlives the component: the request is cancelled, the URL freed,
  // and a reply that lands after unmount creates nothing.
  assert.match(HERO, /controller\.abort\(\);\s*if \(objectUrl\) URL\.revokeObjectURL\(objectUrl\);/);
  assert.match(HERO, /if \(controller\.signal\.aborted\) return;/);
  assert.match(HEADERS, /media-src 'self' blob:/, 'without blob: in media-src the loop is blocked everywhere');
});

test('less motion or a data saver means a still, and the hook follows the setting while the page is open', () => {
  assert.match(HERO, /\(prefers-reduced-motion: reduce\)/);
  assert.match(HERO, /navigator\.connection\?\.saveData/);
  assert.match(HERO, /const still = reduced \|\| saveData;/);
  assert.match(HERO, /if \(still\) return undefined;/, 'the 2.4 MB is fetched for a visitor who will only see the still');
  assert.match(HERO, /if \(still\) \{\s*return <img src=\{HERO_DEMO_POSTER\} alt=\{HERO_DEMO_ALT\}/);
  assert.match(HERO, /media\.addEventListener\('change', onChange\)/);
  assert.match(HERO, /media\.removeEventListener\('change', onChange\)/);
});

test('the files the page names exist in the deploy, are small, and are cached under a versioned name', () => {
  const video = HERO.match(/export const HERO_DEMO_VIDEO = '([^']+)'/)[1];
  const poster = HERO.match(/export const HERO_DEMO_POSTER = '([^']+)'/)[1];
  assert.match(video, /^\/hero-demo-v\d+\.mp4$/, 'the name carries a version: _headers caches it for a year');
  assert.match(poster, /^\/hero-demo-v\d+\.jpg$/);
  const mp4 = stat(`../../public${video}`);
  const jpg = stat(`../../public${poster}`);
  assert.ok(mp4.size > 500_000 && mp4.size < 4_000_000, `the loop is ${mp4.size} bytes; it should stay under 4 MB on a phone connection`);
  assert.ok(jpg.size > 20_000 && jpg.size < 250_000, `the poster is ${jpg.size} bytes`);
  // MP4 with the moov atom first (faststart), so playback starts on the
  // first bytes rather than after the whole file.
  const head = fs.readFileSync(new URL(`../../public${video}`, import.meta.url)).subarray(0, 64 * 1024).toString('latin1');
  assert.ok(head.includes('ftyp'), 'not an MP4');
  assert.ok(head.includes('moov'), 'the moov atom is at the end of the file; the video cannot start until it has all downloaded');
  assert.match(HEADERS, /^\/hero-demo-\*\n\s+Cache-Control: public, max-age=31536000, immutable$/m);
});
