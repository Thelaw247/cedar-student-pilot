import express from 'express';
import crypto from 'node:crypto';
import { requireAuth } from '../middleware/requireAuth.js';
import { getBalance } from '../lib/credits.js';
import { stripePost, appOrigin } from '../lib/stripe.js';

// Direct port of base44/functions/createPortalSession/entry.ts.

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  try {
    const balance = await getBalance(req.user.id);
    if (!balance.stripe_customer_id) return res.status(400).json({ error: 'No billing account found' });

    // Note: unlike checkout sessions, billing-portal sessions accept NO
    // metadata parameter — sending one made Stripe reject every request
    // with "Received unknown parameter: metadata" (Base44-era carry-over).
    const session = await stripePost('billing_portal/sessions', {
      customer: balance.stripe_customer_id,
      return_url: `${appOrigin()}/settings`,
    }, crypto.randomUUID());

    res.json({ url: session.url });
  } catch (error) {
    console.error('[createPortalSession]', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
