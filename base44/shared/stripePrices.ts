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
 */
import { secrets } from 'base44:runtime';

type SubMap = Record<string, { monthly: string; semester: string }>;
type PackMap = Record<string, { priceId: string; credits: number }>;

// ------------------------------------------------------------------ live ----
// Products: Cedar Student / Cedar Scholar / Cedar Unlimited / Cedar Credits
const LIVE_SUBSCRIPTION_PRICES: SubMap = {
  student:   { monthly: 'price_1U4ZFbRecX8K7mfKozUiB8wl', semester: 'price_1U4ZFbRecX8K7mfK41xBdVt7' },
  scholar:   { monthly: 'price_1U4ZFRRecX8K7mfK28s9gC59', semester: 'price_1U4ZFRRecX8K7mfKHwa5C3We' },
  unlimited: { monthly: 'price_1U4ZFNRecX8K7mfKAbJhIiKA', semester: 'price_1U4ZFNRecX8K7mfKyeGfPoUx' },
};

const LIVE_PACK_PRICES: PackMap = {
  topup:    { priceId: 'price_1U4ZblRecX8K7mfKrucRUTco', credits: 100 },
  standard: { priceId: 'price_1U4ZbnRecX8K7mfK4Kl1neJO', credits: 250 },
  bulk:     { priceId: 'price_1U4ZbpRecX8K7mfKblEW4M6W', credits: 600 },
  semester: { priceId: 'price_1U4ZbrRecX8K7mfKhQGhVgUN', credits: 1500 },
};

// ------------------------------------------------------------------ test ----
const TEST_SUBSCRIPTION_PRICES: SubMap = {
  student:   { monthly: 'price_1U4ZcQRecX8K7mfKFbmPPwsw', semester: 'price_1U4ZcSRecX8K7mfKWZMQiloz' },
  scholar:   { monthly: 'price_1U4ZcURecX8K7mfK8r1bhRCu', semester: 'price_1U4ZcWRecX8K7mfKmkqyxMe1' },
  unlimited: { monthly: 'price_1U4ZcZRecX8K7mfKvfXZi2wv', semester: 'price_1U4ZcbRecX8K7mfKTzQZyEiS' },
};

const TEST_PACK_PRICES: PackMap = {
  topup:    { priceId: 'price_1U4ZcdRecX8K7mfK21rYrypG', credits: 100 },
  standard: { priceId: 'price_1U4ZcfRecX8K7mfKdjEH9xTC', credits: 250 },
  bulk:     { priceId: 'price_1U4ZciRecX8K7mfKaDI7DbJM', credits: 600 },
  semester: { priceId: 'price_1U4ZcjRecX8K7mfKLCeP7opH', credits: 1500 },
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
