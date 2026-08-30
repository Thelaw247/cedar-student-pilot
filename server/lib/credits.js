import { pool } from './db.js';
import { recordCreditsSpent } from './creditSignal.js';

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
// Transcript cleanup runs entirely on the cheap chain and rewrites the whole
// transcript, so output tokens ~= input tokens. When gemini-2.5-flash-lite was
// retired on 29 Aug 2026 its replacement came in at 5.5x the rate, and at 3
// credits per 30 min a cleanup credit cost more than a recorded minute does —
// inverting the ordering the credit system is built on, and dropping the
// Scholar semester ceiling margin to 20%. 4 puts every credit back under the
// lecture rate. Repriced 30 Aug 2026, before the first paying subscriber.
export const COST_PER_30MIN_CLEAN = 4;

// exam_prediction and lecture_review both run on the QUALITY model. Priced at
// 1 and 2 credits they cost $0.0066 and $0.0093 per credit — above what a
// recorded minute costs. At 2 and 3 every credit in Praelecta costs at most the
// lecture rate. Repriced 30 Aug 2026, before the first paying subscriber.
export const FEATURE_COSTS = {
  handbook: 5,
  study_material: 1,
  exam_prediction: 2,
  study_schedule: 1,
  lecture_review: 3,
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
      // Tell the client something was charged, so the credit meter refreshes
      // in the same beat instead of going stale until the next reload.
      recordCreditsSpent(amount);
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
/**
 * Features the Free tier's display copy excludes (tiers.js free.excludes:
 * class handbooks, exam prediction, AI study schedules). Enforcement must
 * match the promise — a free account with starter credits left could
 * otherwise buy through a gate the pricing page says is closed.
 */
/**
 * Feature -> minimum tier (MON-04 rework, Aug 2026). The hook — recording,
 * transcription, summaries, flashcards, timetable import — is never gated.
 * Student buys the everyday study tools; Scholar unlocks everything;
 * Unlimited is Scholar with volume. Mirrored for display in
 * src/lib/tiers.js FEATURES; THIS copy enforces.
 */
const TIER_RANK = { free: 0, student: 1, scholar: 2, unlimited: 3 };
export const FEATURE_MIN_TIER = {
  lecture_review: 'student',
  study_material: 'student',
  session_review: 'student',
  missed_summary: 'student',
  smart_rebook: 'student',
  project_roadmap: 'student',
  clean_transcript: 'student',
  handbook: 'scholar',
  exam_prediction: 'scholar',
  study_schedule: 'scholar',
};

export function tierAllows(tier, feature) {
  const min = FEATURE_MIN_TIER[feature];
  if (!min) return true;
  return (TIER_RANK[tier] ?? 0) >= TIER_RANK[min];
}

const TIER_GATE_MESSAGE = {
  student: 'This ships with the Student plan and up. Your credits still cover recording and reviewing lectures.',
  scholar: 'This ships with Scholar — the everything-unlocked plan. Recording, summaries and flashcards keep working on your current plan.',
};

export async function gateFeature(userId, feature, res, extra = {}) {
  const cost = FEATURE_COSTS[feature] ?? 0;
  const balance = await getBalance(userId);

  const userTier = balance.tier || 'free';
  if (!tierAllows(userTier, feature)) {
    const requiredTier = FEATURE_MIN_TIER[feature];
    await logUsage({ user_id: userId, feature, tier_at_time: userTier, success: false, ...extra });
    res.status(402).json({
      error: 'upgrade_required',
      feature,
      tier: userTier,
      required_tier: requiredTier,
      options: ['upgrade'],
      message: TIER_GATE_MESSAGE[requiredTier] || TIER_GATE_MESSAGE.student,
    });
    return { ok: false };
  }

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
  // USD per million tokens, per Google's published API pricing. Keep this
  // exhaustive for every model in the chains in lib/llm.js — an unpriced
  // model does not fail, it falls back to the most expensive rate, which
  // over-reports rather than quietly flattering the margin.
  geminiUsdPerMillion: {
    'gemini-2.5-flash-lite': { input: 0.10, output: 0.40 },
    'gemini-2.5-flash': { input: 0.30, output: 2.50 },
    'gemini-3.5-flash-lite': { input: 0.30, output: 2.50 },
    'gemini-3.5-flash': { input: 1.50, output: 9.00 },
  },
};

export const groqCostCad = (audioSeconds) => (audioSeconds / 3600) * RATES.groqUsdPerAudioHour * RATES.usdToCad;
export const base44CostCad = (credits) => credits * RATES.cadPerBase44Credit;
/**
 * What one Gemini call actually cost us, in CAD.
 *
 * This used to decide the rate with `model.includes('flash-lite')`, which was
 * true while there was exactly one flash-lite. gemini-3.5-flash-lite costs
 * $0.30/$2.50 — three times the input and six times the output of the 2.5
 * flash-lite it replaces — so that substring match would have priced the new
 * model at the old model's rate and under-reported every call by 3-6x. Cost
 * data feeds the credit pricing, so silently cheap numbers are worse than
 * loud expensive ones: an unknown model is charged at the dearest rate we
 * know and logged, rather than guessed downward.
 */
export function geminiCostCad(model, inputTokens, outputTokens) {
  const table = RATES.geminiUsdPerMillion;
  let rate = table[model];
  if (!rate) {
    const dearest = Object.entries(table).sort((a, b) => b[1].output - a[1].output)[0];
    console.warn(`[credits] no published rate for Gemini model "${model}" — costing it at ${dearest[0]} rates. Add it to RATES.geminiUsdPerMillion.`);
    rate = dearest[1];
  }
  const usd = (Math.max(0, inputTokens) / 1_000_000) * rate.input + (Math.max(0, outputTokens) / 1_000_000) * rate.output;
  return usd * RATES.usdToCad;
}
