import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Guards the landing page's waveform backdrop.
 *
 * It shipped invisible, and the reason is a CSS trap worth a test rather than a
 * memory: .landing-surface is `position: relative`, so its own background paints
 * in the positioned-element pass — ABOVE a z-index:-1 child, not below it. A
 * positioned parent with an opaque background will always cover its own
 * negative-z backdrop. Verified in a browser before and after: with the opaque
 * class on the wrapper the artwork does not render at all.
 *
 * So the base colour belongs on the backdrop layer, and the artwork's dimming
 * belongs on a pseudo-element — putting opacity on .landing-backdrop itself
 * fades the floor with it and lets the light-theme body colour bleed through.
 */

const CSS = fs.readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8');
const LANDING = fs.readFileSync(new URL('../../src/pages/Landing.jsx', import.meta.url), 'utf8');

const block = (selector) => {
  const at = CSS.indexOf(`${selector} {`);
  assert.ok(at > -1, `${selector} is not defined in index.css`);
  return CSS.slice(at, CSS.indexOf('\n}', at));
};

test('the backdrop paints its own opaque floor', () => {
  assert.match(block('.landing-backdrop'), /background-color:\s*hsl\(/,
    'no opaque floor on .landing-backdrop — the light body colour will show through the artwork');
});

test('the wrapper does not paint an opaque background over its own backdrop', () => {
  const wrapper = LANDING.match(/className="landing-surface[^"]*"/);
  assert.ok(wrapper, 'the landing-surface wrapper is gone');
  assert.ok(!/\bbg-background\b/.test(wrapper[0]),
    'the positioned wrapper has an opaque bg-background, which paints over the z-index:-1 backdrop and hides the waveform');
});

test('the artwork is dimmed on its own layer, not by fading the whole backdrop', () => {
  assert.doesNotMatch(block('.landing-backdrop'), /^\s*opacity:/m,
    'opacity on .landing-backdrop fades its opaque floor too');
  assert.match(block('.landing-backdrop::before'), /opacity:\s*0?\.\d/,
    'the artwork layer has no opacity, so the waveform will overpower the text');
});

test('the backdrop points at artwork that actually exists', () => {
  const url = CSS.match(/\.landing-backdrop::before\s*\{[^}]*background-image:\s*url\("([^"]+)"\)/s);
  assert.ok(url, 'no background-image on the artwork layer');
  const file = new URL(`../../public${url[1]}`, import.meta.url);
  assert.ok(fs.existsSync(file), `public${url[1]} does not exist — the backdrop would render as the flat floor colour`);
});

test('the backdrop is fixed, so the page scrolls over a held image', () => {
  assert.match(block('.landing-backdrop'), /position:\s*fixed/,
    'the waveform scrolls away with the content instead of staying put');
  assert.match(block('.landing-backdrop'), /inset:\s*0/);
});

test('the backdrop sits OUTSIDE the overflow-hidden surface', () => {
  // This is the whole reason it can be fixed. .landing-surface is
  // overflow-x:hidden, which makes it a scroll container, and iOS Safari clips
  // a fixed child to that container rather than the viewport: the waveform
  // looked unloaded and the navy floor stopped partway down the page. Rendered
  // as a SIBLING, nothing clips it. Moving it back inside restores both bugs,
  // which is why this is asserted on the markup and not left to memory.
  const backdropAt = LANDING.indexOf('className="landing-backdrop"');
  const surfaceAt = LANDING.indexOf('className="landing-surface');
  assert.ok(backdropAt > -1, 'the backdrop element is not rendered');
  assert.ok(surfaceAt > -1, 'the landing-surface wrapper is gone');
  assert.ok(backdropAt < surfaceAt,
    'the backdrop is inside .landing-surface again — iOS will clip it to that scroll container');
});
