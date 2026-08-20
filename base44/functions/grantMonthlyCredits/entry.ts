import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { secrets } from 'base44:runtime';
import { periodKey } from '../../shared/credits.ts';
import { grantScheduledMonthly } from '../../shared/stripe.ts';

/**
 * Daily sweep that tops up subscription credits for active subscribers whose
 * last grant was in a previous month.
 *
 * For each active (non-free, has a Stripe subscription) balance whose
 * period_key is not the current month:
 *   - expire the previous period's unused subscription_credits (set to the
 *     fresh allowance — purchased_credits are never touched),
 *   - set period_key and last_grant_date to today.
 *
 * Free tier is a LIFETIME grant of 20 credits and is intentionally never
 * refreshed here — free users have no stripe_subscription_id and are skipped.
 *
 * Security: this touches every user's balance, so it is gated on a shared
 * secret (GRANT_TRIGGER_TOKEN) compared against secrets.get() and fails closed
 * when the secret is not configured — identical to sendStudyReminders. The
 * scheduled automation passes the token via function_args.trigger_token.
 *
 * That token necessarily sits in plaintext in this function's committed
 * function.jsonc — Base44 scheduled automations have no other mechanism to
 * pass credentials (confirmed against the platform docs: a scheduled
 * automation calls this same public endpoint with no distinguishing header or
 * signal, so there is nothing else to gate on). Rotating the token is the
 * available mitigation if it leaks, not elimination.
 *
 * COOLDOWN (this is the actual point of not fully trusting the token): even
 * with a valid token, repeated calls cannot grant anyone twice in the same
 * month (period_key check below already prevented that) — but they COULD
 * previously be called an unlimited number of times a day, each one costing 1
 * integration credit even when it grants nothing. SystemState below caps that
 * to roughly one run per COOLDOWN_HOURS, so a leaked-but-still-valid token is
 * worth at most ~1 extra run a day, not unlimited cost.
 *
 * Budget: 1 integration credit per run, daily = ~30/month. Do not make this
 * hourly.
 */
const COOLDOWN_HOURS = 20; // < 24 so the daily cron's actual fire time can drift without ever self-blocking
const STATE_KEY = 'grantMonthlyCredits_last_run';

function tokensMatch(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);

    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }

    const expected = secrets.get('GRANT_TRIGGER_TOKEN');
    const presented =
      req.headers.get('x-cedar-trigger-token') ||
      body?.args?.trigger_token ||
      body?.trigger_token ||
      '';
    const isBroadcast = !!expected && tokensMatch(String(expected), String(presented));
    if (!isBroadcast) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Cooldown: even a valid token can't trigger more than ~1 extra run per
    // COOLDOWN_HOURS. Read-then-write is not perfectly atomic, but the worst
    // case from a lost race is one or two extra runs, not unlimited ones —
    // this is a cost cap, not a correctness guarantee, so that's fine.
    const stateRows = await base44.asServiceRole.entities.SystemState.filter({ key: STATE_KEY });
    const lastRun = stateRows?.[0]?.value ? new Date(stateRows[0].value) : null;
    if (lastRun && Date.now() - lastRun.getTime() < COOLDOWN_HOURS * 60 * 60 * 1000) {
      return Response.json({ ok: true, skipped_reason: 'cooldown', granted: 0, skipped: 0 });
    }
    if (stateRows?.[0]) {
      await base44.asServiceRole.entities.SystemState.update(stateRows[0].id, { value: new Date().toISOString() });
    } else {
      await base44.asServiceRole.entities.SystemState.create({ key: STATE_KEY, value: new Date().toISOString() });
    }

    const thisMonth = periodKey();
    const balances = await base44.asServiceRole.entities.CreditBalance.list('-updated_date', 500);

    let granted = 0;
    let skipped = 0;
    for (const b of balances || []) {
      // Free tier has no subscription and is a lifetime grant — never refreshed.
      if (b.tier === 'free' || !b.stripe_subscription_id) { skipped++; continue; }
      // Already topped up this calendar month (by this job, or by an invoice).
      if (b.period_key === thisMonth) { skipped++; continue; }
      const result = await grantScheduledMonthly(
        base44,
        b.user_id,
        b.tier,
        b.stripe_subscription_id,
        thisMonth,
      );
      if (Number(result?.granted || 0) > 0) granted++;
      else skipped++;
    }

    return Response.json({ ok: true, granted, skipped });
  } catch (e) {
    console.error('[grantMonthlyCredits]', (e as Error).message);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}