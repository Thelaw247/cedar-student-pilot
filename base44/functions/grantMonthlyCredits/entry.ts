import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { secrets } from 'base44:runtime';
import { TIER_GRANT, periodKey } from '../../shared/credits.ts';

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
 * Budget: 1 integration credit per run, daily = ~30/month. Do not make this
 * hourly.
 */
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

    const thisMonth = periodKey();
    const today = new Date().toISOString().split('T')[0];
    const balances = await base44.asServiceRole.entities.CreditBalance.list('-updated_date', 500);

    let granted = 0;
    let skipped = 0;
    for (const b of balances || []) {
      // Free tier has no subscription and is a lifetime grant — never refreshed.
      if (b.tier === 'free' || !b.stripe_subscription_id) { skipped++; continue; }
      // Already topped up this calendar month (by this job, or by an invoice).
      if (b.period_key === thisMonth) { skipped++; continue; }
      const allowance = TIER_GRANT[b.tier] || 0;
      await base44.asServiceRole.entities.CreditBalance.update(b.id, {
        subscription_credits: allowance, // expire unused, grant fresh
        period_key: thisMonth,
        last_grant_date: today,
      });
      granted++;
    }

    return Response.json({ ok: true, granted, skipped });
  } catch (e) {
    console.error('[grantMonthlyCredits]', (e as Error).message);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}