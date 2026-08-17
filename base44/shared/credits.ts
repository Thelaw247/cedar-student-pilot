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

/** Starting allowance by tier, in Cedar credits per month.
 *
 *  Sized against real usage, not round numbers: a 1-hour lecture costs 10
 *  credits to process and 16 if the transcript is also cleaned. A student
 *  taking 5 courses at 3 lecture-hours a week records ~60 hours a month, so
 *  the old 60-credit Student grant bought under 4 hours of fully-processed
 *  lecture — less than one course. That scarcity is what made credit packs
 *  the only usable route and inverted the pricing.
 *
 *  Per-credit rates these produce (see stripePrices.ts for the pack side):
 *    student $0.050  scholar $0.038  unlimited $0.030 */
export const TIER_GRANT: Record<string, number> = {
  free: 20, // 2 lectures, LIFETIME — not refreshed monthly
  student: 200,
  scholar: 450,
  unlimited: 1000,
};

/** Soft fair-use ceiling, in credits consumed within a single period.
 *
 *  Unlimited is the margin risk: at 1000 credits and worst-case routing it is
 *  a ~60% margin, and a user recording everything could push past that. This
 *  does NOT block anyone — settleFeature raises fair_use_flagged on the
 *  balance so heavy accounts surface on the owner dashboard for a human
 *  decision. Never auto-cut a paying customer off on an estimate. */
export const FAIR_USE_CEILING: Record<string, number> = {
  free: 0,
  student: 400,
  scholar: 900,
  unlimited: 1500,
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

// ------------------------------------------------- gate / settle helper ----

/**
 * The check-before-work half of the credit contract.
 *
 * Ten features previously called an LLM with no gate, no charge and no usage
 * log at all: every plan's paid features were free and unlimited, and
 * UsageEvent captured only 2 of 13 features, so cost-per-user was unknowable.
 * Rather than paste the same twenty lines into each one, both halves live
 * here — one place to change when the rate card moves.
 *
 * Call gateFeature() immediately BEFORE the expensive work and return
 * gate.response if !gate.ok. Call settleFeature() only AFTER the result is
 * safely persisted. A failed generation must never bill.
 *
 * Cost 0 features (timetable_import) pass the gate automatically but still
 * log, so onboarding is never blocked yet its real cost stays visible.
 */
export async function gateFeature(
  base44: any,
  userId: string,
  feature: string,
  extra: Record<string, any> = {},
): Promise<{ ok: boolean; response?: Response; balance?: any; cost?: number; startedAt?: number }> {
  const cost = FEATURE_COSTS[feature] ?? 0;
  const balance = await getBalance(base44, userId);

  if (cost > 0 && availableCredits(balance) < cost) {
    await logUsage(base44, {
      user_id: userId, feature, tier_at_time: balance.tier, success: false, ...extra,
    });
    return { ok: false, response: insufficientResponse(feature, cost, balance) };
  }
  return { ok: true, balance, cost, startedAt: Date.now() };
}

/**
 * The charge-after-success half. Deducts the credits and writes the ledger row
 * that the margin dashboard reads. Never throws — a logging failure must not
 * fail a request the user already paid for.
 *
 * `calls` is the number of LLM round trips made, which is what Base44 bills on
 * when GEMINI_API_KEY is absent. With the key set, those calls cost 0 Base44
 * credits and the real spend sits with Google instead.
 */
export async function settleFeature(
  base44: any,
  gate: { ok: boolean; balance?: any; cost?: number; startedAt?: number },
  opts: { feature: string; calls?: number; usedGemini?: boolean; extra?: Record<string, any> },
) {
  if (!gate?.ok || !gate.balance) return;
  const calls = opts.calls ?? 1;
  const gemini = !!opts.usedGemini;
  const base44Credits = gemini ? 0 : calls * 3;

  try {
    if ((gate.cost || 0) > 0) await spendCredits(base44, gate.balance, gate.cost as number);
  } catch (e) {
    console.error('[credits] spend failed', (e as Error).message);
  }

  // Soft fair-use check. Consumption this period is what the tier granted
  // minus what is left on the subscription bucket; purchased credits are
  // excluded because the user paid separately for those and they are already
  // margin-positive. Flag only, never block — see FAIR_USE_CEILING.
  try {
    const tier = gate.balance.tier || 'free';
    const ceiling = FAIR_USE_CEILING[tier] ?? 0;
    if (ceiling > 0 && !gate.balance.fair_use_flagged) {
      const granted = TIER_GRANT[tier] ?? 0;
      const usedThisPeriod = granted - (gate.balance.subscription_credits || 0) + (gate.cost || 0);
      if (usedThisPeriod >= ceiling) {
        await base44.asServiceRole.entities.CreditBalance.update(gate.balance.id, {
          fair_use_flagged: true,
        });
      }
    }
  } catch (e) {
    console.error('[credits] fair-use check failed', (e as Error).message);
  }

  await logUsage(base44, {
    user_id: gate.balance.user_id,
    feature: opts.feature,
    provider: gemini ? 'gemini' : 'base44',
    call_count: calls,
    base44_credits: base44Credits,
    cedar_credits_charged: gate.cost || 0,
    cost_cad: base44CostCad(base44Credits),
    tier_at_time: gate.balance.tier,
    latency_ms: gate.startedAt ? Date.now() - gate.startedAt : 0,
    ...(opts.extra || {}),
  });
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