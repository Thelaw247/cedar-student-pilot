import express from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { getBalance, availableCredits } from '../lib/credits.js';
import { appId, stripeGet, grantSubscriptionInitial, grantPack } from '../lib/stripe.js';
import { checkoutEntitlement } from '../lib/stripePrices.js';

// Direct port of base44/functions/confirmCheckoutSession/entry.ts. The
// redirect is never trusted — this re-fetches the session FROM Stripe and
// checks payment_status itself. Shares the session id as the idempotency
// anchor with stripeWebhook, so whichever path runs first wins; the other
// is a safe no-op.

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const sessionId = req.body?.session_id;
    if (!sessionId) return res.status(400).json({ error: 'session_id is required' });

    const session = await stripeGet(`checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=line_items.data.price`);
    if (session.payment_status !== 'paid') return res.status(402).json({ error: 'Payment not confirmed yet' });
    if (session.metadata?.base44_app_id !== appId()) {
      return res.status(403).json({ error: 'This checkout session does not belong to Cedar' });
    }
    if (session.metadata?.user_id !== user.id) {
      return res.status(403).json({ error: 'This checkout session does not belong to you' });
    }

    const entitlement = checkoutEntitlement(session);
    if (entitlement.kind === 'subscription') {
      await grantSubscriptionInitial(user.id, entitlement.tier, entitlement.period, sessionId, sessionId, '', session.subscription || '');
    } else {
      await grantPack(user.id, entitlement.credits, sessionId, sessionId, '');
    }

    const balance = await getBalance(user.id);
    res.json({
      ok: true, tier: balance.tier, available: availableCredits(balance),
      purchased: balance.purchased_credits || 0, subscription: balance.subscription_credits || 0,
    });
  } catch (error) {
    console.error('[confirmCheckoutSession]', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
