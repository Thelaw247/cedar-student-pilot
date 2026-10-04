/**
 * Product analytics runs only after the visitor allows it, and its code is
 * only downloaded then.
 *
 * HeyCatch (https://heycatch.ai/agents.md) is built on PostHog: once started
 * it keeps a first-party cookie and localStorage entries (names starting
 * "ph_") for a year and records page views and clicks. Until Oct 2026 it
 * started for every visitor before the first render. Now the cookie banner
 * (components/CookieConsent.jsx) asks first, Settings → Privacy can change
 * the answer, and the answer lives in this browser under CONSENT_KEY.
 *
 * The SDK has no opt-out call, so "no" is enforced by never calling init.
 * The SDK is also the single largest thing in the app's first download (a
 * quarter of the main bundle), and most visitors never say yes, so it is
 * loaded on demand (`import()`), from startAnalytics, the one place init is
 * called. The rest of the app talks to the `analytics` object exported
 * below: the same four calls, forwarded to the SDK once it is loaded. A call
 * made while the chunk is still arriving is kept and replayed, so a student
 * identified during that second is still identified; before consent the
 * calls do nothing, exactly as the SDK's own no-ops did.
 *
 * A browser that sends Global Privacy Control is treated as a "no" until its
 * owner turns analytics on in Settings; the banner does not ask it again.
 *
 * Everything the install guide asks for is unchanged apart from the timing:
 * same project key, same install metadata, same tracing host, and the
 * decision to start still runs at module scope before the first render
 * (main.jsx) for anyone who has already said yes. Their first page view is
 * recorded by init itself when the chunk lands, a moment later.
 */

export const CONSENT_KEY = 'praelecta-analytics-consent';
export const CONSENT_EVENT = 'praelecta:analytics-consent';

export const ANALYTICS_CONFIG = Object.freeze({
  // Publishable by design; it belongs in the bundle, the way the Supabase
  // anon key does.
  projectKey: 'hck_pk_DAwNG96mZXpjqzyKcLl-K5UIEoeRbPrB',
  install: {
    framework: 'vite-react',
    // React's major. The guide asks for "the detected major" and does not say
    // which half of vite-react to read; React is what the app is written in,
    // Vite only builds it.
    frameworkVersion: '18',
    agent: 'claude-code',
  },
  // The API lives on its own host, so requests to it carry the SDK's
  // X-POSTHOG-* tracing headers, which server/lib/http.js allows through CORS
  // by pattern (server/test/analytics-install.test.js keeps the two in step).
  tracingHosts: ['api.praelecta.ca'],
});

const sendsGlobalPrivacyControl = () => {
  try {
    return navigator.globalPrivacyControl === true;
  } catch {
    return false;
  }
};

/** The stored answer: 'granted', 'denied', or null when never asked. */
export function readConsent() {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

/** The answer in effect: a stored one, else "no" under GPC, else null (ask). */
export function effectiveConsent() {
  return readConsent() || (sendsGlobalPrivacyControl() ? 'denied' : null);
}

let started = false;
// The SDK module once loaded, and the calls made before it was.
let sdk = null;
const pending = [];

function forward(method, args) {
  if (sdk) sdk.analytics[method](...args);
  else if (started) pending.push([method, args]);
  // Not started: no consent, so nothing is recorded, as with the SDK's own
  // no-ops before init.
}

/**
 * The SDK's calls, as the app uses them. Safe to call at any time: a no-op
 * without consent, queued while the SDK loads, forwarded once it has.
 */
export const analytics = Object.freeze({
  setIdentity: (...args) => forward('setIdentity', args),
  resetIdentity: (...args) => forward('resetIdentity', args),
  trackEvent: (...args) => forward('trackEvent', args),
});

/** Start the SDK, once per page load: fetch it, init it, replay what waited. */
export function startAnalytics() {
  if (started) return;
  started = true;
  import('@heycatch/sdk').then((module) => {
    module.analytics.init(ANALYTICS_CONFIG);
    sdk = module;
    for (const [method, args] of pending.splice(0)) module.analytics[method](...args);
  }).catch((error) => {
    // Blocked by an extension or offline: the app runs without analytics,
    // and the next page load tries again.
    started = false;
    pending.length = 0;
    console.warn('[analytics] the SDK did not load', error?.message || error);
  });
}

/** Module scope in main.jsx: start before the first render for a visitor who said yes. */
export function startAnalyticsIfAllowed() {
  if (readConsent() === 'granted') startAnalytics();
}

const cookieNames = () =>
  document.cookie
    .split(';')
    .map((part) => part.split('=')[0].trim())
    .filter(Boolean);

/**
 * Remove what the SDK keeps in this browser. PostHog writes its cookie for
 * the whole site (domain=.praelecta.ca), so it is expired both with and
 * without a domain. Running SDK code is only stopped by a reload, since init
 * is not called again; Settings reloads after turning analytics off.
 */
export function clearAnalyticsStorage() {
  const isOurs = (name) => name.startsWith('ph_') || name.startsWith('__ph');
  for (const store of ['localStorage', 'sessionStorage']) {
    try {
      const s = window[store];
      for (const key of Object.keys(s)) if (isOurs(key)) s.removeItem(key);
    } catch { /* storage unavailable; nothing stored there either */ }
  }
  try {
    const host = window.location.hostname;
    const site = host.split('.').slice(-2).join('.');
    for (const name of cookieNames().filter(isOurs)) {
      document.cookie = `${name}=; Max-Age=0; path=/`;
      if (site.includes('.')) document.cookie = `${name}=; Max-Age=0; path=/; domain=.${site}`;
    }
  } catch { /* cookies unavailable */ }
}

/** Record the visitor's answer and act on it. */
export function setConsent(value) {
  const answer = value === 'granted' ? 'granted' : 'denied';
  try {
    localStorage.setItem(CONSENT_KEY, answer);
  } catch { /* private mode: the answer holds for this page load only */ }
  if (answer === 'granted') startAnalytics();
  else clearAnalyticsStorage();
  try {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: answer }));
  } catch { /* old browser without CustomEvent: nothing listens there */ }
}

/** True once init has run on this page load. */
export const analyticsStarted = () => started;
