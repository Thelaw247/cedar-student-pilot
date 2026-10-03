import { CREDITS_SPENT_HEADER } from './creditSignal.js';

const LOCAL_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

/**
 * The request headers a browser may send to this API.
 *
 * A fixed list, except for the analytics SDK's tracing headers. Those are
 * all X-POSTHOG-* and are attached to every request bound for a host in
 * `tracingHosts` (main.jsx lists this API) — and the SDK's core is loaded
 * from in.heycatch.ai at runtime, so the set can grow without a deploy here.
 * On 2 Oct 2026 it began sending X-POSTHOG-DISTINCT-ID beside the session
 * and window ids, and every browser call to this API failed its preflight:
 * the request never reached the server, so nothing showed in its logs, and
 * the app said it could not reach the server. Any X-POSTHOG-* header a
 * preflight asks for is now allowed too; no other header is ever reflected.
 */
export const ALLOWED_REQUEST_HEADERS = Object.freeze([
  'Authorization',
  'Content-Type',
  'Stripe-Signature',
  'X-POSTHOG-SESSION-ID',
  'X-POSTHOG-WINDOW-ID',
  'X-POSTHOG-DISTINCT-ID',
]);

const TRACING_HEADER = /^x-posthog-[a-z0-9-]{1,40}$/i;

export function allowedRequestHeaders(requested = '') {
  const known = new Set(ALLOWED_REQUEST_HEADERS.map((h) => h.toLowerCase()));
  const tracing = String(requested)
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter((h) => TRACING_HEADER.test(h) && !known.has(h));
  return [...ALLOWED_REQUEST_HEADERS, ...new Set(tracing.map((h) => h.toUpperCase()))].join(', ');
}

function configuredOrigins() {
  const configured = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set([
    ...configured,
    ...(process.env.NODE_ENV === 'production' ? [] : LOCAL_ORIGINS),
  ]);
}

export function requestSecurity(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), geolocation=(), microphone=()',
  });

  const origin = req.get('Origin');
  if (!origin) return next();

  const allowed = configuredOrigins();
  if (!allowed.has(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  res.set({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    // A header missing from this answer fails the preflight and takes every
    // API call in the browser with it. See ALLOWED_REQUEST_HEADERS above for
    // why the analytics SDK's X-POSTHOG-* headers are allowed by pattern.
    'Access-Control-Allow-Headers': allowedRequestHeaders(req.get('Access-Control-Request-Headers')),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    // Without this the browser hides X-Credits-Spent from the client and the
    // credit meter goes stale again. See server/lib/creditSignal.js.
    'Access-Control-Expose-Headers': CREDITS_SPENT_HEADER,
    Vary: 'Origin',
  });

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
}

/**
 * What a student is told when a request failed in a way they cannot fix.
 */
export const SERVER_ERROR_MESSAGE = 'Something went wrong on our side. Please try again in a moment.';

/**
 * Answer a request that failed unexpectedly: the details go to the log, the
 * student gets a sentence.
 *
 * Twenty-four routes answered a failure with `error.message`, so whatever
 * threw reached the screen as written: a database constraint, "fetch
 * failed", a provider's JSON, "Cannot read properties of undefined". None of
 * it means anything to a student, and some of it describes the database to
 * anyone who asks. Messages written for people (a 4xx, or a 5xx with its own
 * sentence, like "you have not been charged") are still sent by the routes
 * themselves; this is only for the catch-all.
 */
export function sendServerError(res, error, where) {
  console.error(`[${where}]`, error);
  if (res.headersSent) return;
  res.status(500).json({ error: SERVER_ERROR_MESSAGE });
}
