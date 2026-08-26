import crypto from 'node:crypto';
import { pool } from './db.js';
import { TIER_GRANT, periodKey, getBalance } from './credits.js';
import { subscriptionEntitlement } from './stripePrices.js';

// Direct port of base44/shared/stripe.ts. Same Stripe account, same product
// metadata contract (cedar_tier, cedar_period, cedar_credits, user_id,
// base44_app_id) as the live Base44 checkout-session creator.

const STRIPE_VERSION = '2026-07-29.dahlia';
const BASE = 'https://api.stripe.com/v1';
const CEDAR_APP_ID = '6a485105cf0a684688950256';

export function appId() {
  return process.env.CEDAR_APP_ID || CEDAR_APP_ID;
}

export function checkoutIntegrationIdentifier() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  let suffix = '';
  for (let i = 0; i < 8; i += 1) suffix += alphabet[crypto.randomInt(alphabet.length)];
  return `cedar_checkout_${suffix}`;
}

// No more Base44 default origin to fall back to on this stack — unlike the
// original, an unset APP_ORIGIN fails loudly here rather than silently
// sending a paying user's browser somewhere undefined post-checkout.
export function appOrigin() {
  const configured = (process.env.APP_ORIGIN || '').trim().replace(/\/+$/, '');
  if (!configured) throw new Error('APP_ORIGIN is not configured');
  if (!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(configured)) {
    throw new Error(`APP_ORIGIN is not a valid https origin: ${configured}`);
  }
  return configured;
}

function requireStripeKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return key;
}

function flatten(params) {
  const pairs = [];
  const walk = (prefix, value) => {
    if (value === null || value === undefined || value === '') return;
    if (Array.isArray(value)) { value.forEach((item, i) => walk(`${prefix}[${i}]`, item)); return; }
    if (typeof value === 'object') { for (const [k, v] of Object.entries(value)) walk(`${prefix}[${k}]`, v); return; }
    pairs.push([prefix, String(value)]);
  };
  for (const [k, v] of Object.entries(params)) walk(k, v);
  return pairs;
}

export async function stripePost(path, params, idempotencyKey) {
  const key = requireStripeKey();
  const res = await fetch(`${BASE}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`, 'Stripe-Version': STRIPE_VERSION,
      'Idempotency-Key': idempotencyKey || crypto.randomUUID(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(flatten(params)),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`Stripe ${path} ${res.status}: ${json?.error?.message || text.slice(0, 300)}`);
  return json;
}

export async function stripeGet(path) {
  const key = requireStripeKey();
  const res = await fetch(`${BASE}/${path}`, {
    headers: { Authorization: `Bearer ${key}`, 'Stripe-Version': STRIPE_VERSION },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Stripe ${path} ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

export async function stripeDelete(path) {
  const key = requireStripeKey();
  const res = await fetch(`${BASE}/${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${key}`, 'Stripe-Version': STRIPE_VERSION },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Stripe DELETE ${path} ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// --------------------------------------------------------------- customer --
export async function ensureCustomer(user, balance) {
  if (balance.stripe_customer_id) return balance.stripe_customer_id;
  const customer = await stripePost('customers', {
    email: user.email || '', name: user.full_name || user.user_metadata?.full_name || '',
    'metadata[base44_app_id]': appId(), 'metadata[user_id]': user.id,
  }, `cedar-customer-${user.id}`);
  // Idempotency key guarantees concurrent first checkouts converge on one customer id.
  await pool.query('update credit_balances set stripe_customer_id = $1 where id = $2', [customer.id, balance.id]);
  return customer.id;
}

// ------------------------------------------ webhook signature verification --
export function verifyStripeSignature(body, signatureHeader, secret, toleranceSec = 300) {
  if (!signatureHeader || !secret) return { ok: false, reason: 'missing' };
  let timestamp = null;
  const signatures = [];
  for (const piece of signatureHeader.split(',')) {
    const [key, value] = piece.split('=');
    if (key === 't') timestamp = value;
    else if (key === 'v1' && value) signatures.push(value);
  }
  if (!timestamp || signatures.length === 0) return { ok: false, reason: 'malformed' };
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSec) return { ok: false, reason: 'expired' };
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  for (const signature of signatures) {
    if (signature.length !== expected.length) continue;
    if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return { ok: true };
  }
  return { ok: false, reason: 'signature_mismatch' };
}

// ---------------------------------------------------------- fulfillment ----
async function writeAudit(state) {
  const now = new Date().toISOString();
  try {
    const existing = await pool.query('select id from processed_stripe_events where anchor_id = $1', [state.anchorId]);
    if (existing.rows.length > 0) {
      await pool.query(
        `update processed_stripe_events set user_id = $2, kind = $3, stripe_event_id = $4, stripe_session_id = $5,
           credits_granted = $6, status = $7, last_error = $8, attempt_count = attempt_count + 1,
           completed_at = case when $7 = 'complete' then $9::timestamptz else completed_at end
         where anchor_id = $1`,
        [state.anchorId, state.userId, state.kind, state.meta?.stripe_event_id || '',
         state.meta?.stripe_session_id || '', state.credits, state.status, state.error || '', now]);
    } else {
      await pool.query(
        `insert into processed_stripe_events (user_id, anchor_id, kind, stripe_event_id, stripe_session_id,
           credits_granted, status, last_error, attempt_count, completed_at, processed_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, 1, case when $7 = 'complete' then $9::timestamptz else null end, $9)`,
        [state.userId, state.anchorId, state.kind, state.meta?.stripe_event_id || '',
         state.meta?.stripe_session_id || '', state.credits, state.status, state.error || '', now]);
    }
  } catch (error) {
    console.error('[stripe] fulfillment audit write failed:', error.message);
  }
}

async function applyFulfillment(userId, anchorId, kind, meta, build) {
  if (!anchorId) throw new Error('A stable fulfillment anchor is required');
  const client = await pool.connect();
  let result;
  try {
    await client.query('BEGIN');
    const existingAudit = await client.query(
      `select status from processed_stripe_events
       where anchor_id = $1
       for update`,
      [anchorId],
    );
    if (existingAudit.rows[0]?.status === 'complete') {
      await client.query('COMMIT');
      return { already: true };
    }

    const { rows } = await client.query('select * from credit_balances where user_id = $1 for update', [userId]);
    let balance = rows[0];
    if (!balance) {
      const inserted = await client.query(
        `insert into credit_balances (user_id, tier, subscription_credits, purchased_credits, lifetime_granted, period_key, last_grant_date)
         values ($1, 'free', $2, 0, $2, $3, current_date) returning *`,
        [userId, TIER_GRANT.free, periodKey()]);
      balance = inserted.rows[0];
    }
    const anchors = balance.fulfilled_stripe_anchors || [];
    if (anchors.includes(anchorId)) {
      await client.query(
        `insert into processed_stripe_events (
           user_id, anchor_id, kind, stripe_event_id, stripe_session_id,
           credits_granted, status, last_error, attempt_count, completed_at, processed_at
         ) values ($1, $2, $3, $4, $5, 0, 'complete', '', 1, now(), now())
         on conflict (anchor_id) do update set
           status = 'complete',
           last_error = '',
           attempt_count = processed_stripe_events.attempt_count + 1,
           completed_at = now()`,
        [userId, anchorId, kind, meta?.stripe_event_id || '', meta?.stripe_session_id || ''],
      );
      await client.query('COMMIT');
      return { already: true };
    }
    const mutation = build(balance);
    const nextAnchors = [...anchors, anchorId].slice(-500);
    const setEntries = Object.entries(mutation.set || {});
    const incEntries = Object.entries(mutation.inc || {}).filter(([, v]) => Number(v) !== 0);
    const params = [balance.id];
    const clauses = [];
    for (const [k, v] of setEntries) { params.push(v); clauses.push(`${k} = $${params.length}`); }
    for (const [k, v] of incEntries) { params.push(v); clauses.push(`${k} = ${k} + $${params.length}`); }
    params.push(nextAnchors);
    clauses.push(`fulfilled_stripe_anchors = $${params.length}`);
    clauses.push('updated_at = now()');
    await client.query(`update credit_balances set ${clauses.join(', ')} where id = $1`, params);
    await client.query(
      `insert into processed_stripe_events (
         user_id, anchor_id, kind, stripe_event_id, stripe_session_id,
         credits_granted, status, last_error, attempt_count, completed_at, processed_at
       ) values ($1, $2, $3, $4, $5, $6, 'complete', '', 1, now(), now())
       on conflict (anchor_id) do update set
         user_id = excluded.user_id,
         kind = excluded.kind,
         stripe_event_id = excluded.stripe_event_id,
         stripe_session_id = excluded.stripe_session_id,
         credits_granted = excluded.credits_granted,
         status = 'complete',
         last_error = '',
         attempt_count = processed_stripe_events.attempt_count + 1,
         completed_at = now()`,
      [userId, anchorId, kind, meta?.stripe_event_id || '',
       meta?.stripe_session_id || '', mutation.credits],
    );
    await client.query('COMMIT');
    result = { granted: mutation.credits, ...(mutation.result || {}) };
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    await writeAudit({ anchorId, userId, kind, credits: 0, status: 'failed', error: error.message, meta });
    throw error;
  } finally {
    client.release();
  }
}

const todayStr = (date) => (date ? new Date(date) : new Date()).toISOString().split('T')[0];

export async function grantSubscriptionInitial(userId, tier, _period, anchorId, stripeSessionId, stripeEventId, subscriptionId = '') {
  const grant = TIER_GRANT[tier] || 0;
  return applyFulfillment(userId, anchorId, 'subscription_initial',
    { stripe_event_id: stripeEventId, stripe_session_id: stripeSessionId },
    () => ({
      set: { tier, subscription_credits: grant, stripe_subscription_id: subscriptionId, period_key: periodKey(), last_grant_date: todayStr() },
      inc: { lifetime_granted: grant }, credits: grant,
    }));
}

export async function grantPack(userId, credits, anchorId, stripeSessionId, stripeEventId) {
  if (!Number.isFinite(credits) || credits <= 0) throw new Error('Invalid pack credit amount');
  return applyFulfillment(userId, anchorId, 'pack',
    { stripe_event_id: stripeEventId, stripe_session_id: stripeSessionId },
    () => ({ inc: { purchased_credits: credits }, credits }));
}

export async function grantRenewal(userId, tier, invoiceId, periodStart, subscriptionId = '') {
  const date = periodStart ? new Date(periodStart * 1000) : new Date();
  const monthKey = periodKey(date);
  return applyFulfillment(userId, invoiceId, 'subscription_renewal', { stripe_event_id: invoiceId },
    (balance) => {
      if (balance.tier === tier && balance.period_key === monthKey) {
        return { set: subscriptionId ? { stripe_subscription_id: subscriptionId } : {}, credits: 0, result: { skipped: 'same_period' } };
      }
      const grant = TIER_GRANT[tier] || 0;
      return {
        set: { tier, subscription_credits: grant, ...(subscriptionId ? { stripe_subscription_id: subscriptionId } : {}), period_key: monthKey, last_grant_date: todayStr(date) },
        inc: { lifetime_granted: grant }, credits: grant,
      };
    });
}

/** Daily recovery sweep for semester plans whose Stripe invoice is four-monthly. */
export async function grantScheduledMonthly(userId, tier, subscriptionId, monthKey = periodKey()) {
  const anchorId = `monthly:${userId}:${monthKey}`;
  return applyFulfillment(userId, anchorId, 'monthly_grant', {},
    (balance) => {
      if (balance.period_key === monthKey) return { credits: 0, result: { skipped: 'same_period' } };
      const grant = TIER_GRANT[tier] || 0;
      return {
        set: { tier, subscription_credits: grant, stripe_subscription_id: subscriptionId, period_key: monthKey, last_grant_date: todayStr() },
        inc: { lifetime_granted: grant }, credits: grant,
      };
    });
}

export async function syncTier(userId, tier, subscriptionId, anchorId) {
  return applyFulfillment(userId, anchorId, 'tier_sync', { stripe_event_id: anchorId },
    (balance) => {
      if (balance.tier === tier && balance.stripe_subscription_id === subscriptionId) return { credits: 0, result: { skipped: 'no_change' } };
      const oldGrant = TIER_GRANT[balance.tier] || 0;
      const newGrant = TIER_GRANT[tier] || 0;
      const isUpgrade = balance.tier !== tier && balance.tier !== 'free' && newGrant > oldGrant;
      const uplift = isUpgrade ? newGrant - oldGrant : 0;
      return {
        set: { tier, stripe_subscription_id: subscriptionId, ...(uplift > 0 ? { subscription_credits: Number(balance.subscription_credits || 0) + uplift } : {}) },
        inc: uplift > 0 ? { lifetime_granted: uplift } : {}, credits: uplift, result: { synced: tier, uplift },
      };
    });
}

export async function downgradeAtPeriodEnd(userId, subscriptionId, anchorId) {
  return applyFulfillment(userId, anchorId, 'downgrade', { stripe_event_id: anchorId },
    () => ({ set: { tier: 'free', stripe_subscription_id: '', subscription_credits: 0 }, credits: 0, result: { downgraded: true, subscription_id: subscriptionId } }));
}

export async function userIdForSubscription(subId) {
  const { rows } = await pool.query('select user_id from credit_balances where stripe_subscription_id = $1', [subId]);
  return rows[0]?.user_id || null;
}

export async function subscriptionContext(subId) {
  const subscription = await stripeGet(`subscriptions/${subId}?expand[]=items.data.price`);
  const userId = subscription?.metadata?.user_id || await userIdForSubscription(subId);
  const entitlement = subscriptionEntitlement(subscription);
  return { subscription, userId, tier: entitlement.tier, period: entitlement.period };
}
