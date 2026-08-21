// Direct port of base44/shared/credits.ts — ONLY the subset stripeWebhook
// needs (TIER_GRANT, periodKey, getBalance-via-transaction). The rest of
// credits.ts (spendCredits, gateFeature, settleFeature, RATES, FEATURE_COSTS)
// belongs to the other 27 ported functions, not this one — porting it now
// would be scope creep with nothing yet to call it.

/** Starting allowance by tier, in Cedar credits per month. Values must stay
 *  identical to base44/shared/credits.ts — this is billing-critical. */
export const TIER_GRANT = {
  free: 20, // 2 lectures, LIFETIME — not refreshed monthly
  student: 200,
  scholar: 450,
  unlimited: 1000,
};

export const periodKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
