/**
 * Stripe REST helpers and recoverable credit fulfillment.
 *
 * CreditBalance is the atomic source of truth. Each Stripe session/invoice
 * anchor is appended to fulfilled_stripe_anchors in the SAME conditional
 * update that changes the balance. ProcessedStripeEvent is an audit/recovery
 * copy, not a lock. If the audit write fails, a retry sees the anchor on the
 * balance, repairs the audit row, and never grants twice.
 */
import { secrets } from 'base44:runtime';
import { getBalance, TIER_GRANT, periodKey } from './credits.ts';

const STRIPE_VERSION = '2026-06-24.dahlia';
const BASE = 'https://api.stripe.com/v1';
const CEDAR_APP_ID = '6a485105cf0a684688950256';

export function appId(): string {
  try {
    return Deno.env.get('BASE44_APP_ID') || secrets.get('BASE44_APP_ID') || CEDAR_APP_ID;
  } catch {
    return Deno.env.get('BASE44_APP_ID') || CEDAR_APP_ID;
  }
}

const DEFAULT_ORIGIN = 'https://cedar-student-pilot.base44.app';

/** A configured, allowlisted return origin; never derive this from the request. */
export function appOrigin(): string {
  let configured = '';
  try { configured = secrets.get('APP_ORIGIN') || ''; } catch { /* not configured */ }
  const origin = (configured || DEFAULT_ORIGIN).trim().replace(/\/+$/, '');
  if (!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(origin)) {
    console.error('[stripe] APP_ORIGIN is not a valid https origin, using default:', origin);
    return DEFAULT_ORIGIN;
  }
  return origin;
}

/** Cancel a subscription immediately during account deletion. */
export async function stripeDelete(path: string) {
  const key = secrets.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  const res = await fetch(`${BASE}/${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${key}`, 'Stripe-Version': STRIPE_VERSION },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Stripe DELETE ${path} ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

function flatten(params: Record<string, any>): [string, string][] {
  const pairs: [string, string][] = [];
  const walk = (prefix: string, value: any) => {
    if (value === null || value === undefined || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(`${prefix}[${index}]`, item));
      return;
    }
    if (typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) walk(`${prefix}[${key}]`, item);
      return;
    }
    pairs.push([prefix, String(value)]);
  };
  for (const [key, value] of Object.entries(params)) walk(key, value);
  return pairs;
}

export async function stripePost(path: string, params: Record<string, any>, idempotencyKey?: string) {
  const key = secrets.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  const res = await fetch(`${BASE}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Stripe-Version': STRIPE_VERSION,
      'Idempotency-Key': idempotencyKey || crypto.randomUUID(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(flatten(params)),
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`Stripe ${path} ${res.status}: ${json?.error?.message || text.slice(0, 300)}`);
  return json;
}

export async function stripeGet(path: string) {
  const key = secrets.get('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  const res = await fetch(`${BASE}/${path}`, {
    headers: { Authorization: `Bearer ${key}`, 'Stripe-Version': STRIPE_VERSION },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Stripe ${path} ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// --------------------------------------------------------------- customer ----

export async function ensureCustomer(base44: any, user: any, balance: any): Promise<string> {
  if (balance.stripe_customer_id) return balance.stripe_customer_id;
  const customer = await stripePost('customers', {
    email: user.email || '',
    name: user.full_name || '',
    'metadata[base44_app_id]': appId(),
    'metadata[user_id]': user.id,
  }, `cedar-customer-${user.id}`);
  // The Stripe idempotency key guarantees concurrent first checkouts receive
  // the same customer id, so both writes converge on one value.
  await base44.asServiceRole.entities.CreditBalance.update(balance.id, {
    stripe_customer_id: customer.id,
  });
  return customer.id;
}

// ---------------------------------------------------------- fulfillment ------

type FulfillmentKind =
  | 'subscription_initial'
  | 'pack'
  | 'subscription_renewal'
  | 'tier_sync'
  | 'downgrade'
  | 'monthly_grant';

type FulfillmentMeta = {
  stripe_event_id?: string;
  stripe_session_id?: string;
};

type FulfillmentMutation = {
  set?: Record<string, any>;
  inc?: Record<string, number>;
  credits: number;
  result?: Record<string, any>;
};

const todayStr = (date?: Date) =>
  (date ? new Date(date) : new Date()).toISOString().split('T')[0];

function anchorsOf(balance: any): string[] {
  return Array.isArray(balance?.fulfilled_stripe_anchors)
    ? balance.fulfilled_stripe_anchors.filter(Boolean)
    : [];
}

function balanceCasQuery(balance: any, anchors: string[]) {
  const query: Record<string, any> = {
    id: balance.id,
    tier: balance.tier || 'free',
    subscription_credits: Number(balance.subscription_credits || 0),
    purchased_credits: Number(balance.purchased_credits || 0),
    lifetime_granted: Number(balance.lifetime_granted || 0),
    period_key: balance.period_key || '',
    fulfilled_stripe_anchors: anchors,
  };
  // Do not coerce absent optional fields to an empty string in the query:
  // existing pre-migration rows may truly omit them.
  if (balance.stripe_customer_id !== undefined) {
    query.stripe_customer_id = balance.stripe_customer_id;
  }
  if (balance.stripe_subscription_id !== undefined) {
    query.stripe_subscription_id = balance.stripe_subscription_id;
  }
  return query;
}

async function auditRows(base44: any, anchorId: string): Promise<any[]> {
  return await base44.asServiceRole.entities.ProcessedStripeEvent.filter({
    anchor_id: anchorId,
  });
}

async function writeAudit(
  base44: any,
  state: {
    anchorId: string;
    userId: string;
    kind: FulfillmentKind;
    credits: number;
    status: 'complete' | 'failed';
    error?: string;
    meta?: FulfillmentMeta;
  },
) {
  const now = new Date().toISOString();
  try {
    const rows = await auditRows(base44, state.anchorId);
    const set: Record<string, any> = {
      user_id: state.userId,
      kind: state.kind,
      stripe_event_id: state.meta?.stripe_event_id || '',
      stripe_session_id: state.meta?.stripe_session_id || '',
      credits_granted: state.credits,
      status: state.status,
      last_error: state.error || '',
    };
    if (state.status === 'complete') set.completed_at = now;

    if (rows.length > 0) {
      await base44.asServiceRole.entities.ProcessedStripeEvent.updateMany(
        { anchor_id: state.anchorId },
        { $set: set, $inc: { attempt_count: 1 } },
      );
    } else {
      await base44.asServiceRole.entities.ProcessedStripeEvent.create({
        anchor_id: state.anchorId,
        ...set,
        attempt_count: 1,
        processed_at: now,
      });
    }
  } catch (error) {
    // The balance anchor remains authoritative. A later webhook/confirmation
    // retry repairs this audit copy without repeating the grant.
    console.error('[stripe] fulfillment audit write failed:', (error as Error).message);
  }
}

/** Legacy completed rows predate balance anchors. Backfill them, never regrant. */
async function legacyFulfilledCredits(base44: any, anchorId: string): Promise<number | null> {
  try {
    const rows = await auditRows(base44, anchorId);
    const completed = rows.find((row: any) =>
      row?.status === 'complete' || Number(row?.credits_granted || 0) > 0
    );
    return completed ? Number(completed.credits_granted || 0) : null;
  } catch {
    return null;
  }
}

async function applyFulfillment(
  base44: any,
  userId: string,
  anchorId: string,
  kind: FulfillmentKind,
  meta: FulfillmentMeta,
  build: (balance: any) => FulfillmentMutation,
) {
  if (!anchorId) throw new Error('A stable fulfillment anchor is required');

  const legacyCredits = await legacyFulfilledCredits(base44, anchorId);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 6; attempt++) {
    const balance = await getBalance(base44, userId);
    const anchors = anchorsOf(balance);

    if (anchors.includes(anchorId)) {
      const mutation = build(balance);
      await writeAudit(base44, {
        anchorId, userId, kind,
        credits: legacyCredits ?? mutation.credits,
        status: 'complete',
        meta,
      });
      return { already: true, ...(mutation.result || {}) };
    }

    const nextAnchors = [...anchors, anchorId].slice(-500);

    // A legacy audit row with a positive grant is proof that the old code
    // already changed the balance. Only attach the new anchor.
    const mutation = legacyCredits !== null
      ? { set: {}, inc: {}, credits: legacyCredits, result: { already: true } }
      : build(balance);

    const update: Record<string, any> = {
      $set: {
        ...(mutation.set || {}),
        fulfilled_stripe_anchors: nextAnchors,
      },
    };
    const increments = Object.fromEntries(
      Object.entries(mutation.inc || {}).filter(([, value]) => Number(value) !== 0),
    );
    if (Object.keys(increments).length > 0) update.$inc = increments;

    try {
      const result = await base44.asServiceRole.entities.CreditBalance.updateMany(
        balanceCasQuery(balance, anchors),
        update,
      );
      if (Number(result?.updated || 0) === 1) {
        await writeAudit(base44, {
          anchorId, userId, kind,
          credits: mutation.credits,
          status: 'complete',
          meta,
        });
        return legacyCredits !== null
          ? { already: true, ...(mutation.result || {}) }
          : { granted: mutation.credits, ...(mutation.result || {}) };
      }
    } catch (error) {
      lastError = error as Error;
      break;
    }
  }

  const error = lastError || new Error('Credit balance changed repeatedly during fulfillment');
  await writeAudit(base44, {
    anchorId, userId, kind,
    credits: 0,
    status: 'failed',
    error: error.message,
    meta,
  });
  throw error;
}

/** First subscription purchase: set tier + subscription id and grant the month. */
export async function grantSubscriptionInitial(
  base44: any,
  userId: string,
  tier: string,
  _period: string,
  anchorId: string,
  stripeSessionId: string,
  stripeEventId: string,
  subscriptionId = '',
) {
  const grant = TIER_GRANT[tier] || 0;
  return await applyFulfillment(
    base44,
    userId,
    anchorId,
    'subscription_initial',
    { stripe_event_id: stripeEventId, stripe_session_id: stripeSessionId },
    () => ({
      set: {
        tier,
        subscription_credits: grant,
        stripe_subscription_id: subscriptionId,
        period_key: periodKey(),
        last_grant_date: todayStr(),
      },
      inc: { lifetime_granted: grant },
      credits: grant,
    }),
  );
}

/** One-time pack purchase: atomically add never-expiring credits. */
export async function grantPack(
  base44: any,
  userId: string,
  credits: number,
  anchorId: string,
  stripeSessionId: string,
  stripeEventId: string,
) {
  if (!Number.isFinite(credits) || credits <= 0) throw new Error('Invalid pack credit amount');
  return await applyFulfillment(
    base44,
    userId,
    anchorId,
    'pack',
    { stripe_event_id: stripeEventId, stripe_session_id: stripeSessionId },
    () => ({
      inc: { purchased_credits: credits },
      credits,
    }),
  );
}

/** Paid invoice: grant only when its month has not already been topped up. */
export async function grantRenewal(
  base44: any,
  userId: string,
  tier: string,
  invoiceId: string,
  periodStart: number,
  subscriptionId = '',
) {
  const date = periodStart ? new Date(periodStart * 1000) : new Date();
  const monthKey = periodKey(date);
  return await applyFulfillment(
    base44,
    userId,
    invoiceId,
    'subscription_renewal',
    { stripe_event_id: invoiceId },
    (balance) => {
      if (balance.tier === tier && balance.period_key === monthKey) {
        return {
          set: subscriptionId ? { stripe_subscription_id: subscriptionId } : {},
          credits: 0,
          result: { skipped: 'same_period' },
        };
      }
      const grant = TIER_GRANT[tier] || 0;
      return {
        set: {
          tier,
          subscription_credits: grant,
          ...(subscriptionId ? { stripe_subscription_id: subscriptionId } : {}),
          period_key: monthKey,
          last_grant_date: todayStr(date),
        },
        inc: { lifetime_granted: grant },
        credits: grant,
      };
    },
  );
}

/** Daily recovery sweep for semester plans whose Stripe invoice is four-monthly. */
export async function grantScheduledMonthly(
  base44: any,
  userId: string,
  tier: string,
  subscriptionId: string,
  monthKey = periodKey(),
) {
  const anchorId = `monthly:${userId}:${monthKey}`;
  return await applyFulfillment(
    base44,
    userId,
    anchorId,
    'monthly_grant',
    {},
    (balance) => {
      if (balance.period_key === monthKey) {
        return { credits: 0, result: { skipped: 'same_period' } };
      }
      const grant = TIER_GRANT[tier] || 0;
      return {
        set: {
          tier,
          subscription_credits: grant,
          stripe_subscription_id: subscriptionId,
          period_key: monthKey,
          last_grant_date: todayStr(),
        },
        inc: { lifetime_granted: grant },
        credits: grant,
      };
    },
  );
}

/** Sync plan changes; upgrades receive only the allowance difference. */
export async function syncTier(
  base44: any,
  userId: string,
  tier: string,
  subscriptionId: string,
  anchorId: string,
) {
  return await applyFulfillment(
    base44,
    userId,
    anchorId,
    'tier_sync',
    { stripe_event_id: anchorId },
    (balance) => {
      if (balance.tier === tier && balance.stripe_subscription_id === subscriptionId) {
        return { credits: 0, result: { skipped: 'no_change' } };
      }

      const oldGrant = TIER_GRANT[balance.tier] || 0;
      const newGrant = TIER_GRANT[tier] || 0;
      const isUpgrade =
        balance.tier !== tier &&
        balance.tier !== 'free' &&
        newGrant > oldGrant;
      const uplift = isUpgrade ? newGrant - oldGrant : 0;

      return {
        set: {
          tier,
          stripe_subscription_id: subscriptionId,
          ...(uplift > 0
            ? { subscription_credits: Number(balance.subscription_credits || 0) + uplift }
            : {}),
        },
        inc: uplift > 0 ? { lifetime_granted: uplift } : {},
        credits: uplift,
        result: { synced: tier, uplift },
      };
    },
  );
}

/** Drop subscription allowance at period end; purchased credits survive. */
export async function downgradeAtPeriodEnd(
  base44: any,
  userId: string,
  subscriptionId: string,
  anchorId: string,
) {
  return await applyFulfillment(
    base44,
    userId,
    anchorId,
    'downgrade',
    { stripe_event_id: anchorId },
    () => ({
      set: {
        tier: 'free',
        stripe_subscription_id: '',
        subscription_credits: 0,
      },
      credits: 0,
      result: { downgraded: true, subscription_id: subscriptionId },
    }),
  );
}

// --------------------------------------------- subscription context ----------

export async function userIdForSubscription(base44: any, subId: string): Promise<string | null> {
  const rows = await base44.asServiceRole.entities.CreditBalance.filter({
    stripe_subscription_id: subId,
  });
  return rows?.[0]?.user_id || null;
}

export async function subscriptionContext(base44: any, subId: string) {
  const subscription = await stripeGet(`subscriptions/${subId}?expand[]=items.data.price`);
  const userId = subscription?.metadata?.user_id
    || await userIdForSubscription(base44, subId);
  const tier = subscription?.metadata?.cedar_tier
    || subscription?.items?.data?.[0]?.price?.metadata?.cedar_tier
    || null;
  return { subscription, userId, tier };
}

export async function tierFromSubscription(base44: any, subId: string): Promise<string | null> {
  const context = await subscriptionContext(base44, subId);
  return context.tier;
}

// --------------------------------------- webhook signature verification ------

async function hmacHex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return [...new Uint8Array(signature)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyStripeSignature(
  body: string,
  signatureHeader: string,
  secret: string,
  toleranceSec = 300,
): Promise<{ ok: boolean; reason?: string }> {
  if (!signatureHeader || !secret) return { ok: false, reason: 'missing' };

  let timestamp: string | null = null;
  const signatures: string[] = [];
  for (const piece of signatureHeader.split(',')) {
    const [key, value] = piece.split('=');
    if (key === 't') timestamp = value;
    else if (key === 'v1' && value) signatures.push(value);
  }
  if (!timestamp || signatures.length === 0) {
    return { ok: false, reason: 'malformed' };
  }

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSec) {
    return { ok: false, reason: 'expired' };
  }

  const expected = await hmacHex(secret, `${timestamp}.${body}`);
  for (const signature of signatures) {
    if (signature.length !== expected.length) continue;
    let difference = 0;
    for (let index = 0; index < signature.length; index++) {
      difference |= signature.charCodeAt(index) ^ expected.charCodeAt(index);
    }
    if (difference === 0) return { ok: true };
  }
  return { ok: false, reason: 'signature_mismatch' };
}
