/**
 * Server-side authoritative map of tier/pack ids -> Stripe price IDs.
 * Direct port of base44/shared/stripePrices.ts — same mode-aware selection
 * (test key prefix -> TEST_*, anything else -> LIVE_*), same invariant that
 * every subscription tier must be cheaper per credit than every pack.
 */

// LIVE catalogue, created 31 Aug 2026 and verified against the live account
// price by price: amount, currency (CAD), interval and metadata all match the
// test catalogue exactly. Semester prices are interval month x 4 — that is the
// field most easily got wrong, and getting it wrong charges a student four
// times a year at the semester rate.
//
// The IDs these replace pointed at prices that no longer exist in the live
// account at all, so live checkout would have thrown rather than mischarged.
const LIVE_SUBSCRIPTION_PRICES = {
  student:   { monthly: 'price_1UAJQzRecX8K7mfKfVIc5Qhl', semester: 'price_1UAJQzRecX8K7mfKCSlrCfKS' },
  scholar:   { monthly: 'price_1UAJQwRecX8K7mfKlqg6F97E', semester: 'price_1UAJQwRecX8K7mfKqRMvqsty' },
  unlimited: { monthly: 'price_1UAJQuRecX8K7mfKmXZAWdL8', semester: 'price_1UAJQuRecX8K7mfK7K025rd8' },
};
const LIVE_PACK_PRICES = {
  small:  { priceId: 'price_1UAJQpRecX8K7mfKTrOsuhRE', credits: 100 },
  medium: { priceId: 'price_1UAJQpRecX8K7mfK0Ysrg3Ci', credits: 250 },
  large:  { priceId: 'price_1UAJQpRecX8K7mfKFOWvNkG8', credits: 500 },
};
// Aug 2026 price cut ($7.99 / $12.99 / $24.99 monthly). Stripe Prices are
// immutable, so a price change means NEW price objects and the old ones
// archived — never an edit. Subscribers on an archived price keep billing at
// the rate they signed up for, which is exactly the grandfather rule.
const TEST_SUBSCRIPTION_PRICES = {
  student:   { monthly: 'price_1U9yENRecX8K7mfKHC8HJO1t', semester: 'price_1U9yEWRecX8K7mfKLcgHYyht' },
  scholar:   { monthly: 'price_1U9yEPRecX8K7mfKU3kZcNxA', semester: 'price_1U9yEYRecX8K7mfKFMbHQYs6' },
  unlimited: { monthly: 'price_1U9yERRecX8K7mfK98F5vKZf', semester: 'price_1U9yEaRecX8K7mfKg2x6BkzX' },
};
// Superseded 30 Aug 2026, archived in Stripe, kept so a webhook replaying an
// older subscription still resolves to the right tier instead of throwing.
const RETIRED_TEST_SUBSCRIPTION_PRICES = {
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
/** Prices no longer sold, but still billing existing subscribers. */
function retiredSubscriptionPrices() { return isTestMode() ? RETIRED_TEST_SUBSCRIPTION_PRICES : {}; }
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
  // Current catalogue first, then retired prices: a subscriber who bought
  // before a price change must keep resolving to their tier.
  for (const catalogue of [subscriptionPrices(), retiredSubscriptionPrices()]) {
    for (const [tier, periods] of Object.entries(catalogue)) {
      for (const [period, id] of Object.entries(periods)) {
        if (id === priceId) return { kind: 'subscription', tier, period, priceId };
      }
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

/** Validate a paid Checkout Session and derive its Praelecta entitlement. */
export function checkoutEntitlement(session) {
  const items = session?.line_items?.data;
  if (!Array.isArray(items) || items.length !== 1 || Number(items[0]?.quantity || 0) !== 1) {
    throw new Error('Praelecta checkout must contain exactly one priced item');
  }
  const entitlement = entitlementForPriceId(lineItemPriceId(items[0]));
  if (!entitlement) throw new Error('Checkout uses an unknown Praelecta price');
  const expectedCheckoutMode = entitlement.kind === 'pack' ? 'payment' : 'subscription';
  if (session.mode !== expectedCheckoutMode) throw new Error('Checkout mode does not match its Praelecta price');

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
    throw new Error('Praelecta subscription must contain exactly one priced item');
  }
  const entitlement = entitlementForPriceId(lineItemPriceId(items[0]));
  if (!entitlement || entitlement.kind !== 'subscription') {
    throw new Error('Subscription uses an unknown Praelecta price');
  }
  const metadataTier = subscription?.metadata?.cedar_tier;
  const metadataPeriod = subscription?.metadata?.cedar_period;
  if (metadataTier && metadataTier !== entitlement.tier) throw new Error('Subscription tier metadata does not match its price');
  if (metadataPeriod && metadataPeriod !== entitlement.period) throw new Error('Subscription period metadata does not match its price');
  return entitlement;
}
