/**
 * ownerAnalytics — admin-only revenue, usage and MARGIN rollup.
 *
 * This is the one place the whole picture exists. Stripe knows revenue but
 * nothing about credits burned; UsageEvent knows cost-to-serve but nothing
 * about money collected. No third-party dashboard can join them, so this
 * function does it server-side and returns one shape the UI can render.
 *
 * Access: admin only, checked against the *server's* view of the user's role
 * (base44.auth.me()), never a client-supplied flag.
 *
 * Cost model note: cost_cad on UsageEvent is an ESTIMATE written at the time
 * of the call (see shared/credits.ts RATES). Margin here is therefore
 * estimated too. Stripe fees are NOT deducted — see feesNote in the payload.
 */
import { createClientFromRequest } from '@base44/sdk';
import { stripeGet } from '../../shared/stripe.ts';
import { TIER_GRANT } from '../../shared/credits.ts';

/** Pull every page of a Stripe list endpoint, newest first. */
async function stripeAll(path: string, cap = 1000): Promise<any[]> {
  const out: any[] = [];
  let startingAfter: string | undefined;
  while (out.length < cap) {
    const sep = path.includes('?') ? '&' : '?';
    const page = await stripeGet(
      `${path}${sep}limit=100${startingAfter ? `&starting_after=${startingAfter}` : ''}`,
    );
    const data = page?.data || [];
    out.push(...data);
    if (!page?.has_more || data.length === 0) break;
    startingAfter = data[data.length - 1].id;
  }
  return out;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ---------------------------------------------------------- app-side ---
    const balances = await base44.asServiceRole.entities.CreditBalance.list();
    const events = await base44.asServiceRole.entities.UsageEvent.list();
    const users = await base44.asServiceRole.entities.User.list();

    const userById = new Map<string, any>();
    for (const u of users || []) userById.set(u.id, u);

    // usage rollup per user
    const usageByUser = new Map<string, any>();
    const featureTotals = new Map<string, any>();
    let costAll = 0;

    for (const e of events || []) {
      const cost = Number(e.cost_cad) || 0;
      const charged = Number(e.cedar_credits_charged) || 0;
      costAll += cost;

      const u = usageByUser.get(e.user_id) || {
        actions: 0, cost_cad: 0, credits_charged: 0, failures: 0, last_active: null,
      };
      u.actions += 1;
      u.cost_cad += cost;
      u.credits_charged += charged;
      if (e.success === false) u.failures += 1;
      if (!u.last_active || (e.occurred_at && e.occurred_at > u.last_active)) {
        u.last_active = e.occurred_at || u.last_active;
      }
      usageByUser.set(e.user_id, u);

      const f = featureTotals.get(e.feature) || { feature: e.feature, actions: 0, cost_cad: 0, credits_charged: 0 };
      f.actions += 1;
      f.cost_cad += cost;
      f.credits_charged += charged;
      featureTotals.set(e.feature, f);
    }

    // ------------------------------------------------------- stripe-side ---
    // Succeeded charges give real collected revenue including one-off packs;
    // subscriptions alone would miss the credit packs entirely.
    const charges = await stripeAll('charges');
    const revenueByCustomer = new Map<string, any>();
    let revenueAll = 0;
    let refundedAll = 0;

    for (const c of charges) {
      if (c.status !== 'succeeded') continue;
      const gross = (c.amount || 0) / 100;
      const refunded = (c.amount_refunded || 0) / 100;
      const net = gross - refunded;
      revenueAll += net;
      refundedAll += refunded;
      const cid = c.customer;
      if (!cid) continue;
      const r = revenueByCustomer.get(cid) || { gross: 0, refunded: 0, net: 0, payments: 0, first: null, last: null };
      r.gross += gross;
      r.refunded += refunded;
      r.net += net;
      r.payments += 1;
      const at = c.created ? new Date(c.created * 1000).toISOString() : null;
      if (at && (!r.first || at < r.first)) r.first = at;
      if (at && (!r.last || at > r.last)) r.last = at;
      revenueByCustomer.set(cid, r);
    }

    // ------------------------------------------------------ join per user --
    const customers = (balances || []).map((b: any) => {
      const u = userById.get(b.user_id);
      const usage = usageByUser.get(b.user_id) || { actions: 0, cost_cad: 0, credits_charged: 0, failures: 0, last_active: null };
      const rev = (b.stripe_customer_id && revenueByCustomer.get(b.stripe_customer_id)) || { net: 0, gross: 0, refunded: 0, payments: 0, first: null, last: null };
      const profit = rev.net - usage.cost_cad;
      return {
        user_id: b.user_id,
        email: u?.email || null,
        name: u?.full_name || null,
        joined: u?.created_date || null,
        tier: b.tier || 'free',
        subscribed: !!b.stripe_subscription_id,
        subscription_credits: b.subscription_credits || 0,
        purchased_credits: b.purchased_credits || 0,
        available_credits: (b.subscription_credits || 0) + (b.purchased_credits || 0),
        lifetime_granted: b.lifetime_granted || 0,
        actions: usage.actions,
        credits_charged: usage.credits_charged,
        failures: usage.failures,
        last_active: usage.last_active,
        revenue_cad: round2(rev.net),
        gross_cad: round2(rev.gross),
        refunded_cad: round2(rev.refunded),
        payments: rev.payments,
        first_payment: rev.first,
        cost_cad: round4(usage.cost_cad),
        profit_cad: round2(profit),
        margin_pct: rev.net > 0 ? Math.round((profit / rev.net) * 100) : null,
      };
    });

    // -------------------------------------------------------- by-tier roll --
    const tierRoll: Record<string, any> = {};
    for (const c of customers) {
      const t = tierRoll[c.tier] || (tierRoll[c.tier] = {
        tier: c.tier, customers: 0, revenue_cad: 0, cost_cad: 0, profit_cad: 0,
        actions: 0, monthly_grant: TIER_GRANT[c.tier] ?? null,
      });
      t.customers += 1;
      t.revenue_cad += c.revenue_cad;
      t.cost_cad += c.cost_cad;
      t.profit_cad += c.profit_cad;
      t.actions += c.actions;
    }

    const paying = customers.filter((c) => c.revenue_cad > 0);
    const subs = customers.filter((c) => c.subscribed);

    return Response.json({
      generated_at: new Date().toISOString(),
      totals: {
        users: customers.length,
        paying_customers: paying.length,
        active_subscribers: subs.length,
        free_users: customers.filter((c) => c.tier === 'free').length,
        revenue_cad: round2(revenueAll),
        refunded_cad: round2(refundedAll),
        cost_cad: round4(costAll),
        profit_cad: round2(revenueAll - costAll),
        margin_pct: revenueAll > 0 ? Math.round(((revenueAll - costAll) / revenueAll) * 100) : null,
        arpu_cad: paying.length ? round2(revenueAll / paying.length) : 0,
        total_actions: (events || []).length,
      },
      by_tier: Object.values(tierRoll).map((t: any) => ({
        ...t,
        revenue_cad: round2(t.revenue_cad),
        cost_cad: round4(t.cost_cad),
        profit_cad: round2(t.profit_cad),
      })),
      by_feature: [...featureTotals.values()]
        .map((f: any) => ({
          ...f,
          cost_cad: round4(f.cost_cad),
          avg_cost_cad: f.actions ? round4(f.cost_cad / f.actions) : 0,
        }))
        .sort((a: any, b: any) => b.cost_cad - a.cost_cad),
      customers: customers.sort((a, b) => b.revenue_cad - a.revenue_cad),
      notes: {
        cost: 'cost_cad is an estimate written at call time from shared/credits.ts RATES, not a billed figure.',
        fees: 'Stripe processing fees are NOT deducted. True net is roughly revenue x 0.971 - 0.30 per payment.',
        coverage: 'Only features that call gateFeature/settleFeature write UsageEvent rows. Anything ungated shows zero cost.',
      },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

function round2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function round4(n: number) { return Math.round((n + Number.EPSILON) * 10000) / 10000; }
