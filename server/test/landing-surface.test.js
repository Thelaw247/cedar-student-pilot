import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Keeps the landing page reading as one continuous surface.
 *
 * The waveform is the background; anything painted over the full width of it
 * competes with it. Three things were doing that, and all three were invisible
 * in the source and obvious in a browser:
 *
 *  - `border-t/border-y border-border` on section elements: full-width rules
 *    cutting the page into strips.
 *  - `bg-background/25|40|60` on sections and the footer: translucent washes
 *    that read as lighter rectangles over the artwork.
 *  - A `.landing-backdrop::after` vignette greying the whole page.
 *
 * And a fourth, which is what made the bottom look broken: blurred glow blobs
 * inside an `overflow-hidden` box. A blur clipped to a rectangle stops being a
 * glow and becomes a hard-edged square.
 *
 * Cards keep their own borders and backgrounds — those define the cards. This
 * only forbids the page-level bands.
 */

const DIR = new URL('../../src/components/landing/', import.meta.url);
const FILES = [
  ...fs.readdirSync(DIR).filter((f) => f.endsWith('.jsx')).map((f) => [f, fs.readFileSync(new URL(f, DIR), 'utf8')]),
  ['pages/Landing.jsx', fs.readFileSync(new URL('../../src/pages/Landing.jsx', import.meta.url), 'utf8')],
];
const CSS = fs.readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8');

// Page-level bands only. <header> is excluded: it is fixed, content scrolls
// under it, and its translucent background is what keeps the nav readable.
const bands = (src) => [...src.matchAll(/<(?:section|footer)\b[^>]*?className="([^"]*)"/gs)].map((m) => m[1]);

test('no section or footer draws a full-width rule', () => {
  for (const [name, src] of FILES) {
    for (const cls of bands(src)) {
      assert.doesNotMatch(cls, /\bborder-[tby] border-border\b/,
        `${name} has a full-width divider on a page band`);
    }
  }
});

test('no section or footer washes the backdrop with a background tint', () => {
  for (const [name, src] of FILES) {
    for (const cls of bands(src)) {
      assert.doesNotMatch(cls, /\bbg-(background|muted|card)\/\d+\b/,
        `${name} tints a full-width band over the waveform`);
      assert.doesNotMatch(cls, /\bbg-(background|muted|card)\b(?!\/)/,
        `${name} paints an opaque band over the waveform`);
    }
  }
});

test('the backdrop has no vignette layer over the artwork', () => {
  assert.ok(!CSS.includes('.landing-backdrop::after'),
    'the vignette is back — it greys the entire page, which is the tint this removed');
});

test('no full-bleed decoration box clips its contents to a rectangle', () => {
  // The shape that caused it: a `pointer-events-none absolute` box - which only
  // ever holds decoration - that is ALSO `overflow-hidden`. Clipping decoration
  // to a full-width rectangle is how a soft glow becomes a hard-edged square.
  // A rounded card clipping its own inner glow is fine and stays allowed: the
  // card has a visible border and radius, so the clip reads as the card's edge.
  for (const [name, src] of FILES) {
    for (const m of src.matchAll(/className="([^"]*)"/g)) {
      const cls = m[1];
      if (!/\bpointer-events-none\b/.test(cls) || !/\babsolute\b/.test(cls)) continue;
      assert.doesNotMatch(cls, /\boverflow-hidden\b/,
        `${name} clips a decoration layer to a box; blurred contents render as a hard-edged rectangle`);
    }
  }
});

test('the fixed nav keeps its background — this is not a band to strip', () => {
  const nav = FILES.find(([n]) => n === 'LandingNav.jsx')[1];
  const header = nav.match(/<header\b[^>]*?className="([^"]*)"/s);
  assert.ok(header, 'the landing header is gone');
  assert.match(header[1], /\bbg-background\/\d+\b/,
    'the fixed nav lost its background; links would sit unreadable over scrolling content');
  assert.match(header[1], /backdrop-blur/);
});
