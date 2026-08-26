/**
 * Server-side authoritative map of tier/pack ids -> Stripe price IDs.
 * Direct port of base44/shared/stripePrices.ts — same mode-aware selection
 * (test key prefix -> TEST_*, anything else -> LIVE_*), same invariant that
 * every subscription tier must be cheaper per credit than every pack.
 */

const LIVE_SUBSCRIPTION_PRICES = {
  student:   { monthly: 'price_1U4ZFbRecX8K7mfKozUiB8wl', semester: 'price_1U5YKeRecX8K7mfKx4tqSr5I' },
  scholar:   { monthly: 'price_1U4ZFRRecX8K7mfK28s9gC59', semester: 'price_1U4ZFRRecX8K7mfKHwa5C3We' },
  unlimited: { monthly: 'price_1U4ZFNRecX8K7mfKAbJhIiKA', semester: 'price_1U5YKiRecX8K7mfKGdP4kMkK' },
};
const LIVE_PACK_PRICES = {
  small:  { priceId: 'price_1U5YKmRecX8K7mfKs8jgOUcs', credits: 100 },
  medium: { priceId: 'price_1U5YKqRecX8K7mfKnqPJGaMT', credits: 250 },
  large:  { priceId: 'price_1U5YKuRecX8K7mfKaGgeHZZQ', credits: 500 },
};
const TEST_SUBSCRIPTION_PRICES = {
  student:   { monthly: 'price_1U4ZcQRecX8K7mfKFbmPPwsw', semester: 'price_1U5YKzRecX8K7mfKt7dExkuL' },
  scholar:   { monthly: 'price_1U4ZcURecX8K7mfK8r1bhRCu', semester: 'price_1U4ZcWRecX8K7mfKmkqyxMe1' },
  unlimited: { monthly: 'price_1U4ZcZRecX8K7mfKvfXZi2wv', semester: 'price_1U5YL3RecX8K7mfKoyLtrFOO' },
};
const TEST_PACK_PRICES = {
  small:  { priceId: 'price_1U5YL7RecX8K7mfKwOSZD2Hi', credits: 100 },
  medium: { priceId: 'price_1U5YLBRecX8K7mfKwbPeqITO', credits: 250 },
  large:  { priceId: 'price_1U5YLFRecX8K7mfKrO7nA7xu', credits: 500 },
};

export function expectedStripeMode() {
  const expected = String(process.env.STRIPE_EXPECTED_MODE || '').trim().toLowerCase();
  if (!['test', 'live'].includes(expected)) {
    throw new Error('STRIPE_EXPECTED_MODE must be explicitly set to "test" or "live"');
  }
  return expected;
}

export function isTestMode() {
  const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
  const keyIsTest = /^(sk|rk)_test_/.test(key);
  const keyIsLive = /^(sk|rk)_live_/.test(key);
  if (!keyIsTest && !keyIsLive) throw new Error('STRIPE_SECRET_KEY is missing or invalid');
  const expected = expectedStripeMode();
  if ((expected === 'test') !== keyIsTest) {
    throw new Error(`Stripe key mode does not match STRIPE_EXPECTED_MODE=${expected}`);
  }
  return keyIsTest;
}
export function subscriptionPrices() { return isTestMode() ? TEST_SUBSCRIPTION_PRICES : LIVE_SUBSCRIPTION_PRICES; }
export function packPrices() { return isTestMode() ? TEST_PACK_PRICES : LIVE_PACK_PRICES; }

export const VALID_TIERS = new Set(['student', 'scholar', 'unlimited']);
export const VALID_PACKS = new Set(Object.keys(LIVE_PACK_PRICES));
export const VALID_PERIODS = new Set(['monthly', 'semester']);

export function packCredits(pack) { return packPrices()[pack]?.credits || 0; }

/**
 * Resolve the entitlement from the server-owned Stripe price catalogue.
 * Metadata is useful for diagnostics, but it is never authoritative for paid
 * credits or tiers because Stripe objects can be edited outside this app.
 */
export function entitlementForPriceId(priceId) {
  if (!priceId) return null;
  const subscriptions = subscriptionPrices();
  for (const [tier, periods] of Object.entries(subscriptions)) {
    for (const [period, id] of Object.entries(periods)) {
      if (id === priceId) return { kind: 'subscription', tier, period, priceId };
    }
  }
  for (const [pack, details] of Object.entries(packPrices())) {
    if (details.priceId === priceId) {
      return { kind: 'pack', pack, credits: details.credits, priceId };
    }
  }
  return null;
}

function lineItemPriceId(item) {
  return typeof item?.price === 'string' ? item.price : item?.price?.id;
}

/** Validate a paid Checkout Session and derive its Cedar entitlement. */
export function checkoutEntitlement(session) {
  const items = session?.line_items?.data;
  if (!Array.isArray(items) || items.length !== 1 || Number(items[0]?.quantity || 0) !== 1) {
    throw new Error('Cedar checkout must contain exactly one priced item');
  }
  const entitlement = entitlementForPriceId(lineItemPriceId(items[0]));
  if (!entitlement) throw new Error('Checkout uses an unknown Cedar price');
  const expectedCheckoutMode = entitlement.kind === 'pack' ? 'payment' : 'subscription';
  if (session.mode !== expectedCheckoutMode) throw new Error('Checkout mode does not match its Cedar price');

  const metadata = session.metadata || {};
  if (entitlement.kind === 'subscription') {
    const metadataTier = metadata.cedar_tier || metadata.tier;
    const metadataPeriod = metadata.cedar_period || metadata.period;
    if (metadataTier && metadataTier !== entitlement.tier) throw new Error('Checkout tier metadata does not match its price');
    if (metadataPeriod && metadataPeriod !== entitlement.period) throw new Error('Checkout period metadata does not match its price');
  } else {
    if (metadata.cedar_pack && metadata.cedar_pack !== entitlement.pack) throw new Error('Checkout pack metadata does not match its price');
    if (metadata.cedar_credits && Number(metadata.cedar_credits) !== entitlement.credits) {
      throw new Error('Checkout credit metadata does not match its price');
    }
  }
  return entitlement;
}

/** Derive a subscription tier from its one authoritative Stripe Price. */
export function subscriptionEntitlement(subscription) {
  const items = subscription?.items?.data;
  if (!Array.isArray(items) || items.length !== 1 || Number(items[0]?.quantity || 0) !== 1) {
    throw new Error('Cedar subscription must contain exactly one priced item');
  }
  const entitlement = entitlementForPriceId(lineItemPriceId(items[0]));
  if (!entitlement || entitlement.kind !== 'subscription') {
    throw new Error('Subscription uses an unknown Cedar price');
  }
  const metadataTier = subscription?.metadata?.cedar_tier;
  const metadataPeriod = subscription?.metadata?.cedar_period;
  if (metadataTier && metadataTier !== entitlement.tier) throw new Error('Subscription tier metadata does not match its price');
  if (metadataPeriod && metadataPeriod !== entitlement.period) throw new Error('Subscription period metadata does not match its price');
  return entitlement;
}
