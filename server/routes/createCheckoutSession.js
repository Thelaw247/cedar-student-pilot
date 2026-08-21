import express from 'express';
import crypto from 'node:crypto';
import { requireAuth } from '../middleware/requireAuth.js';
import { pool } from '../lib/db.js';
import { getBalance } from '../lib/credits.js';
import { stripePost, ensureCustomer, appOrigin, appId } from '../lib/stripe.js';
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
      integration_identifier: `cedar_checkout_${crypto.randomBytes(6).toString('hex')}`,
      'metadata[base44_app_id]': appId(),
      'metadata[user_id]': user.id,
      success_url: `${ORIGIN}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${ORIGIN}/settings`,
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
      });
    } else {
      return res.status(400).json({ error: 'Provide a tier or a pack' });
    }

    const balance = await getBalance(user.id);
    const customerId = await ensureCustomer(user, balance);
    params.customer = customerId;

    const session = await stripePost('checkout/sessions', params, crypto.randomUUID());
    res.json({ url: session.url });
  } catch (error) {
    console.error('[createCheckoutSession]', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
