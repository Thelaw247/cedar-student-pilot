import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Guards the routes that have to be reachable WITHOUT signing in.
 *
 * Stripe's business profile, the app stores and the landing footer all link to
 * /privacy and /terms from outside the app. A route that is missing, or that
 * sits inside ProtectedRoute, redirects a signed-out visitor to /login — and
 * because the Cloudflare Worker serves a single-page app, that redirect is
 * served with HTTP 200. Nothing looks broken from a status check while being
 * entirely broken for the person clicking the link. That is exactly how /terms
 * was found missing, so it is worth a test rather than a memory.
 *
 * Reads the router source instead of the built bundle: the frontend has no test
 * runner of its own on this stack, and the same cross-boundary approach already
 * backs scripts/check-api-contract.mjs.
 */

const APP = fs.readFileSync(new URL('../../src/App.jsx', import.meta.url), 'utf8');
const PUBLIC_ROUTES = ['/privacy', '/terms'];

test('every public legal route is declared', () => {
  for (const path of PUBLIC_ROUTES) {
    assert.ok(APP.includes(`path="${path}"`), `${path} has no <Route> in App.jsx`);
  }
});

test('public legal routes sit outside ProtectedRoute', () => {
  const guard = APP.indexOf('<ProtectedRoute');
  assert.ok(guard > -1, 'ProtectedRoute not found — this test needs updating');
  for (const path of PUBLIC_ROUTES) {
    const at = APP.indexOf(`path="${path}"`);
    assert.ok(at < guard, `${path} is inside ProtectedRoute — signed-out visitors would be redirected to /login`);
  }
});

test('each public legal route has a page component that exists', () => {
  for (const path of PUBLIC_ROUTES) {
    const route = APP.slice(APP.indexOf(`path="${path}"`));
    const component = route.match(/element=\{<(\w+)\s*\/>\}/)?.[1];
    assert.ok(component, `could not read the component for ${path}`);
    const lazy = APP.match(new RegExp(`const ${component} = lazy\\(\\(\\) => import\\('\\./pages/(\\w+)'\\)\\)`));
    assert.ok(lazy, `${component} is not lazily imported from ./pages`);
    const file = new URL(`../../src/pages/${lazy[1]}.jsx`, import.meta.url);
    assert.ok(fs.existsSync(file), `src/pages/${lazy[1]}.jsx does not exist`);
  }
});

test('the landing footer links to both, since that is where visitors look', () => {
  const landing = fs.readFileSync(new URL('../../src/pages/Landing.jsx', import.meta.url), 'utf8');
  for (const path of PUBLIC_ROUTES) {
    assert.ok(landing.includes(`to="${path}"`), `the landing footer has no link to ${path}`);
  }
});

test('the terms page quotes prices from lib/tiers rather than hardcoding them', () => {
  const terms = fs.readFileSync(new URL('../../src/pages/Terms.jsx', import.meta.url), 'utf8');
  assert.match(terms, /from '@\/lib\/tiers'/);
  // A bare dollar amount in the copy is a price that will go stale silently the
  // next time the pricing changes. Template output like ${money(t.monthly)} is
  // fine; a literal $7.99 is not.
  const literalPrice = terms.replace(/\$\{[^}]*\}/g, '').match(/\$\d+\.\d\d/);
  assert.equal(literalPrice, null, `hardcoded price ${literalPrice?.[0]} in Terms.jsx`);
});
