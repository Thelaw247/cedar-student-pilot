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

// Declarations only. Comments are stripped because these rules are heavily
// commented — with the very property names the negative assertions look for,
// since explaining why something is NOT there means naming it.
const block = (selector) => {
  const at = CSS.indexOf(`${selector} {`);
  assert.ok(at > -1, `${selector} is not defined in index.css`);
  return CSS.slice(at, CSS.indexOf('\n}', at)).replace(/\/\*[\s\S]*?\*\//g, '');
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
});

test('the backdrop spans the large viewport, so it reaches the bottom on iOS', () => {
  // NOT inset:0 / height:100%. Those resolve against the layout (small)
  // viewport on iOS Safari, so the waveform stopped where the toolbar began
  // and a strip of bare floor showed at the bottom once the toolbar retracted.
  // A large-viewport height always reaches the bottom of the screen.
  const bd = block('.landing-backdrop');
  assert.match(bd, /top:\s*0/);
  assert.match(bd, /height:\s*100vh/, 'no large-viewport floor — the 100vh fallback is missing');
  assert.match(bd, /height:\s*100lvh/, 'no lvh height — the exact large-viewport unit is missing');
  assert.doesNotMatch(bd, /inset:\s*0/, 'inset:0 sizes the fixed backdrop to the small viewport again');
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

/* ---------------------------------------------------------------------------
   6 Sep 2026. Reported again from a phone: no background, and a band of white
   at the bottom of the page. Both were still true after the fixes above,
   because both had a cause those fixes did not touch.
   --------------------------------------------------------------------------- */

test('the dark floor is on the canvas, not only on an element', () => {
  // The white band. iOS reveals a rubber-band region above the top and below
  // the bottom of the document, and NO element inside the page can cover it —
  // only the canvas background fills it. The app's own body colour is the
  // light theme, so a dark page ended in white the moment you scrolled past
  // the footer. Desktop never shows it, which is why it survived every
  // desktop check.
  assert.match(CSS, /html\.landing-active[\s\S]{0,80}background-color:\s*hsl\(/,
    'nothing paints the canvas dark, so the overscroll region stays light-theme white');
  assert.match(LANDING, /classList\.add\('landing-active'\)/,
    'Landing.jsx never puts the class on, so the canvas rule can never apply');
  assert.match(LANDING, /classList\.remove\('landing-active'\)/,
    'the class is never removed, so every page after this one inherits a dark canvas');
});

test('the backdrop does not depend on a negative z-index', () => {
  // z-index: -1 only works while nothing between the element and the root
  // creates a stacking context, and it puts the layer on the far side of a
  // compositor boundary. Two positioned siblings ordered 0 and 1 need no such
  // assumption.
  assert.doesNotMatch(block('.landing-backdrop'), /z-index:\s*-/,
    'a negative z-index puts the artwork behind the page background on iOS');
  assert.match(block('.landing-backdrop'), /z-index:\s*0/);
  assert.match(block('.landing-surface'), /z-index:\s*1/,
    'the surface must be ordered above the backdrop, or the backdrop covers the page');
  assert.match(block('.landing-surface'), /position:\s*relative/,
    'z-index does nothing on a static element');
});

test('the backdrop is not promoted to its own compositing layer', () => {
  // will-change: transform on a fixed, negatively-stacked element is what let
  // iOS order it behind the page background. It buys nothing here — nothing on
  // this element ever transforms, and the browser already holds a fixed
  // element still without being told.
  assert.doesNotMatch(block('.landing-backdrop'), /will-change/,
    'compositing promotion on the backdrop is what made it vanish on iOS');
});
