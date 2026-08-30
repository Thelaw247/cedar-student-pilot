import express from 'express';
import { pool } from '../lib/db.js';
import {
  appId, verifyStripeSignature, grantSubscriptionInitial, grantPack,
  grantRenewal, syncTier, downgradeAtPeriodEnd, subscriptionContext, stripeGet,
  userIdForSubscription,
} from '../lib/stripe.js';
import { checkoutEntitlement, expectedStripeMode } from '../lib/stripePrices.js';

// Direct port of base44/functions/stripeWebhook/entry.ts. Route logic,
// event-type handling, and metadata contract are unchanged — only the
// transport (Express route instead of a Deno.serve function) and the
// fulfillment primitive underneath (see lib/stripe.js) differ.
//
// IMPORTANT: this route needs the RAW request body for signature
// verification, so it must be mounted with express.raw(), never
// express.json() — see server/index.js.

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const raw = req.body.toString('utf8'); // express.raw() gives us a Buffer
    const signature = req.headers['stripe-signature'] || '';
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[stripeWebhook] STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    const verified = verifyStripeSignature(raw, signature, secret);
    if (!verified.ok) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(raw);
    const expectedMode = expectedStripeMode();
    if (Boolean(event.livemode) !== (expectedMode === 'live')) {
      return res.status(400).json({ error: `Webhook event does not match Stripe ${expectedMode} mode` });
    }
    const data = event.data?.object;
    const eventId = event.id;
    const ourAppId = appId();
    const eventAppId = data?.metadata?.base44_app_id;

    if (eventAppId && eventAppId !== ourAppId) {
      return res.json({ received: true, ignored: 'different_app' });
    }

    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        if (data?.payment_status !== 'paid') break;
        // Stripe webhook payloads do not reliably expand line_items. Re-fetch
        // the signed event's session and derive the entitlement from its Price,
        // never from user-visible or Dashboard-editable metadata values.
        const session = await stripeGet(`checkout/sessions/${encodeURIComponent(data.id)}?expand[]=line_items.data.price`);
        if (session.payment_status !== 'paid') break;
        if (session?.metadata?.base44_app_id !== ourAppId) {
          return res.json({ received: true, ignored: 'unscoped_checkout' });
        }
        const userId = session?.metadata?.user_id;
        if (!userId) throw new Error('Paid Praelecta checkout is missing user metadata');
        const entitlement = checkoutEntitlement(session);

        if (entitlement.kind === 'subscription') {
          await grantSubscriptionInitial(userId, entitlement.tier, entitlement.period, session.id, session.id, eventId, session.subscription || '');
        } else {
          await grantPack(userId, entitlement.credits, session.id, session.id, eventId);
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
        if (billingReason !== 'subscription_cycle' && billingReason !== 'subscription_update') break;

        const subscriptionRef = data?.subscription || data?.parent?.subscription_details?.subscription;
        const subscriptionId = typeof subscriptionRef === 'string' ? subscriptionRef : subscriptionRef?.id;
        if (!subscriptionId) break;

        const context = await subscriptionContext(subscriptionId);
        const subscriptionAppId = context.subscription?.metadata?.base44_app_id;
        if (subscriptionAppId && subscriptionAppId !== ourAppId) {
          return res.json({ received: true, ignored: 'different_app' });
        }
        if (!context.userId || !context.tier) {
          throw new Error('Paid Praelecta invoice could not be mapped to a user and tier');
        }

        if (billingReason === 'subscription_update') {
          await syncTier(context.userId, context.tier, subscriptionId, data.id || eventId);
        } else {
          const periodStart = Number(data?.period_start || 0) || Number(data?.lines?.data?.[0]?.period?.start || 0);
          await grantRenewal(context.userId, context.tier, data.id, periodStart, subscriptionId);
        }
        break;
      }

      case 'customer.subscription.updated': {
        // Do not grant or change the paid tier merely because the subscription
        // object changed. A paid subscription_update invoice is the proof for
        // an upgrade; a later cycle invoice applies a scheduled downgrade.
        break;
      }

      case 'customer.subscription.deleted': {
        const subscriptionId = data?.id;
        if (!subscriptionId) break;
        const userId = data?.metadata?.user_id || await userIdForSubscription(subscriptionId);
        if (!userId) break;
        await downgradeAtPeriodEnd(userId, subscriptionId, eventId);
        break;
      }

      case 'invoice.payment_failed': {
        console.warn('[stripeWebhook] invoice.payment_failed for subscription',
          data?.subscription || data?.parent?.subscription_details?.subscription);
        break;
      }
    }

    return res.json({ received: true });
  } catch (error) {
    // A 500 makes Stripe retry. Fulfillment is anchored atomically inside a
    // Postgres transaction, so a retry repairs partial audit work without
    // double-granting.
    console.error('[stripeWebhook]', error.message);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
