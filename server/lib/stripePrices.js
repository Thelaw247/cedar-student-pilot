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

export function isTestMode() {
  return /^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY || '');
}
export function subscriptionPrices() { return isTestMode() ? TEST_SUBSCRIPTION_PRICES : LIVE_SUBSCRIPTION_PRICES; }
export function packPrices() { return isTestMode() ? TEST_PACK_PRICES : LIVE_PACK_PRICES; }

export const VALID_TIERS = new Set(['student', 'scholar', 'unlimited']);
export const VALID_PACKS = new Set(Object.keys(LIVE_PACK_PRICES));
export const VALID_PERIODS = new Set(['monthly', 'semester']);

export function packCredits(pack) { return packPrices()[pack]?.credits || 0; }
