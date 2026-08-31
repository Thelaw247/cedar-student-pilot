/**
 * Boot-time payment configuration check.
 *
 * Every Stripe route is behind requireAuth and the webhook rejects on signature
 * before it ever resolves the mode, so none of this is observable from outside
 * the running service. The first thing that surfaces a mistake is a student's
 * first checkout, which is the worst possible place to find out.
 *
 * Two things are checked, both of which fail quietly rather than loudly:
 *
 *  1. Stripe mode — key, STRIPE_EXPECTED_MODE and webhook secret agreeing.
 *  2. Checkout return — APP_ORIGIN being a host the API will actually talk to.
 *     appOrigin() already rejects a malformed value, but it cannot tell a valid
 *     wrong host from a valid right one. Cross-checking against ALLOWED_ORIGINS
 *     can: if checkout returns a paying student to an origin the API refuses,
 *     they land in an app that 403s on every call, having just been charged.
 *
 * Reported, never thrown. Nothing else in the API depends on Stripe, and
 * crashing the process would turn a billing misconfiguration into a full outage
 * and fail Render's health check on top of it. The caller logs; this decides.
 *
 * Nothing here is secret — modes and origins are safe to print. Keys are not,
 * and a test asserts none of them reach the message.
 */

import { isTestMode } from './stripePrices.js';
import { appOrigin } from './stripe.js';

const PROBED = ['STRIPE_EXPECTED_MODE', 'STRIPE_SECRET_KEY', 'APP_ORIGIN', 'ALLOWED_ORIGINS'];

// isTestMode and appOrigin read process.env directly. Swapping for the duration
// exercises the very functions production uses rather than restating their rules
// here and letting the two definitions drift apart.
function withEnv(env, fn) {
  if (env === process.env) return fn();
  const saved = PROBED.map((k) => [k, process.env[k]]);
  const apply = (pairs) => pairs.forEach(([k, v]) => {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  });
  apply(PROBED.map((k) => [k, env[k]]));
  try { return fn(); } finally { apply(saved); }
}

export function stripeModeStatus(env = process.env) {
  return withEnv(env, () => {
    try {
      const mode = isTestMode() ? 'test' : 'live';
      if (!String(env.STRIPE_WEBHOOK_SECRET || '').trim()) {
        return { ok: false, mode, message: `Stripe ${mode} mode, key matches — but STRIPE_WEBHOOK_SECRET is missing, so payments will succeed and no credits will be granted` };
      }
      return { ok: true, mode, message: `Stripe ${mode} mode: key matches STRIPE_EXPECTED_MODE, webhook secret set` };
    } catch (error) {
      return { ok: false, mode: null, message: `Stripe is not usable: ${error.message}` };
    }
  });
}

export function checkoutReturnStatus(env = process.env) {
  return withEnv(env, () => {
    try {
      const origin = appOrigin();
      const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean);
      if (!allowed.includes(origin)) {
        return { ok: false, origin, message: `checkout returns paying users to ${origin}, which is not on ALLOWED_ORIGINS — they would land in an app the API refuses to answer` };
      }
      return { ok: true, origin, message: `checkout returns to ${origin}, which is on ALLOWED_ORIGINS` };
    } catch (error) {
      return { ok: false, origin: null, message: `checkout return URL unusable: ${error.message}` };
    }
  });
}

export function logStripeBootStatus(env = process.env, logger = console) {
  const statuses = [stripeModeStatus(env), checkoutReturnStatus(env)];
  for (const status of statuses) {
    if (status.ok) logger.log(`[boot] ${status.message}`);
    else logger.error(`[boot] ${status.message}`);
  }
  return statuses;
}
