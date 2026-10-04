import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ALLOWED_REQUEST_HEADERS, allowedRequestHeaders } from '../lib/http.js';

/**
 * The HeyCatch install, held together across the six files it touches.
 *
 * Installed 22 Sep 2026 from https://heycatch.ai/agents.md. Analytics fails
 * silently by nature: every piece of this can break with the app still
 * working perfectly and the dashboard simply staying empty. So the pieces
 * that have to agree are pinned to each other here.
 *
 * Since Oct 2026 the browser half starts only after the visitor allows it
 * (src/lib/analyticsConsent.js, the cookie banner, Settings). The consent
 * check is pinned here too: a change that quietly starts analytics for
 * everyone again would leave the dashboard looking better, not broken.
 *
 * Read from source, like public-routes.test.js, because the frontend has no
 * test runner of its own on this stack.
 */

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
const MAIN = read('../../src/main.jsx');
const CONSENT = read('../../src/lib/analyticsConsent.js');
const BANNER = read('../../src/components/CookieConsent.jsx');
const APP = read('../../src/App.jsx');
const SETTINGS = read('../../src/pages/Settings.jsx');
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

test('init runs only for a visitor who said yes, from one place, before the app renders', () => {
  // Since Oct 2026 the cookie banner asks first. The SDK has no opt-out call,
  // so "no" is enforced by never calling init, and every other call
  // (setIdentity, resetIdentity, trackEvent) is a no-op until it runs.
  //
  // The SDK is a quarter of the main bundle and most visitors never say yes,
  // so it is downloaded on demand from startAnalytics, the one place init is
  // called (4 Oct 2026). Nothing else may import it: the app goes through the
  // forwarding object analyticsConsent.js exports, which queues calls made
  // while the chunk is still arriving and drops them without consent.
  assert.doesNotMatch(CONSENT, /^import .*'@heycatch\/sdk'/m, 'a static import puts the SDK back in the first download');
  assert.match(CONSENT, /import\('@heycatch\/sdk'\)\.then\(\(module\) => \{\s*module\.analytics\.init\(ANALYTICS_CONFIG\);/, 'init runs as soon as the chunk lands');
  assert.equal(CONSENT.match(/analytics\.init\(/g)?.length, 1, 'init is called from one place');
  assert.match(CONSENT, /else if \(started\) pending\.push\(\[method, args\]\);/, 'a call made while the SDK loads is lost');
  assert.match(CONSENT, /for \(const \[method, args\] of pending\.splice\(0\)\) module\.analytics\[method\]\(\.\.\.args\);/, 'queued calls are not replayed');
  for (const [name, src] of [['main.jsx', MAIN], ['AuthContext.jsx', AUTH], ['Register.jsx', REGISTER]]) {
    assert.doesNotMatch(src, /analytics\.init\(/, `${name} starts analytics around the consent check`);
    assert.doesNotMatch(src, /from ['"]@heycatch\/sdk['"]/, `${name} imports the SDK itself; it must go through analyticsConsent.js`);
  }
  assert.match(AUTH, /import \{ CONSENT_EVENT, analytics \} from '@\/lib\/analyticsConsent';/);
  assert.match(REGISTER, /import \{ analytics \} from "@\/lib\/analyticsConsent";/);
  assert.match(CONSENT, /export function startAnalyticsIfAllowed\(\) \{\s*if \(readConsent\(\) === 'granted'\) startAnalytics\(\);/,
    'init runs without a stored yes');
  // Global Privacy Control is an answer: no, until its owner says otherwise.
  assert.match(CONSENT, /navigator\.globalPrivacyControl === true/);
  assert.match(CONSENT, /return readConsent\(\) \|\| \(sendsGlobalPrivacyControl\(\) \? 'denied' : null\);/);
  // Module scope in the entry file, before the first render, so a visitor who
  // already said yes still has their first page view seen.
  assert.match(MAIN, /^import \{ startAnalyticsIfAllowed \} from '@\/lib\/analyticsConsent'$/m);
  assert.match(MAIN, /^startAnalyticsIfAllowed\(\)$/m, 'nothing may wrap the call');
  assert.ok(MAIN.indexOf('startAnalyticsIfAllowed()') < MAIN.indexOf('ReactDOM.createRoot'), 'the check has to run before the first render');
  assert.doesNotMatch(MAIN, /typeof window/, 'the guide forbids window guards');
  // The install guide's settings, unchanged by the move.
  assert.doesNotMatch(CONSENT, /apiHost:/, 'the guide forbids passing apiHost');
  assert.ok(CONSENT.includes(`projectKey: '${KEY}'`), 'the project key is not the one from the dashboard');
  assert.match(CONSENT, /framework: 'vite-react'/);
  assert.match(CONSENT, /frameworkVersion: '18'/, 'React 18 is what package.json pins');
  assert.match(CONSENT, /agent: 'claude-code'/);
  assert.equal(webPkg.dependencies.react.replace(/[^\d.]/g, '').split('.')[0], '18',
    'React moved major: frameworkVersion in analyticsConsent.js has to move with it');
});

test('the banner asks, it does not steer, and the answer can be changed', () => {
  // Two answers with the same weight, neither chosen in advance, and a way to
  // the details. Closing the page without answering leaves analytics off.
  const buttons = [...BANNER.matchAll(/<button type="button" className=\{(\w+)\} onClick=\{\(\) => choose\('(granted|denied)'\)\}>/g)];
  assert.deepEqual(buttons.map((m) => m[2]).sort(), ['denied', 'granted'], 'the banner does not offer both answers');
  assert.equal(new Set(buttons.map((m) => m[1])).size, 1, 'the two answers are styled differently');
  assert.match(BANNER, /to="\/privacy#cookies"/, 'no link to what the cookie is');
  assert.match(BANNER, /useState\(\(\) => effectiveConsent\(\)\)/, 'the banner shows to someone who already answered');
  assert.match(APP, /<CookieConsent \/>/, 'the banner is not mounted');
  assert.match(SETTINGS, /setConsent\(/, 'Settings cannot change the answer');
  // Saying no removes what an earlier yes left behind.
  assert.match(CONSENT, /if \(answer === 'granted'\) startAnalytics\(\);\s*else clearAnalyticsStorage\(\);/);
});

test('the API host is traced in the browser and allowed through CORS', () => {
  // tracingHosts makes the browser attach X-POSTHOG-SESSION-ID to requests
  // bound for that host. Allow-Headers on the API is a fixed list, so a host
  // traced without being allowed fails the preflight — and with it every API
  // call the app makes. http.test.js proves the live preflight.
  const traced = CONSENT.match(/tracingHosts: \[([^\]]*)\]/)?.[1] || '';
  const hosts = [...traced.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(hosts.length > 0, 'the API is on another host; it has to be traced');
  const apiHost = new URL(read('../../.env.cloudflare').match(/^VITE_RENDER_API_URL=(\S+)/m)[1]).host;
  assert.ok(hosts.includes(apiHost), `tracingHosts does not name ${apiHost}, the host the build calls`);
  assert.match(HTTP, /'Access-Control-Allow-Headers': allowedRequestHeaders\(req\.get\('Access-Control-Request-Headers'\)\)/);
  const allowed = allowedRequestHeaders('').toLowerCase();
  for (const header of ['x-posthog-session-id', 'x-posthog-window-id', 'x-posthog-distinct-id']) {
    assert.ok(allowed.includes(header), `${header} is not allowed by the API: every API call in the browser fails`);
  }
});

test('a tracing header the SDK adds later is allowed without a deploy; nothing else is reflected', () => {
  // The SDK's core comes from in.heycatch.ai at runtime. On 2 Oct 2026 it
  // started sending X-POSTHOG-DISTINCT-ID and every browser call to the API
  // failed its preflight until the list caught up.
  const answer = allowedRequestHeaders('authorization, x-posthog-distinct-id, X-PostHog-Trace-Id, x-evil, cookie').toLowerCase().split(', ');
  assert.ok(answer.includes('x-posthog-trace-id'), 'a new x-posthog-* header was refused');
  assert.ok(!answer.includes('x-evil') && !answer.includes('cookie'), 'a header outside the tracing pattern was reflected');
  assert.equal(answer.filter((h) => h === 'x-posthog-distinct-id').length, 1, 'a known header is listed twice');
  assert.equal(ALLOWED_REQUEST_HEADERS.length, 6);
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
  assert.match(PRIVACY, /recordings, transcripts and uploaded files are never sent to HeyCatch/);
  assert.match(PRIVACY, /runs only if you allow the analytics cookie/, 'the policy does not say analytics waits for a yes');
  assert.match(PRIVACY, /id="cookies"/, 'the banner links to a cookies section that is not there');
});
