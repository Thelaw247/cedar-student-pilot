/**
 * Server-side authoritative map of tier/pack ids -> Stripe price IDs.
 *
 * createCheckoutSession resolves entitlement from here — it NEVER trusts a
 * price or price ID sent by the client, since a caller can send anything. The
 * webhook instead reads `cedar_tier` / `cedar_period` / `cedar_pack` /
 * `cedar_credits` from the price's own metadata, so it stays correct even if a
 * price ID here is wrong.
 *
 * MODE-AWARE BY DESIGN. Test and live price IDs are different objects in
 * Stripe, and shipping test IDs to production is a silent, total checkout
 * failure ("No such price"). Rather than relying on a human to swap ten
 * strings at go-live, the correct map is chosen at runtime from the API key
 * prefix: an `sk_test_...` key selects TEST_*, anything else selects LIVE_*.
 *
 * Consequence: there is no "remember to swap the IDs" step any more. Whichever
 * key Base44 has configured determines the catalogue automatically.
 *
 * Both catalogues live in Stripe account acct_1ToUnnRecX8K7mfK (Cedar Pilot),
 * all prices CAD, all carrying cedar_* metadata that the webhook reads.
 *
 * PRICING MODEL (Option C). Subscriptions must ALWAYS be cheaper per credit
 * than packs, or a rational user never subscribes and recurring revenue dies.
 * The previous catalogue had this inverted: the 1500-credit pack worked out at
 * $0.033/credit against $0.063-0.125 for every subscription tier, so packs
 * strictly dominated. Current per-credit rates:
 *
 *   Student   $9.99/mo   200 cr   $0.050      Small  100 cr  $6.99   $0.070
 *   Scholar   $16.99/mo  450 cr   $0.038      Medium 250 cr  $14.99  $0.060
 *   Unlimited $29.99/mo  1000 cr  $0.030      Large  500 cr  $27.99  $0.056
 *
 * Cheapest pack ($0.056) is dearer than the priciest subscription ($0.050),
 * so the ordering holds everywhere, semester included. If you ever change an
 * amount here, re-check that invariant before shipping.
 */
import { secrets } from 'base44:runtime';

type SubMap = Record<string, { monthly: string; semester: string }>;
type PackMap = Record<string, { priceId: string; credits: number }>;

// ------------------------------------------------------------------ live ----
// Products: Cedar Student / Cedar Scholar / Cedar Unlimited / Cedar Credits
const LIVE_SUBSCRIPTION_PRICES: SubMap = {
  student:   { monthly: 'price_1U4ZFbRecX8K7mfKozUiB8wl', semester: 'price_1U5YKeRecX8K7mfKx4tqSr5I' },
  scholar:   { monthly: 'price_1U4ZFRRecX8K7mfK28s9gC59', semester: 'price_1U4ZFRRecX8K7mfKHwa5C3We' },
  unlimited: { monthly: 'price_1U4ZFNRecX8K7mfKAbJhIiKA', semester: 'price_1U5YKiRecX8K7mfKGdP4kMkK' },
};

const LIVE_PACK_PRICES: PackMap = {
  small:  { priceId: 'price_1U5YKmRecX8K7mfKs8jgOUcs', credits: 100 },
  medium: { priceId: 'price_1U5YKqRecX8K7mfKnqPJGaMT', credits: 250 },
  large:  { priceId: 'price_1U5YKuRecX8K7mfKaGgeHZZQ', credits: 500 },
};

// ------------------------------------------------------------------ test ----
const TEST_SUBSCRIPTION_PRICES: SubMap = {
  student:   { monthly: 'price_1U4ZcQRecX8K7mfKFbmPPwsw', semester: 'price_1U5YKzRecX8K7mfKt7dExkuL' },
  scholar:   { monthly: 'price_1U4ZcURecX8K7mfK8r1bhRCu', semester: 'price_1U4ZcWRecX8K7mfKmkqyxMe1' },
  unlimited: { monthly: 'price_1U4ZcZRecX8K7mfKvfXZi2wv', semester: 'price_1U5YL3RecX8K7mfKoyLtrFOO' },
};

const TEST_PACK_PRICES: PackMap = {
  small:  { priceId: 'price_1U5YL7RecX8K7mfKwOSZD2Hi', credits: 100 },
  medium: { priceId: 'price_1U5YLBRecX8K7mfKwbPeqITO', credits: 250 },
  large:  { priceId: 'price_1U5YLFRecX8K7mfKrO7nA7xu', credits: 500 },
};

// -------------------------------------------------------------- selection ---

/** True when the configured Stripe key is a test key. Read lazily inside a
 *  handler — secrets.get() at module top level returns undefined. */
export function isTestMode(): boolean {
  try {
    return (secrets.get('STRIPE_SECRET_KEY') || '').startsWith('sk_test_');
  } catch {
    return false; // fail to live rather than silently selling against test prices
  }
}

export function subscriptionPrices(): SubMap {
  return isTestMode() ? TEST_SUBSCRIPTION_PRICES : LIVE_SUBSCRIPTION_PRICES;
}

export function packPrices(): PackMap {
  return isTestMode() ? TEST_PACK_PRICES : LIVE_PACK_PRICES;
}

/**
 * Back-compat Proxies so existing call sites keep working unchanged:
 *   SUBSCRIPTION_PRICES[tier].monthly
 *   PACK_PRICES[pack].credits
 * Each property access re-resolves the mode, so these are safe to reference
 * at module scope — the secret is only read when a key is actually accessed.
 */
export const SUBSCRIPTION_PRICES: SubMap = new Proxy({} as SubMap, {
  get: (_t, prop: string) => subscriptionPrices()[prop],
  has: (_t, prop: string) => prop in subscriptionPrices(),
  ownKeys: () => Reflect.ownKeys(LIVE_SUBSCRIPTION_PRICES),
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
});

export const PACK_PRICES: PackMap = new Proxy({} as PackMap, {
  get: (_t, prop: string) => packPrices()[prop],
  has: (_t, prop: string) => prop in packPrices(),
  ownKeys: () => Reflect.ownKeys(LIVE_PACK_PRICES),
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
});

// Validation sets are mode-independent — the ids are the same in both.
export const VALID_TIERS = new Set(['student', 'scholar', 'unlimited']);
export const VALID_PACKS = new Set(Object.keys(LIVE_PACK_PRICES));
export const VALID_PERIODS = new Set(['monthly', 'semester']);

/** Credits for a pack id, resolved server-side. Never trust a client value. */
export function packCredits(pack: string): number {
  return packPrices()[pack]?.credits || 0;
}
