/**
 * Server-side authoritative map of tier/pack ids → Stripe price IDs.
 *
 * createCheckoutSession resolves entitlement from here — it NEVER trusts a
 * price or price ID sent by the client, since a caller can send anything. The
 * webhook instead reads `cedar_tier` / `cedar_period` / `cedar_pack` /
 * `cedar_credits` from the price's own metadata, so it stays correct even if a
 * price ID here is wrong.
 *
 * src/lib/tiers.js mirrors these IDs for display; if the two ever disagree,
 * this file (the server) is the authority.
 *
 * THESE ARE TEST-MODE PRICE IDS. Before going live: verify all ten prices
 * exist in live mode, then replace every ID here AND in src/lib/tiers.js.
 */

export const SUBSCRIPTION_PRICES: Record<string, { monthly: string; semester: string }> = {
  student:   { monthly: 'price_1U3VdPEJUVVmZYwUPVYkrzkf', semester: 'price_1U3VdQEJUVVmZYwUVxC0O3ZK' },
  scholar:   { monthly: 'price_1U3VdQEJUVVmZYwUd0aWOoc3', semester: 'price_1U3VdQEJUVVmZYwUiEeBVotN' },
  unlimited: { monthly: 'price_1U3VdQEJUVVmZYwUCLTKXxPn', semester: 'price_1U3VdREJUVVmZYwUQlYOoFre' },
};

export const PACK_PRICES: Record<string, { priceId: string; credits: number }> = {
  topup:    { priceId: 'price_1U3VdREJUVVmZYwUmnWd2dSB', credits: 100 },
  standard: { priceId: 'price_1U3VdREJUVVmZYwUj5ScyF6G', credits: 250 },
  bulk:     { priceId: 'price_1U3VdREJUVVmZYwUW42DAigi', credits: 600 },
  semester: { priceId: 'price_1U3VdSEJUVVmZYwUL4cnt0Eo', credits: 1500 },
};

export const VALID_TIERS = new Set(['student', 'scholar', 'unlimited']);
export const VALID_PACKS = new Set(Object.keys(PACK_PRICES));
export const VALID_PERIODS = new Set(['monthly', 'semester']);