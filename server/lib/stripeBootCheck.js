/**
 * Boot-time Stripe configuration check.
 *
 * Every Stripe route is auth-gated and the webhook rejects on signature before
 * it ever resolves the mode, so a wrong STRIPE_EXPECTED_MODE, a missing key or
 * a test/live mismatch is invisible from outside the service. The first thing
 * that surfaces it is a student's first checkout failing, which is the worst
 * possible place to find out.
 *
 * Resolving it once at boot turns that into a line in the deploy log.
 * Deliberately reported rather than thrown: the rest of the API does not depend
 * on Stripe, and taking the process down would turn a billing misconfiguration
 * into a full outage. The caller logs; this function only decides.
 */

import { isTestMode } from './stripePrices.js';

export function stripeBootStatus(env = process.env) {
  const previous = {
    mode: process.env.STRIPE_EXPECTED_MODE,
    key: process.env.STRIPE_SECRET_KEY,
  };
  const restore = () => {
    if (previous.mode === undefined) delete process.env.STRIPE_EXPECTED_MODE;
    else process.env.STRIPE_EXPECTED_MODE = previous.mode;
    if (previous.key === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previous.key;
  };

  try {
    // isTestMode reads process.env directly; swap for the duration so the same
    // function is exercised in tests as in production rather than duplicating
    // the mode rules here and letting the two drift apart.
    if (env !== process.env) {
      if (env.STRIPE_EXPECTED_MODE === undefined) delete process.env.STRIPE_EXPECTED_MODE;
      else process.env.STRIPE_EXPECTED_MODE = env.STRIPE_EXPECTED_MODE;
      if (env.STRIPE_SECRET_KEY === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = env.STRIPE_SECRET_KEY;
    }

    const mode = isTestMode() ? 'test' : 'live';
    const webhookSecret = String(env.STRIPE_WEBHOOK_SECRET || '').trim();
    if (!webhookSecret) {
      return {
        ok: false,
        mode,
        message: `Stripe ${mode} mode, key matches — but STRIPE_WEBHOOK_SECRET is missing, so payments will succeed and no credits will be granted`,
      };
    }
    return { ok: true, mode, message: `Stripe ${mode} mode: key matches STRIPE_EXPECTED_MODE, webhook secret set` };
  } catch (error) {
    return { ok: false, mode: null, message: `Stripe is not usable: ${error.message}` };
  } finally {
    if (env !== process.env) restore();
  }
}

export function logStripeBootStatus(env = process.env, logger = console) {
  const status = stripeBootStatus(env);
  if (status.ok) logger.log(`[boot] ${status.message}`);
  else logger.error(`[boot] ${status.message}`);
  return status;
}
