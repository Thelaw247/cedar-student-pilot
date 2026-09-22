import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * The HeyCatch install, held together across the six files it touches.
 *
 * Installed 22 Sep 2026 from https://heycatch.ai/agents.md. Analytics fails
 * silently by nature: every piece of this can break with the app still
 * working perfectly and the dashboard simply staying empty. So the pieces
 * that have to agree are pinned to each other here.
 *
 * Read from source, like public-routes.test.js, because the frontend has no
 * test runner of its own on this stack.
 */

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
const MAIN = read('../../src/main.jsx');
const SERVER_ANALYTICS = read('../lib/analytics.js');
const HEADERS = read('../../public/_headers');
const REDIRECTS = read('../../public/_redirects');
const HTTP = read('../lib/http.js');
const WEBHOOK = read('../routes/stripeWebhook.js');
const AUTH = read('../../src/lib/AuthContext.jsx');
const REGISTER = read('../../src/pages/Register.jsx');
const PRIVACY = read('../../src/pages/PrivacyPolicy.jsx');
const webPkg = JSON.parse(read('../../package.json'));
const serverPkg = JSON.parse(read('../package.json'));

const KEY = 'hck_pk_DAwNG96mZXpjqzyKcLl-K5UIEoeRbPrB';
const INGEST = 'https://in.heycatch.ai';

test('the SDK is a stable release in both packages', () => {
  // A prerelease (-dev.N, -beta.N, -rc.N) talks to HeyCatch's own staging
  // backend: events leave the browser and never reach this project.
  for (const [name, pkg] of [['web', webPkg], ['server', serverPkg]]) {
    const range = pkg.dependencies['@heycatch/sdk'];
    assert.ok(range, `@heycatch/sdk is not a dependency of the ${name} package`);
    assert.doesNotMatch(range, /-(dev|beta|rc)\./, `the ${name} package is on a prerelease: ${range}`);
  }
  assert.equal(webPkg.dependencies['@heycatch/sdk'], serverPkg.dependencies['@heycatch/sdk'],
    'browser and server must send from the same SDK version');
});

test('init runs once at module scope in the entry file, before the app renders', () => {
  assert.match(MAIN, /^import \{ analytics \} from '@heycatch\/sdk'$/m, 'a static import, not a lazy one');
  const initAt = MAIN.indexOf('analytics.init(');
  assert.ok(initAt > -1, 'src/main.jsx does not initialise analytics');
  assert.ok(initAt < MAIN.indexOf('ReactDOM.createRoot'), 'init has to run before the first render');
  // Module scope: nothing may wrap the call.
  assert.match(MAIN, /^analytics\.init\(\{$/m);
  assert.doesNotMatch(MAIN, /typeof window/, 'the guide forbids window guards and once-flags');
  assert.doesNotMatch(MAIN, /apiHost:/, 'the guide forbids passing apiHost');
  assert.ok(MAIN.includes(`projectKey: '${KEY}'`), 'the project key is not the one from the dashboard');
  assert.match(MAIN, /framework: 'vite-react'/);
  assert.match(MAIN, /frameworkVersion: '18'/, 'React 18 is what package.json pins');
  assert.match(MAIN, /agent: 'claude-code'/);
  assert.equal(webPkg.dependencies.react.replace(/[^\d.]/g, '').split('.')[0], '18',
    'React moved major: frameworkVersion in main.jsx has to move with it');
});

test('the API host is traced in the browser and allowed through CORS', () => {
  // tracingHosts makes the browser attach X-POSTHOG-SESSION-ID to requests
  // bound for that host. Allow-Headers on the API is a fixed list, so a host
  // traced without being allowed fails the preflight — and with it every API
  // call the app makes. http.test.js proves the live preflight.
  const traced = MAIN.match(/tracingHosts: \[([^\]]*)\]/)?.[1] || '';
  const hosts = [...traced.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(hosts.length > 0, 'the API is on another host; it has to be traced');
  const apiHost = new URL(read('../../.env.cloudflare').match(/^VITE_RENDER_API_URL=(\S+)/m)[1]).host;
  assert.ok(hosts.includes(apiHost), `tracingHosts does not name ${apiHost}, the host the build calls`);
  const allowed = HTTP.match(/'Access-Control-Allow-Headers': '([^']+)'/)[1].toLowerCase();
  for (const header of ['x-posthog-session-id', 'x-posthog-window-id']) {
    assert.ok(allowed.includes(header), `${header} is not allowed by the API: every API call in the browser fails`);
  }
});

test('the CSP lets the SDK load and send', () => {
  const csp = HEADERS.split('\n').find((line) => line.trim().startsWith('Content-Security-Policy:'));
  const directive = (name) => csp.match(new RegExp(`${name} ([^;]+);`))?.[1] || '';
  assert.ok(directive('script-src').includes(INGEST), 'script-src blocks the SDK loading its own extensions');
  assert.ok(directive('connect-src').includes(INGEST), 'connect-src blocks every event');
});

test('every single-character path is a 302 to the homepage with its campaign', () => {
  // The app answers anything else with the single-page fallback: HTTP 200,
  // a page that looks fine, and an attribution click thrown away.
  const chars = [...'abcdefghijklmnopqrstuvwxyz0123456789'];
  for (const char of chars) {
    assert.match(REDIRECTS, new RegExp(`^/${char}\\s+/\\?utm_source=heycatch&utm_campaign=${char}\\s+302$`, 'm'),
      `/${char} has no short-link redirect`);
  }
  const rules = REDIRECTS.split('\n').filter((line) => line.startsWith('/'));
  assert.equal(rules.length, chars.length, 'a rule that is not a short link is in _redirects');
});

test('the browser says who the person is, and stops saying it on sign-out', () => {
  assert.match(AUTH, /import \{ analytics \} from '@heycatch\/sdk';/);
  const body = AUTH.slice(AUTH.indexOf('const checkUserAuth = useCallback'), AUTH.indexOf('const clearOfflineData'));
  const check = body.slice(0, body.indexOf('} catch (error) {'));
  assert.match(check, /analytics\.setIdentity\(\s*currentUser\.id,/, 'the signed-in user is never identified');
  assert.match(check, /email: currentUser\.email, name: currentUser\.full_name/);
  assert.match(AUTH.slice(AUTH.indexOf('const logout = useCallback')), /analytics\.resetIdentity\(\);/,
    'signing out leaves the next person identified as the last one');
});

test('the outcomes nobody can autocapture are sent, each from the side that knows', () => {
  // Client knows: the account was confirmed in this tab.
  assert.match(REGISTER, /analytics\.trackEvent\('signup_completed'\);/);
  // Server knows: Stripe paid. An ad blocker can never eat a server event.
  assert.ok(SERVER_ANALYTICS.includes(`projectKey: '${KEY}'`), 'the server sends to a different project than the browser');
  assert.match(WEBHOOK, /import \{ analytics \} from '\.\.\/lib\/analytics\.js';/);
  assert.match(WEBHOOK, /await analytics\.trackEvent\('subscription_started', \{ plan: entitlement\.tier, period: entitlement\.period \}, \{ userId \}\)/);
  assert.match(WEBHOOK, /await analytics\.trackEvent\('credit_pack_purchased', \{ credits: entitlement\.credits \}, \{ userId \}\)/);
  // Stripe retries a webhook it did not hear back from; `already` is how the
  // fulfillment reports a replay, and a replay is not a second purchase.
  assert.match(WEBHOOK, /if \(!granted\?\.already\) \{/);
  assert.equal(WEBHOOK.match(/if \(!granted\?\.already\) \{/g).length, 2);
});

test('the privacy policy says an analytics company sees this', () => {
  assert.ok(PRIVACY.includes('HeyCatch'), 'a processor the policy does not name');
  assert.match(PRIVACY, /recordings, transcripts and uploaded files are never sent to it/);
});
