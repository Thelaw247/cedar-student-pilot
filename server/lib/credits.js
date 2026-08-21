import { pool } from './db.js';

// Direct port of base44/shared/credits.ts. Business rules, cost table, and
// gate/settle contract are unchanged — only the storage layer differs
// (Postgres via pg, not Base44 entities via asServiceRole).
//
// TWO RULES THAT MUST NOT BE BROKEN (same as the original):
//   1. Check BEFORE doing the work; charge only AFTER it succeeds.
//   2. Balances are written ONLY from this server, using the DATABASE_URL
//      connection — credit_balances has no INSERT/UPDATE policy for
//      anon/authenticated in Postgres RLS, mirroring Base44's
//      create:false/update:false exactly. A route that let a client write
//      their own balance would have an infinite plan.

export const COST_PER_30MIN_PROCESS = 5;
export const COST_PER_30MIN_CLEAN = 3;

export const FEATURE_COSTS = {
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

export function durationCost(seconds, per30) {
  const mins = Math.max(1, Math.round((seconds || 0) / 60));
  return Math.max(per30, Math.ceil(mins / 30) * per30);
}

export const TIER_GRANT = {
  free: 20, // 2 lectures, LIFETIME — not refreshed monthly. ALSO hardcoded in
            // the Supabase auth_auto_provisioning migration trigger (SQL can't
            // import this constant) — keep both in sync if this ever changes.
  student: 200,
  scholar: 450,
  unlimited: 1000,
};

export const FAIR_USE_CEILING = {
  free: 0,
  student: 400,
  scholar: 900,
  unlimited: 1500,
};

export const periodKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/**
 * Load the caller's balance, creating a free-tier row on first use.
 * NOTE: with the auth_auto_provisioning trigger in place, a real signed-up
 * user already has a free-tier row from the moment they exist — this
 * fallback only matters for a balance that's missing for some other reason.
 */
export async function getBalance(userId) {
  const { rows } = await pool.query('select * from credit_balances where user_id = $1', [userId]);
  if (rows.length > 0) return rows[0];

  const inserted = await pool.query(
    `insert into credit_balances (user_id, tier, subscription_credits, purchased_credits, lifetime_granted, period_key, last_grant_date)
     values ($1, 'free', $2, 0, $2, $3, current_date)
     returning *`,
    [userId, TIER_GRANT.free, periodKey()],
  );
  return inserted.rows[0];
}

export const availableCredits = (b) => Number(b?.subscription_credits || 0) + Number(b?.purchased_credits || 0);

/** The 402 body — machine-readable so the UI can render the right upsell. */
export function insufficientResponse(res, feature, required, balance) {
  return res.status(402).json({
    error: 'insufficient_credits',
    feature,
    required,
    balance: availableCredits(balance),
    tier: balance?.tier || 'free',
    options: ['buy_credits', 'upgrade'],
    message: `You need ${required} credits for this and have ${availableCredits(balance)}.`,
  });
}

/**
 * Deduct credits with an optimistic compare-and-swap, retried up to 6 times
 * against a fresh read on contention. Ported as CAS here (not a
 * transaction+row-lock like stripeWebhook's fulfillment) deliberately: this
 * runs on the hot path of every credit-gated request, where holding a row
 * lock for the duration of an LLM call upstream would serialize unrelated
 * users' requests against each other. Stripe fulfillment is rare and
 * tolerates a lock briefly; spending credits is frequent and must not.
 */
export async function spendCredits(balance, amount, operationId = crypto.randomUUID()) {
  if (amount <= 0) return { ...balance, _operationAppliedNow: false };

  let current = balance;
  for (let attempt = 0; attempt < 6; attempt++) {
    const applied = current.applied_credit_operations || [];
    if (applied.includes(operationId)) return { ...current, _operationAppliedNow: false };

    if (availableCredits(current) < amount) {
      const error = new Error('Credit balance changed before this action could be settled');
      error.status = 409;
      error.code = 'credit_contention';
      throw error;
    }

    const subscription = Number(current.subscription_credits || 0);
    const purchased = Number(current.purchased_credits || 0);
    const fromSub = Math.min(subscription, amount);
    const fromPurchased = amount - fromSub;
    const nextApplied = [...applied, operationId].slice(-250);

    const result = await pool.query(
      `update credit_balances set
         subscription_credits = subscription_credits - $1,
         purchased_credits = purchased_credits - $2,
         applied_credit_operations = $3,
         updated_at = now()
       where id = $4 and subscription_credits = $5 and purchased_credits = $6
         and applied_credit_operations = $7`,
      [fromSub, fromPurchased, nextApplied, current.id, subscription, purchased, applied],
    );

    if (result.rowCount === 1) {
      return {
        ...current,
        subscription_credits: subscription - fromSub,
        purchased_credits: purchased - fromPurchased,
        applied_credit_operations: nextApplied,
        _operationAppliedNow: true,
      };
    }
    const refreshed = await pool.query('select * from credit_balances where id = $1', [current.id]);
    current = refreshed.rows[0];
  }

  const error = new Error('Credit balance is busy. Please retry this action.');
  error.status = 409;
  error.code = 'credit_contention';
  throw error;
}

/**
 * Record what an action actually consumed. Never throws — a failure to log
 * must not fail the user's request.
 */
export async function logUsage(event) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await pool.query(
        `insert into usage_events (occurred_at, success, user_id, feature, provider, model, call_count,
           base44_credits, input_tokens, output_tokens, cedar_credits_charged, credit_operation_id,
           cost_cad, tier_at_time, latency_ms, lecture_id, audio_seconds)
         values (now(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [event.success ?? true, event.user_id, event.feature, event.provider || null, event.model || null,
         event.call_count || 0, event.base44_credits || 0, event.input_tokens || 0, event.output_tokens || 0,
         event.cedar_credits_charged || 0, event.credit_operation_id || null, event.cost_cad || 0,
         event.tier_at_time || 'free', event.latency_ms || 0, event.lecture_id || null, event.audio_seconds || 0],
      );
      return true;
    } catch (e) {
      if (attempt === 2) console.error('[usage] log failed after retries (non-fatal):', e.message);
    }
  }
  return false;
}

/**
 * The check-before-work half of the credit contract. Call immediately
 * BEFORE the expensive work; if !gate.ok, send gate.response and stop.
 */
export async function gateFeature(userId, feature, res, extra = {}) {
  const cost = FEATURE_COSTS[feature] ?? 0;
  const balance = await getBalance(userId);

  if (cost > 0 && availableCredits(balance) < cost) {
    await logUsage({ user_id: userId, feature, tier_at_time: balance.tier, success: false, ...extra });
    insufficientResponse(res, feature, cost, balance);
    return { ok: false };
  }
  return { ok: true, balance, cost, startedAt: Date.now(), operationId: crypto.randomUUID() };
}

/** The charge-after-success half. Call only AFTER the result is safely persisted. */
export async function settleFeature(gate, opts) {
  if (!gate?.ok || !gate.balance) return;

  const usage = opts.llmUsage || null;
  const fallbackCalls = opts.calls ?? 1;
  const geminiCalls = usage ? Number(usage.geminiCalls || 0) : (opts.usedGemini ? fallbackCalls : 0);
  const base44Calls = usage ? Number(usage.base44Calls || 0) : (opts.usedGemini ? 0 : fallbackCalls);
  const calls = usage ? geminiCalls + base44Calls : fallbackCalls;
  const base44Credits = base44Calls * 3;
  const geminiCost = Number(usage?.costCad || 0);
  const provider = geminiCalls > 0 && base44Calls > 0 ? 'mixed' : geminiCalls > 0 ? 'gemini' : 'base44';
  const models = usage?.models && typeof usage.models === 'object' ? Object.keys(usage.models) : [];
  const operationId = gate.operationId || crypto.randomUUID();

  let settledBalance = gate.balance;
  if ((gate.cost || 0) > 0) {
    settledBalance = await spendCredits(gate.balance, gate.cost, operationId);
  }

  try {
    const tier = settledBalance.tier || 'free';
    const ceiling = FAIR_USE_CEILING[tier] ?? 0;
    if (ceiling > 0 && !settledBalance.fair_use_flagged) {
      const granted = TIER_GRANT[tier] ?? 0;
      const usedThisPeriod = granted - Number(settledBalance.subscription_credits || 0);
      if (usedThisPeriod >= ceiling) {
        await pool.query('update credit_balances set fair_use_flagged = true where id = $1', [settledBalance.id]);
      }
    }
  } catch (e) {
    console.error('[credits] fair-use check failed', e.message);
  }

  await logUsage({
    user_id: gate.balance.user_id,
    feature: opts.feature,
    provider,
    model: models.join(', ') || (provider === 'gemini' ? 'gemini' : 'automatic'),
    call_count: calls,
    base44_credits: base44Credits,
    input_tokens: Number(usage?.inputTokens || 0),
    output_tokens: Number(usage?.outputTokens || 0),
    cedar_credits_charged: gate.cost || 0,
    credit_operation_id: operationId,
    cost_cad: base44CostCad(base44Credits) + geminiCost,
    tier_at_time: gate.balance.tier,
    latency_ms: gate.startedAt ? Date.now() - gate.startedAt : 0,
    ...(opts.extra || {}),
  });
}

export const RATES = {
  cadPerBase44Credit: 120 / 20000,
  groqUsdPerAudioHour: 0.04,
  usdToCad: 1.37,
  geminiUsdPerMillion: {
    'gemini-2.5-flash-lite': { input: 0.10, output: 0.40 },
    'gemini-2.5-flash': { input: 0.30, output: 2.50 },
  },
};

export const groqCostCad = (audioSeconds) => (audioSeconds / 3600) * RATES.groqUsdPerAudioHour * RATES.usdToCad;
export const base44CostCad = (credits) => credits * RATES.cadPerBase44Credit;
export function geminiCostCad(model, inputTokens, outputTokens) {
  const key = model.includes('flash-lite') ? 'gemini-2.5-flash-lite' : 'gemini-2.5-flash';
  const rate = RATES.geminiUsdPerMillion[key];
  const usd = (Math.max(0, inputTokens) / 1_000_000) * rate.input + (Math.max(0, outputTokens) / 1_000_000) * rate.output;
  return usd * RATES.usdToCad;
}
