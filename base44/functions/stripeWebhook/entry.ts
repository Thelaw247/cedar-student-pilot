import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { secrets } from 'base44:runtime';
import {
  appId,
  verifyStripeSignature,
  grantSubscriptionInitial,
  grantPack,
  grantRenewal,
  syncTier,
  downgradeAtPeriodEnd,
  subscriptionContext,
  userIdForSubscription,
} from '../../shared/stripe.ts';

/**
 * Signed, retry-safe Stripe fulfillment endpoint.
 *
 * Initial purchases are fulfilled only from a paid Checkout Session. Renewals
 * and paid mid-period upgrades are fulfilled from paid invoices. Every balance
 * change and its Stripe anchor are one conditional database update, so webhook
 * retries and the success-page confirmation safely converge.
 */
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const raw = await req.text();
    const signature = req.headers.get('stripe-signature') || '';
    const secret = secrets.get('STRIPE_WEBHOOK_SECRET');
    if (!secret) {
      console.error('[stripeWebhook] STRIPE_WEBHOOK_SECRET not configured');
      return Response.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    const verified = await verifyStripeSignature(raw, signature, secret);
    if (!verified.ok) {
      return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(raw);
    const data = event.data?.object;
    const eventId = event.id;
    const ourAppId = appId();
    const eventAppId = data?.metadata?.base44_app_id;

    if (eventAppId && eventAppId !== ourAppId) {
      return Response.json({ received: true, ignored: 'different_app' });
    }

    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        // completed can precede settlement for delayed payment methods.
        if (data?.payment_status !== 'paid') break;
        if (data?.metadata?.base44_app_id !== ourAppId) {
          return Response.json({ received: true, ignored: 'unscoped_checkout' });
        }

        const userId = data?.metadata?.user_id;
        if (!userId) throw new Error('Paid Cedar checkout is missing user metadata');

        if (data.mode === 'subscription') {
          const tier = data?.metadata?.cedar_tier || data?.metadata?.tier;
          const period = data?.metadata?.cedar_period || data?.metadata?.period;
          if (!tier) throw new Error('Paid Cedar subscription is missing tier metadata');
          await grantSubscriptionInitial(
            base44,
            userId,
            tier,
            period,
            data.id,
            data.id,
            eventId,
            data.subscription || '',
          );
        } else if (data.mode === 'payment') {
          const credits = Number(data?.metadata?.cedar_credits || 0);
          if (!credits) throw new Error('Paid Cedar pack is missing credit metadata');
          await grantPack(base44, userId, credits, data.id, data.id, eventId);
        }
        break;
      }

      case 'checkout.session.async_payment_failed': {
        console.warn('[stripeWebhook] delayed checkout payment failed', data?.id);
        break;
      }

      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const billingReason = data?.billing_reason;
        // Initial access is granted from the paid Checkout Session. Handling
        // subscription_create here as well would create a second anchor for the
        // same first payment and could restore credits spent between events.
        if (billingReason !== 'subscription_cycle' && billingReason !== 'subscription_update') {
          break;
        }

        const subscriptionRef =
          data?.subscription ||
          data?.parent?.subscription_details?.subscription;
        const subscriptionId = typeof subscriptionRef === 'string'
          ? subscriptionRef
          : subscriptionRef?.id;
        if (!subscriptionId) break;

        const context = await subscriptionContext(base44, subscriptionId);
        const subscriptionAppId = context.subscription?.metadata?.base44_app_id;
        if (subscriptionAppId && subscriptionAppId !== ourAppId) {
          return Response.json({ received: true, ignored: 'different_app' });
        }
        if (!context.userId || !context.tier) {
          throw new Error('Paid Cedar invoice could not be mapped to a user and tier');
        }

        if (billingReason === 'subscription_update') {
          await syncTier(
            base44,
            context.userId,
            context.tier,
            subscriptionId,
            data.id || eventId,
          );
        } else {
          const periodStart =
            Number(data?.period_start || 0) ||
            Number(data?.lines?.data?.[0]?.period?.start || 0);
          await grantRenewal(
            base44,
            context.userId,
            context.tier,
            data.id,
            periodStart,
            subscriptionId,
          );
        }
        break;
      }

      case 'customer.subscription.updated': {
        // Do not grant or change the paid tier merely because a subscription
        // object changed. A paid subscription_update invoice is the proof for
        // an upgrade; a later cycle invoice applies a scheduled downgrade.
        break;
      }

      case 'customer.subscription.deleted': {
        const subscriptionId = data?.id;
        if (!subscriptionId) break;
        const userId =
          data?.metadata?.user_id ||
          await userIdForSubscription(base44, subscriptionId);
        if (!userId) break;
        await downgradeAtPeriodEnd(base44, userId, subscriptionId, eventId);
        break;
      }

      case 'invoice.payment_failed': {
        console.warn('[stripeWebhook] invoice.payment_failed for subscription',
          data?.subscription || data?.parent?.subscription_details?.subscription);
        break;
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    // A 500 makes Stripe retry. Because fulfillment is anchored atomically on
    // CreditBalance, a retry repairs partial audit work without double-granting.
    console.error('[stripeWebhook]', (error as Error).message);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
