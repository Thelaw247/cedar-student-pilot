/**
 * Per-user credit gating and usage tracking.
 *
 * WHY THIS EXISTS
 * Provider budget caps (Groq, Gemini) protect the bank account but fail the
 * same way an exhausted Base44 credit pool does: when the cap trips, the app
 * breaks for EVERY user, and one abusive account can trip it. A per-user gate
 * is what makes a spend cap a backstop instead of a single point of failure.
 *
 * TWO RULES THAT MUST NOT BE BROKEN
 *   1. Check BEFORE doing the work; charge only AFTER it succeeds. A failed
 *      transcription that still bills is the fastest way to lose a user.
 *   2. Balances are written with asServiceRole ONLY. CreditBalance RLS denies
 *      all client writes — a user who can update their own balance has an
 *      infinite plan. UI gating alone is worthless: every function is a public
 *      endpoint at /functions/<name>, invokable from the browser console.
 */

// ---------------------------------------------------------------- pricing ---

/** Cedar credits per 30 minutes of recorded audio. */
export const COST_PER_30MIN_PROCESS = 5;
export const COST_PER_30MIN_CLEAN = 3;

/** Flat costs for the non-lecture features. */
export const FEATURE_COSTS: Record<string, number> = {
  handbook: 5,
  study_material: 1,
  exam_prediction: 1,
  study_schedule: 1,
  lecture_review: 2,
  missed_summary: 2,
  project_roadmap: 2,
  smart_rebook: 1,
  session_review: 1,
  timetable_import: 0, // onboarding — never gate the first thing a user does
};

/** Duration-scaled cost so a 170-minute lab is not priced like a 30-minute one. */
export function durationCost(seconds: number, per30: number): number {
  const mins = Math.max(1, Math.round((seconds || 0) / 60));
  return Math.max(per30, Math.ceil(mins / 30) * per30);
}

/** Starting allowance by tier, in Cedar credits per month. */
export const TIER_GRANT: Record<string, number> = {
  free: 20, // 2 lectures, LIFETIME — not refreshed monthly
  student: 60,
  scholar: 150,
  unlimited: 400,
};

// ------------------------------------------------------------- balance io ---

export const periodKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/**
 * Load the caller's balance, creating a free-tier row on first use.
 * Always read/written as service role: the client must never write this.
 */
export async function getBalance(base44: any, userId: string) {
  const rows = await base44.asServiceRole.entities.CreditBalance.filter({ user_id: userId });
  if (rows && rows.length > 0) return rows[0];

  return await base44.asServiceRole.entities.CreditBalance.create({
    user_id: userId,
    tier: 'free',
    subscription_credits: TIER_GRANT.free,
    purchased_credits: 0,
    lifetime_granted: TIER_GRANT.free,
    period_key: periodKey(),
    last_grant_date: new Date().toISOString().split('T')[0],
  });
}

export const availableCredits = (b: any) =>
  (b?.subscription_credits || 0) + (b?.purchased_credits || 0);

/**
 * The 402 body. Machine-readable so the UI can render the right upsell
 * instead of a generic error.
 */
export function insufficientResponse(feature: string, required: number, balance: any) {
  return Response.json(
    {
      error: 'insufficient_credits',
      feature,
      required,
      balance: availableCredits(balance),
      tier: balance?.tier || 'free',
      options: ['buy_credits', 'upgrade'],
      message: `You need ${required} credits for this and have ${availableCredits(balance)}.`,
    },
    { status: 402 },
  );
}

/**
 * Deduct credits, subscription allowance first so a purchased pack is never
 * burned while a monthly grant sits unused. Service role only.
 */
export async function spendCredits(base44: any, balance: any, amount: number) {
  if (amount <= 0) return balance;
  const fromSub = Math.min(balance.subscription_credits || 0, amount);
  const fromPurchased = amount - fromSub;
  return await base44.asServiceRole.entities.CreditBalance.update(balance.id, {
    subscription_credits: (balance.subscription_credits || 0) - fromSub,
    purchased_credits: (balance.purchased_credits || 0) - fromPurchased,
  });
}

// ------------------------------------------------------------- usage log ----

/**
 * Record what an action actually consumed. Never throws — a failure to log
 * must not fail the user's request, and database writes cost 0 credits so
 * there is no reason not to call this on every path, success or failure.
 */
export async function logUsage(base44: any, event: Record<string, any>) {
  try {
    await base44.asServiceRole.entities.UsageEvent.create({
      occurred_at: new Date().toISOString(),
      success: true,
      ...event,
    });
  } catch (e) {
    console.error('[usage] log failed (non-fatal):', (e as Error).message);
  }
}

/** Cost estimates, kept here so the rate card lives in one place. */
export const RATES = {
  cadPerBase44Credit: 120 / 20000,
  groqUsdPerAudioHour: 0.04,
  usdToCad: 1.37,
};

export const groqCostCad = (audioSeconds: number) =>
  (audioSeconds / 3600) * RATES.groqUsdPerAudioHour * RATES.usdToCad;

export const base44CostCad = (credits: number) => credits * RATES.cadPerBase44Credit;