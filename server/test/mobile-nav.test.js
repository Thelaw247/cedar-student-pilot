import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * The mobile bottom nav must stay put.
 *
 * It used to translate off-screen on scroll-down (state `visible`), so the
 * five section tabs vanished exactly while a student scrolled a lecture or a
 * long list — reported 2 Sep. These pin the fix so it cannot regress: no
 * scroll listener, no hide transform, and the layout still reserves space for
 * the fixed bar including the iOS home-indicator inset.
 */
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

test('the bottom nav does not hide itself on scroll', () => {
  const nav = read('../../src/components/BottomNav.jsx');
  assert.doesNotMatch(nav, /translate-y-full/, 'nav must not translate off-screen');
  assert.doesNotMatch(nav, /addEventListener\(\s*['"]scroll/, 'nav must not listen to scroll');
  assert.doesNotMatch(nav, /useState|useEffect/, 'nav has no scroll state any more');
  assert.match(nav, /fixed bottom-0/, 'nav is still fixed to the bottom');
});

test('the layout reserves space for the fixed nav including the safe-area inset', () => {
  const layout = read('../../src/components/Layout.jsx');
  assert.match(layout, /pb-\[calc\(5rem\+env\(safe-area-inset-bottom\)\)\]/);
});

test('the recording island and focus button clear the nav on notched phones', () => {
  assert.match(read('../../src/recording/RecordingIsland.jsx'), /bottom-\[calc\(84px\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(read('../../src/pages/FocusMode.jsx'), /bottom-\[calc\(5\.5rem\+env\(safe-area-inset-bottom\)\)\]/);
});

test('the landing hero carries an honest App Store coming-soon badge, not a dead link', () => {
  const hero = read('../../src/components/landing/LandingHero.jsx');
  assert.match(hero, /coming to the App Store/i);
  // The badge is a static <span> pill with an Apple glyph and no link, because
  // there is nothing to tap until the app ships.
  const badge = hero.match(/<span[^>]*rounded-full[\s\S]*?<\/span>/);
  assert.ok(badge, 'a rounded-full span pill exists');
  assert.match(badge[0], /coming to the App Store/i, 'the pill holds the coming-soon text');
  assert.match(badge[0], /<svg/, 'the pill shows the Apple mark');
  assert.doesNotMatch(badge[0], /href=|<a\s/, 'the pill is not a dead link');
});
