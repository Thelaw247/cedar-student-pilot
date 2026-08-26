import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { stripeGet } from '../lib/stripe.js';
import { TIER_GRANT } from '../lib/credits.js';

// Direct port of base44/functions/ownerAnalytics/entry.ts. Admin check is
// now against profiles.role (a table this server owns), not a field on the
// Supabase Auth user object — requireAuth's req.user only carries what
// Supabase Auth itself returns, which doesn't include app-specific roles.
// Email/name come from a cross-schema join against auth.users, which this
// server's direct Postgres connection can do in one query since both live in
// the same database.

const router = express.Router();
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const round4 = (n) => Math.round((n + Number.EPSILON) * 10000) / 10000;

async function stripeAll(path, cap = 1000) {
  const out = [];
  let startingAfter;
  while (out.length < cap) {
    const sep = path.includes('?') ? '&' : '?';
    const page = await stripeGet(`${path}${sep}limit=100${startingAfter ? `&starting_after=${startingAfter}` : ''}`);
    const data = page?.data || [];
    out.push(...data);
    if (!page?.has_more || data.length === 0) break;
    startingAfter = data[data.length - 1].id;
  }
  return out;
}

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows: balances } = await pool.query('select * from credit_balances');
    const { rows: events } = await pool.query('select * from usage_events');
    const { rows: users } = await pool.query(
      `select u.id, u.email, u.created_at, p.full_name from auth.users u left join profiles p on p.id = u.id`);

    const userById = new Map(users.map((u) => [u.id, u]));

    const usageByUser = new Map();
    const featureTotals = new Map();
    let costAll = 0;

    for (const e of events) {
      const cost = Number(e.cost_cad) || 0;
      const charged = Number(e.cedar_credits_charged) || 0;
      costAll += cost;

      const u = usageByUser.get(e.user_id) || { actions: 0, cost_cad: 0, credits_charged: 0, failures: 0, last_active: null };
      u.actions += 1; u.cost_cad += cost; u.credits_charged += charged;
      if (e.success === false) u.failures += 1;
      const occurredAt = e.occurred_at instanceof Date ? e.occurred_at.toISOString() : e.occurred_at;
      if (!u.last_active || (occurredAt && occurredAt > u.last_active)) u.last_active = occurredAt || u.last_active;
      usageByUser.set(e.user_id, u);

      const f = featureTotals.get(e.feature) || { feature: e.feature, actions: 0, cost_cad: 0, credits_charged: 0 };
      f.actions += 1; f.cost_cad += cost; f.credits_charged += charged;
      featureTotals.set(e.feature, f);
    }

    const charges = await stripeAll('charges');
    const revenueByCustomer = new Map();
    let revenueAll = 0, refundedAll = 0;

    for (const c of charges) {
      if (c.status !== 'succeeded') continue;
      const gross = (c.amount || 0) / 100;
      const refunded = (c.amount_refunded || 0) / 100;
      const net = gross - refunded;
      revenueAll += net; refundedAll += refunded;
      const cid = c.customer;
      if (!cid) continue;
      const r = revenueByCustomer.get(cid) || { gross: 0, refunded: 0, net: 0, payments: 0, first: null, last: null };
      r.gross += gross; r.refunded += refunded; r.net += net; r.payments += 1;
      const at = c.created ? new Date(c.created * 1000).toISOString() : null;
      if (at && (!r.first || at < r.first)) r.first = at;
      if (at && (!r.last || at > r.last)) r.last = at;
      revenueByCustomer.set(cid, r);
    }

    const customers = balances.map((b) => {
      const u = userById.get(b.user_id);
      const usage = usageByUser.get(b.user_id) || { actions: 0, cost_cad: 0, credits_charged: 0, failures: 0, last_active: null };
      const rev = (b.stripe_customer_id && revenueByCustomer.get(b.stripe_customer_id)) || { net: 0, gross: 0, refunded: 0, payments: 0, first: null, last: null };
      const profit = rev.net - usage.cost_cad;
      return {
        user_id: b.user_id, email: u?.email || null, name: u?.full_name || null,
        joined: u?.created_at instanceof Date ? u.created_at.toISOString() : u?.created_at || null,
        tier: b.tier || 'free', subscribed: !!b.stripe_subscription_id,
        subscription_credits: b.subscription_credits || 0, purchased_credits: b.purchased_credits || 0,
        available_credits: Number(b.subscription_credits || 0) + Number(b.purchased_credits || 0),
        lifetime_granted: b.lifetime_granted || 0, actions: usage.actions, credits_charged: usage.credits_charged,
        failures: usage.failures, last_active: usage.last_active, revenue_cad: round2(rev.net), gross_cad: round2(rev.gross),
        refunded_cad: round2(rev.refunded), payments: rev.payments, first_payment: rev.first,
        cost_cad: round4(usage.cost_cad), profit_cad: round2(profit),
        margin_pct: rev.net > 0 ? Math.round((profit / rev.net) * 100) : null,
      };
    });

    const tierRoll = {};
    for (const c of customers) {
      const t = tierRoll[c.tier] || (tierRoll[c.tier] = { tier: c.tier, customers: 0, revenue_cad: 0, cost_cad: 0, profit_cad: 0, actions: 0, monthly_grant: TIER_GRANT[c.tier] ?? null });
      t.customers += 1; t.revenue_cad += c.revenue_cad; t.cost_cad += c.cost_cad; t.profit_cad += c.profit_cad; t.actions += c.actions;
    }

    const paying = customers.filter((c) => c.revenue_cad > 0);
    const subs = customers.filter((c) => c.subscribed);

    res.json({
      generated_at: new Date().toISOString(),
      totals: {
        users: customers.length, paying_customers: paying.length, active_subscribers: subs.length,
        free_users: customers.filter((c) => c.tier === 'free').length, revenue_cad: round2(revenueAll),
        refunded_cad: round2(refundedAll), cost_cad: round4(costAll), profit_cad: round2(revenueAll - costAll),
        margin_pct: revenueAll > 0 ? Math.round(((revenueAll - costAll) / revenueAll) * 100) : null,
        arpu_cad: paying.length ? round2(revenueAll / paying.length) : 0, total_actions: events.length,
      },
      by_tier: Object.values(tierRoll).map((t) => ({ ...t, revenue_cad: round2(t.revenue_cad), cost_cad: round4(t.cost_cad), profit_cad: round2(t.profit_cad) })),
      by_feature: [...featureTotals.values()].map((f) => ({ ...f, cost_cad: round4(f.cost_cad), avg_cost_cad: f.actions ? round4(f.cost_cad / f.actions) : 0 })).sort((a, b) => b.cost_cad - a.cost_cad),
      customers: customers.sort((a, b) => b.revenue_cad - a.revenue_cad),
      notes: {
        cost: 'cost_cad is an estimate written at call time from lib/credits.js RATES, not a billed figure.',
        fees: 'Stripe processing fees are NOT deducted. True net is roughly revenue x 0.971 - 0.30 per payment.',
        coverage: 'Only features that call gateFeature/settleFeature write usage_events rows. Anything ungated shows zero cost.',
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
