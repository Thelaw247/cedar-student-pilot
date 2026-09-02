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

test('the backdrop is absolute, so its floor reaches the bottom on mobile', () => {
  // It was position:fixed, which iOS Safari clips to .landing-surface's
  // overflow-x:hidden scroll container instead of the viewport — the waveform
  // looked unloaded and the navy floor stopped partway down. Absolute, sized to
  // the full-height wrapper, is what fixes it; fixed must not creep back.
  assert.match(block('.landing-backdrop'), /position:\s*absolute/);
  assert.doesNotMatch(block('.landing-backdrop'), /position:\s*fixed/);
  assert.match(LANDING, /className="landing-backdrop"/, 'the backdrop element is not rendered');
});

test('the waveform is pinned to the top band, not stretched over the whole page', () => {
  // On a long page, inset:0 + cover would zoom the artwork into a blur; a fixed
  // viewport height keeps it a top band that the navy floor carries downward.
  assert.match(block('.landing-backdrop::before'), /height:\s*100vh/,
    'the artwork layer has no bounded height, so a tall page would zoom it enormously');
});
