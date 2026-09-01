import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * The browser enforces the CSP in public/_headers against the bundle built
 * from .env.cloudflare. If connect-src does not name the API host the bundle
 * calls, every API request fails in the browser with no server-side trace —
 * the page loads, sign-in works (Supabase is allowed), and nothing else does.
 * That is exactly the failure that got the live Worker pinned to an old
 * version on 31 Aug, after which no frontend deploy reached users.
 */
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

test('the CSP allows the API host the Cloudflare build is configured to call', () => {
  const env = read('../../.env.cloudflare');
  const api = env.match(/^VITE_RENDER_API_URL=(\S+)/m)?.[1];
  assert.ok(api, 'VITE_RENDER_API_URL missing from .env.cloudflare');
  const headers = read('../../public/_headers');
  const csp = headers.split('\n').find((l) => l.trim().startsWith('Content-Security-Policy:'));
  const connect = csp.match(/connect-src ([^;]+);/)?.[1] || '';
  assert.ok(connect.split(/\s+/).includes(api), `connect-src does not list ${api}: ${connect}`);
  assert.ok(connect.includes('supabase.co'), 'Supabase must stay allowed');
});
