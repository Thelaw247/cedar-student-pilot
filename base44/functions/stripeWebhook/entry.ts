import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { secrets } from 'base44:runtime';
import { getBalance } from '../../shared/credits.ts';
import {
  verifyStripeSignature, grantSubscriptionInitial, grantPack,
  grantRenewal, syncTier, downgradeAtPeriodEnd, userIdForSubscription, tierFromSubscription,
} from '../../shared/stripe.ts';

/**
 * The authoritative grant path for subscription renewals. From month two
 * onward, invoice.payment_succeeded is the ONLY signal that a student paid —
 * a renewal has no redirect. Without this, every subscriber's credits would
 * silently stop topping up while their card kept being charged.
 *
 * This is a public endpoint at /functions/stripeWebhook. Every request is
 * treated as hostile: the Stripe signature is verified against
 * STRIPE_WEBHOOK_SECRET (read inside the handler, never at module top level)
 * and unsigned requests are rejected with 400. Every grant is idempotent via
 * the ProcessedStripeEvent ledger, so Stripe retries never double-grant.
 */
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const raw = await req.text();
    const sig = req.headers.get('stripe-signature') || '';
    const secret = secrets.get('STRIPE_WEBHOOK_SECRET'); // per-request, never module-level
    if (!secret) {
      console.error('[stripeWebhook] STRIPE_WEBHOOK_SECRET not configured');
      return Response.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    const verified = await verifyStripeSignature(raw, sig, secret);
    if (!verified.ok) return Response.json({ error: 'Invalid signature' }, { status: 400 });

    const event = JSON.parse(raw);
    const data = event.data?.object;
    const eventId = event.id;

    // Multi-app Stripe account guard.
    //
    // This Stripe account (acct_1ToUnnRecX8K7mfK) is shared with the separate
    // "Cedar Pilot" Base44 app, which has its own live webhook endpoint
    // subscribed to checkout.session.completed. Both apps therefore receive
    // each other's events. Everything this app creates is stamped with
    // metadata.base44_app_id, so an event carrying a DIFFERENT app id is not
    // ours and must be ignored.
    //
    // Only rejects on a positive mismatch: events with no app id (e.g. invoices,
    // which do not inherit subscription metadata) fall through to the handlers
    // below, which resolve ownership via our own CreditBalance table anyway.
    const OUR_APP_ID = Deno.env.get('BASE44_APP_ID') || '';
    const eventAppId = data?.metadata?.base44_app_id;
    if (OUR_APP_ID && eventAppId && eventAppId !== OUR_APP_ID) {
      return Response.json({ received: true, ignored: 'different_app' });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const userId = data?.metadata?.user_id;
        if (!userId) break;
        const anchor = data.id; // session id — shared with confirmCheckoutSession
        if (data.mode === 'subscription') {
          const tier = data?.metadata?.cedar_tier || data?.metadata?.tier;
          const period = data?.metadata?.cedar_period || data?.metadata?.period;
          if (!tier) break;
          const bal = await getBalance(base44, userId);
          if (data.subscription && !bal.stripe_subscription_id) {
            await base44.asServiceRole.entities.CreditBalance.update(bal.id, { stripe_subscription_id: data.subscription });
          }
          await grantSubscriptionInitial(base44, userId, tier, period, anchor, data.id, eventId);
        } else {
          const credits = Number(data?.metadata?.cedar_credits || 0);
          if (credits) await grantPack(base44, userId, credits, anchor, data.id, eventId);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        // Only subscription renewals / initial invoices. One-off packs are
        // handled by checkout.session.completed (mode=payment has no recurring
        // invoice with these billing reasons).
        if (data?.billing_reason !== 'subscription_cycle' && data?.billing_reason !== 'subscription_create') break;
        const subId = data?.subscription;
        if (!subId) break;
        const userId = await userIdForSubscription(base44, subId);
        if (!userId) break; // checkout.session.completed hasn't landed yet; it will grant
        const tier = await tierFromSubscription(base44, subId);
        if (!tier) break;
        await grantRenewal(base44, userId, tier, data.id, data.period_start);
        break;
      }

      case 'customer.subscription.updated': {
        const subId = data?.id;
        const userId = await userIdForSubscription(base44, subId);
        if (!userId) break;
        const tier = await tierFromSubscription(base44, subId);
        if (!tier) break;
        await syncTier(base44, userId, tier, subId, eventId);
        break;
      }

      case 'customer.subscription.deleted': {
        const subId = data?.id;
        const userId = await userIdForSubscription(base44, subId);
        if (!userId) break;
        // Stripe fires .deleted at period end for cancel_at_period_end, so
        // this downgrade happens at period end, not at cancellation time.
        await downgradeAtPeriodEnd(base44, userId, subId, eventId);
        break;
      }

      case 'invoice.payment_failed': {
        // Grace window: keep access, do not clear credits. Stripe will retry.
        console.warn('[stripeWebhook] invoice.payment_failed for subscription', data?.subscription);
        break;
      }
    }

    return Response.json({ received: true });
  } catch (e) {
    console.error('[stripeWebhook]', (e as Error).message);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}