import express from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { getBalance } from '../lib/credits.js';
import {
  stripePost, ensureCustomer, appOrigin, appId, checkoutIntegrationIdentifier,
} from '../lib/stripe.js';
import { isNoSuchCustomer } from '../lib/stripeErrors.js';
import { subscriptionPrices, packPrices, VALID_TIERS, VALID_PACKS, VALID_PERIODS } from '../lib/stripePrices.js';

// Direct port of base44/functions/createCheckoutSession/entry.ts. Price is
// resolved server-side from tier/pack id — NEVER from client input.
// Entitlement is granted by stripeWebhook / confirmCheckoutSession, not here.

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { tier, billing_period, pack } = req.body || {};
    const ORIGIN = appOrigin();

    const params = {
      integration_identifier: checkoutIntegrationIdentifier(),
      'metadata[base44_app_id]': appId(),
      'metadata[user_id]': user.id,
      success_url: `${ORIGIN}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${ORIGIN}/settings`,
      // Finishing copy on hosted Checkout (branding pass, Aug 2026): the
      // same honest reassurance the app shows beside every price. Stays
      // accurate for both modes — the pack line is set below.
      'custom_text[submit][message]': 'Cancel anytime — you keep your plan until the period ends. Prices in CAD.',
      // Show the "Add promotion code" field on hosted Checkout. Without this
      // Stripe hides it entirely, so a coupon created in the dashboard has no
      // way in and a student who was given a code cannot use it. Codes are
      // still defined and constrained entirely in Stripe (amount, expiry,
      // first-time-only, redemption cap) -- this only decides whether the
      // field is rendered. Applies to both modes: subscriptions and packs.
      allow_promotion_codes: 'true',
    };

    if (tier) {
      if (!VALID_TIERS.has(tier)) return res.status(400).json({ error: 'Invalid tier' });
      const period = billing_period || 'semester';
      if (!VALID_PERIODS.has(period)) return res.status(400).json({ error: 'Invalid billing period' });
      const priceId = period === 'monthly' ? subscriptionPrices()[tier].monthly : subscriptionPrices()[tier].semester;
      Object.assign(params, {
        mode: 'subscription',
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        'metadata[cedar_kind]': 'subscription',
        'metadata[cedar_tier]': tier,
        'metadata[cedar_period]': period,
        'subscription_data[metadata][base44_app_id]': appId(),
        'subscription_data[metadata][user_id]': user.id,
        'subscription_data[metadata][cedar_tier]': tier,
        'subscription_data[metadata][cedar_period]': period,
      });
    } else if (pack) {
      if (!VALID_PACKS.has(pack)) return res.status(400).json({ error: 'Invalid pack' });
      const p = packPrices()[pack];
      Object.assign(params, {
        mode: 'payment',
        'line_items[0][price]': p.priceId,
        'line_items[0][quantity]': '1',
        'metadata[cedar_kind]': 'pack',
        'metadata[cedar_pack]': pack,
        'metadata[cedar_credits]': String(p.credits),
        // One-time purchase — the subscription reassurance would be wrong here.
        'custom_text[submit][message]': 'One-time purchase — credits never expire. Prices in CAD.',
      });
    } else {
      return res.status(400).json({ error: 'Provide a tier or a pack' });
    }

    const balance = await getBalance(user.id);
    params.customer = await ensureCustomer(user, balance);

    let session;
    try {
      session = await stripePost('checkout/sessions', params, crypto.randomUUID());
    } catch (error) {
      // The stored customer id can belong to another Stripe mode or account —
      // a test-mode id left over from pre-launch testing is the common one, and
      // it fails every live checkout with "No such customer" until cleared. Mint
      // a fresh customer for this account+mode and retry once, so a stale id
      // self-heals on the next attempt instead of blocking the student.
      if (!isNoSuchCustomer(error)) throw error;
      console.warn('[createCheckoutSession] stored customer rejected, recreating:', error.message);
      // Pass a balance with the stored id cleared: ensureCustomer then creates a
      // fresh customer for the current account+mode and overwrites the dead
      // pointer in credit_balances, so the next attempt already has a good id.
      params.customer = await ensureCustomer(user, { ...balance, stripe_customer_id: null });
      session = await stripePost('checkout/sessions', params, crypto.randomUUID());
    }
    res.json({ url: session.url });
  } catch (error) {
    console.error('[createCheckoutSession]', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
