import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * "Some pages don't load when you open them — you have to press refresh."
 *
 * Every route is a React.lazy(() => import(...)) chunk. When a new build ships,
 * a tab still holding the old index.html imports a chunk filename the CDN no
 * longer serves; the import rejects, and a rejected import is an error, not a
 * Suspense pending state, so with no error boundary the route tree unmounts to
 * a blank page. A manual refresh loads the new index.html and it works. The
 * same stale bundle is why a tab kept running the old AttendancePrompt — and
 * re-created an AI-estimated lecture — hours after that fix had deployed.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const APP = read('../../src/App.jsx');
const BOUNDARY = read('../../src/components/ChunkReloadBoundary.jsx');

test('the lazy routes are wrapped in a chunk-reload boundary', () => {
  assert.match(APP, /import ChunkReloadBoundary/);
  // The boundary must sit OUTSIDE Suspense: Suspense handles pending, the
  // boundary handles rejected. A boundary inside Suspense never sees the throw.
  const boundaryAt = APP.indexOf('<ChunkReloadBoundary>');
  const suspenseAt = APP.indexOf('<Suspense');
  assert.ok(boundaryAt > -1 && suspenseAt > boundaryAt, 'the boundary must wrap Suspense, not sit inside it');
});

test('a rejected dynamic import reloads once, and cannot loop', () => {
  assert.match(BOUNDARY, /static getDerivedStateFromError/);
  assert.match(BOUNDARY, /isChunkLoadError/);
  // Reload is guarded by a recent-reload timestamp so a permanently-missing
  // chunk shows a prompt instead of thrashing.
  assert.match(BOUNDARY, /RELOAD_WINDOW_MS/);
  assert.match(BOUNDARY, /sessionStorage/);
  // A non-chunk error is re-thrown, never swallowed as a spurious reload.
  assert.match(BOUNDARY, /throw this\.state\.error/);
});

test('a failed modulepreload is caught before the click', () => {
  assert.match(APP, /vite:preloadError/);
  assert.match(APP, /reloadOnceForChunkError/);
  // preventDefault ONLY when we actually reloaded. Vite re-throws unless the
  // default is prevented; suppressing the throw without reloading makes the
  // import resolve to undefined and React.lazy blank the page — so the guard's
  // return value must gate preventDefault, not run beside it.
  assert.match(APP, /if \(reloadOnceForChunkError\(\)\) e\?\.preventDefault\?\.\(\)/,
    'preventDefault must be gated on an actual reload, or a suppressed-but-not-reloaded chunk error blanks the page');
});
