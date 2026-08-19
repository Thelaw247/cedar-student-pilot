import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { getBalance, availableCredits } from '../../shared/credits.ts';
import { stripeGet, grantSubscriptionInitial, grantPack } from '../../shared/stripe.ts';

/**
 * The instant-feedback path fired by the checkout success page.
 *
 * Retrieves the session FROM STRIPE and checks payment_status === 'paid'. The
 * redirect itself is never trusted — anyone can paste the success URL. The
 * session's metadata.user_id must match the authenticated caller.
 *
 * This is NOT the only grant path: stripeWebhook also grants on
 * checkout.session.completed. Both share the session id as the idempotency
 * anchor, so whichever arrives first wins and the other is a no-op.
 */
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const sessionId = body?.session_id;
    if (!sessionId) return Response.json({ error: 'session_id is required' }, { status: 400 });

    const session = await stripeGet(`checkout/sessions/${sessionId}`);

    if (session.payment_status !== 'paid') {
      return Response.json({ error: 'Payment not confirmed yet' }, { status: 402 });
    }

    // A success URL is not proof of identity. The session must belong to the
    // caller, verified by the metadata we stamped at checkout creation.
    if (session.metadata?.user_id !== user.id) {
      return Response.json({ error: 'This checkout session does not belong to you' }, { status: 403 });
    }

    if (session.mode === 'subscription') {
      const tier = session.metadata?.cedar_tier || session.metadata?.tier;
      const period = session.metadata?.cedar_period || session.metadata?.period;
      if (!tier) return Response.json({ error: 'Missing tier metadata' }, { status: 400 });

      // The subscription id and the initial allowance are written in the same
      // atomic fulfillment update.
      await grantSubscriptionInitial(
        base44,
        user.id,
        tier,
        period,
        sessionId,
        sessionId,
        '',
        session.subscription || '',
      );
    } else {
      const credits = Number(session.metadata?.cedar_credits || 0);
      if (!credits) return Response.json({ error: 'Missing pack metadata' }, { status: 400 });
      await grantPack(base44, user.id, credits, sessionId, sessionId, '');
    }

    const balance = await getBalance(base44, user.id);
    return Response.json({
      ok: true,
      tier: balance.tier,
      available: availableCredits(balance),
      purchased: balance.purchased_credits || 0,
      subscription: balance.subscription_credits || 0,
    });
  } catch (e) {
    console.error('[confirmCheckoutSession]', (e as Error).message);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}