/**
 * Stripe REST helpers + the credit-grant logic shared by the webhook and the
 * checkout-confirmation path.
 *
 * Entitlement is granted ONLY here, server-side, after verifying a Stripe
 * event or a retrieved checkout session. The checkout redirect itself is
 * never trusted (anyone can paste a success URL).
 *
 * All CreditBalance writes go through asServiceRole — CreditBalance RLS
 * denies all client writes, and a user who can write their own balance has
 * an infinite plan.
 */
import { secrets } from 'base44:runtime';
import { getBalance, TIER_GRANT, periodKey } from './credits.ts';

const STRIPE_VERSION = '2025-10-29.clover';
const BASE = 'https://api.stripe.com/v1';

function appId(): string {
  return Deno.env.get('BASE44_APP_ID') || secrets.get('BASE44_APP_ID') || '';
}

// Flatten params into [key, value] pairs with explicit bracket notation for
// nested hashes and indexed arrays. Empty strings are dropped so we never
// send metadata[cedar_pack]= for a subscription, etc.
function flatten(params: Record<string, any>): [string, string][] {
  const pairs: [string, string][] = [];
  const walk = (prefix: string, val: any) => {
    if (val === null || val === undefined || val === '') return;
    if (Array.isArray(val)) { val.forEach((v, i) => walk(`${prefix}[${i}]`, v)); return; }
    if (typeof val === 'object') { for (const [k, v] of Object.entries(val)) walk(`${prefix}[${k}]`, v); return; }
    pairs.push([prefix, String(val)]);
  };
  for (const [k, v] of Object.entries(params)) walk(k, v);
  return pairs;
}

export async function stripePost(path: string, params: Record<string, any>, idempotencyKey?: string) {
  const SK = secrets.get('STRIPE_SECRET_KEY');
  if (!SK) throw new Error('STRIPE_SECRET_KEY not configured');
  const body = new URLSearchParams(flatten(params));
  const res = await fetch(`${BASE}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SK}`,
      'Stripe-Version': STRIPE_VERSION,
      'Idempotency-Key': idempotencyKey || crypto.randomUUID(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`Stripe ${path} ${res.status}: ${json?.error?.message || text.slice(0, 300)}`);
  return json;
}

export async function stripeGet(path: string) {
  const SK = secrets.get('STRIPE_SECRET_KEY');
  if (!SK) throw new Error('STRIPE_SECRET_KEY not configured');
  const res = await fetch(`${BASE}/${path}`, {
    headers: { Authorization: `Bearer ${SK}`, 'Stripe-Version': STRIPE_VERSION },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Stripe ${path} ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// --------------------------------------------------------------- customer ----

export async function ensureCustomer(base44: any, user: any, balance: any): Promise<string> {
  if (balance.stripe_customer_id) return balance.stripe_customer_id;
  const c = await stripePost('customers', {
    email: user.email || '',
    name: user.full_name || '',
    'metadata[base44_app_id]': appId(),
    'metadata[user_id]': user.id,
    // Deterministic idempotency key. A random key per call would defeat
    // Stripe's idempotency entirely: two concurrent first-checkouts would
    // create two Stripe customers for the same student.
  }, `cedar-customer-${user.id}`);
  await base44.asServiceRole.entities.CreditBalance.update(balance.id, { stripe_customer_id: c.id });
  return c.id;
}

// ----------------------------------------------------------- idempotency ----

export async function hasProcessed(base44: any, anchorId: string): Promise<boolean> {
  if (!anchorId) return false;
  const rows = await base44.asServiceRole.entities.ProcessedStripeEvent.filter({ anchor_id: anchorId });
  return !!(rows && rows.length > 0);
}

/**
 * Atomically-enough claim an anchor before granting.
 *
 * A plain hasProcessed() -> grant -> recordProcessed() sequence is check-then-act:
 * the webhook and the success-page confirm routinely fire within milliseconds of
 * each other, and both can pass the check before either records. There is no
 * unique index available on anchor_id, so this claims FIRST and then re-reads:
 * if two writers raced, only the lowest row id proceeds and the loser bails.
 *
 * Fails closed. If the claim cannot be written we do not grant — Stripe retries
 * the webhook, which re-enters here and self-heals. Under-granting is visible
 * and recoverable; double-granting is a silent loss of money.
 */
export async function claimAnchor(
  base44: any,
  anchorId: string,
  userId: string,
  kind: string,
  extra: { stripe_event_id?: string; stripe_session_id?: string } = {},
): Promise<{ won: boolean; rowId?: string }> {
  if (!anchorId) return { won: false };

  const existing = await base44.asServiceRole.entities.ProcessedStripeEvent.filter({ anchor_id: anchorId });
  if (existing && existing.length > 0) return { won: false };

  let mine: any;
  try {
    mine = await base44.asServiceRole.entities.ProcessedStripeEvent.create({
      anchor_id: anchorId,
      user_id: userId,
      kind,
      stripe_event_id: extra.stripe_event_id || '',
      stripe_session_id: extra.stripe_session_id || '',
      credits_granted: 0,
      processed_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[idempotency] claim failed, not granting', (err as Error).message);
    return { won: false };
  }

  const rows = await base44.asServiceRole.entities.ProcessedStripeEvent.filter({ anchor_id: anchorId });
  if (rows && rows.length > 1) {
    const winner = rows.map((r: any) => String(r.id)).sort()[0];
    if (winner !== String(mine.id)) {
      console.warn('[idempotency] lost race for', anchorId, '- skipping grant');
      return { won: false };
    }
  }
  return { won: true, rowId: mine.id };
}

/** Write the granted amount back onto a claim row. Never throws. */
export async function finalizeClaim(base44: any, rowId: string | undefined, credits: number) {
  if (!rowId) return;
  try {
    await base44.asServiceRole.entities.ProcessedStripeEvent.update(rowId, { credits_granted: credits });
  } catch (err) {
    console.error('[idempotency] finalize failed', (err as Error).message);
  }
}

export async function recordProcessed(base44: any, e: {
  anchor_id: string; user_id: string; kind: string;
  stripe_event_id?: string; stripe_session_id?: string; credits_granted?: number;
}) {
  try {
    await base44.asServiceRole.entities.ProcessedStripeEvent.create({
      anchor_id: e.anchor_id,
      user_id: e.user_id,
      kind: e.kind,
      stripe_event_id: e.stripe_event_id || '',
      stripe_session_id: e.stripe_session_id || '',
      credits_granted: e.credits_granted || 0,
      processed_at: new Date().toISOString(),
    });
  } catch (err) {
    // A failure to record must not fail the grant — but it risks a future
    // double-grant. Log loudly so it is noticed.
    console.error('[idempotency] record failed', (err as Error).message);
  }
}

// --------------------------------------------------------------- grants -----

const todayStr = (d?: Date) => (d ? new Date(d) : new Date()).toISOString().split('T')[0];

/** First subscription purchase: set tier + period, grant this period's credits. */
export async function grantSubscriptionInitial(
  base44: any, userId: string, tier: string, _period: string,
  anchorId: string, stripeSessionId: string, stripeEventId: string,
) {
  if (await hasProcessed(base44, anchorId)) return { already: true };
  const balance = await getBalance(base44, userId);
  const grant = TIER_GRANT[tier] || 0;
  await base44.asServiceRole.entities.CreditBalance.update(balance.id, {
    tier,
    subscription_credits: grant, // fresh period allowance; leftovers from any prior state are replaced
    period_key: periodKey(),
    last_grant_date: todayStr(),
  });
  await recordProcessed(base44, { anchor_id: anchorId, user_id: userId, kind: 'subscription_initial', stripe_event_id: stripeEventId, stripe_session_id: stripeSessionId, credits_granted: grant });
  return { granted: grant };
}

/** One-time pack purchase: add credits to the never-expiring purchased pool. */
export async function grantPack(
  base44: any, userId: string, credits: number,
  anchorId: string, stripeSessionId: string, stripeEventId: string,
) {
  if (await hasProcessed(base44, anchorId)) return { already: true };
  const balance = await getBalance(base44, userId);
  await base44.asServiceRole.entities.CreditBalance.update(balance.id, {
    purchased_credits: (balance.purchased_credits || 0) + credits,
  });
  await recordProcessed(base44, { anchor_id: anchorId, user_id: userId, kind: 'pack', stripe_event_id: stripeEventId, stripe_session_id: stripeSessionId, credits_granted: credits });
  return { granted: credits };
}

/** Renewal (invoice.payment_succeeded): grant only if the period changed, so
 *  this and the daily cron can't double-grant the same month. */
export async function grantRenewal(
  base44: any, userId: string, tier: string, invoiceId: string, periodStart: number,
) {
  if (await hasProcessed(base44, invoiceId)) return { already: true };
  const balance = await getBalance(base44, userId);
  const monthKey = periodKey(periodStart ? new Date(periodStart * 1000) : new Date());
  if (balance.tier === tier && balance.period_key === monthKey) return { skipped: 'same_period' };
  const grant = TIER_GRANT[tier] || 0;
  await base44.asServiceRole.entities.CreditBalance.update(balance.id, {
    tier,
    subscription_credits: grant,
    period_key: monthKey,
    last_grant_date: todayStr(periodStart ? new Date(periodStart * 1000) : new Date()),
  });
  await recordProcessed(base44, { anchor_id: invoiceId, user_id: userId, kind: 'subscription_renewal', credits_granted: grant });
  return { granted: grant };
}

/** Plan change (subscription.updated): sync tier, no credit grant. */
export async function syncTier(base44: any, userId: string, tier: string, subscriptionId: string, anchorId: string) {
  if (anchorId && await hasProcessed(base44, anchorId)) return { already: true };
  const balance = await getBalance(base44, userId);
  if (balance.tier === tier && balance.stripe_subscription_id === subscriptionId) return { skipped: 'no_change' };
  await base44.asServiceRole.entities.CreditBalance.update(balance.id, { tier, stripe_subscription_id: subscriptionId });
  if (anchorId) await recordProcessed(base44, { anchor_id: anchorId, user_id: userId, kind: 'tier_sync' });
  return { synced: tier };
}

/** Cancellation (subscription.deleted): Stripe fires this at period end for
 *  cancel_at_period_end, so dropping to free here is "at period end". Purchased
 *  credits are never touched. */
export async function downgradeAtPeriodEnd(base44: any, userId: string, subscriptionId: string, anchorId: string) {
  if (anchorId && await hasProcessed(base44, anchorId)) return { already: true };
  const balance = await getBalance(base44, userId);
  await base44.asServiceRole.entities.CreditBalance.update(balance.id, {
    tier: 'free',
    stripe_subscription_id: '',
    subscription_credits: 0,
  });
  if (anchorId) await recordProcessed(base44, { anchor_id: anchorId, user_id: userId, kind: 'downgrade' });
  return { downgraded: true };
}

// --------------------------------------------- subscription → user/tier ------

export async function userIdForSubscription(base44: any, subId: string): Promise<string | null> {
  const rows = await base44.asServiceRole.entities.CreditBalance.filter({ stripe_subscription_id: subId });
  return rows?.[0]?.user_id || null;
}

export async function tierFromSubscription(base44: any, subId: string): Promise<string | null> {
  const sub = await stripeGet(`subscriptions/${subId}?expand[]=items.data.price`);
  return sub?.items?.data?.[0]?.price?.metadata?.cedar_tier || null;
}

// --------------------------------------- webhook signature verification ------

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Verify a Stripe-Signature header against the raw request body. Manual HMAC
 *  via Web Crypto so we don't depend on the Stripe SDK. */
export async function verifyStripeSignature(body: string, sigHeader: string, secret: string, toleranceSec = 300): Promise<{ ok: boolean; reason?: string }> {
  if (!sigHeader || !secret) return { ok: false, reason: 'missing' };
  let t: string | null = null;
  const sigs: string[] = [];
  for (const piece of sigHeader.split(',')) {
    const [k, v] = piece.split('=');
    if (k === 't') t = v;
    else if (k === 'v1' && v) sigs.push(v);
  }
  if (!t || sigs.length === 0) return { ok: false, reason: 'malformed' };
  const age = Math.abs(Date.now() / 1000 - Number(t));
  if (age > toleranceSec) return { ok: false, reason: 'expired' };
  const expected = await hmacHex(secret, `${t}.${body}`);
  for (const s of sigs) {
    if (s.length !== expected.length) continue;
    let diff = 0;
    for (let i = 0; i < s.length; i++) diff |= s.charCodeAt(i) ^ expected.charCodeAt(i);
    if (diff === 0) return { ok: true };
  }
  return { ok: false, reason: 'signature_mismatch' };
}