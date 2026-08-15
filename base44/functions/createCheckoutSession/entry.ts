import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { getBalance } from '../../shared/credits.ts';
import { stripePost, ensureCustomer, appOrigin } from '../../shared/stripe.ts';
import { SUBSCRIPTION_PRICES, PACK_PRICES, VALID_TIERS, VALID_PACKS, VALID_PERIODS } from '../../shared/stripePrices.ts';

/**
 * Creates a Stripe Checkout session for a subscription or a one-time credit pack.
 *
 * The price is resolved server-side from the tier/pack id — NEVER from the
 * client. A caller can send { tier: 'unlimited', amount: 0.01 } and it is
 * ignored: the only inputs that matter are `tier`/`billing_period` or `pack`,
 * which map to a fixed price id here.
 *
 * Entitlement is NOT granted here. It is granted by stripeWebhook and by
 * confirmCheckoutSession (the success page), both of which verify the payment
 * with Stripe. The redirect itself is not proof of payment.
 */
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { tier, billing_period, pack } = body || {};

    const APP_ID = Deno.env.get('BASE44_APP_ID') || '';
    // Set the APP_ORIGIN secret when the custom domain goes live; falls back
    // to the base44.app host. Hardcoding this would send paying students back
    // to the wrong site after checkout.
    const ORIGIN = appOrigin();

    const params: Record<string, any> = {
      'metadata[base44_app_id]': APP_ID,
      'metadata[user_id]': user.id,
      success_url: `${ORIGIN}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${ORIGIN}/settings`,
    };

    if (tier) {
      if (!VALID_TIERS.has(tier)) return Response.json({ error: 'Invalid tier' }, { status: 400 });
      const period = billing_period || 'semester';
      if (!VALID_PERIODS.has(period)) return Response.json({ error: 'Invalid billing period' }, { status: 400 });
      const priceId = period === 'monthly' ? SUBSCRIPTION_PRICES[tier].monthly : SUBSCRIPTION_PRICES[tier].semester;
      params.mode = 'subscription';
      params['line_items[0][price]'] = priceId;
      params['line_items[0][quantity]'] = '1';
      params['metadata[cedar_kind]'] = 'subscription';
      params['metadata[cedar_tier]'] = tier;
      params['metadata[cedar_period]'] = period;
      params['subscription_data[metadata][base44_app_id]'] = APP_ID;
      params['subscription_data[metadata][user_id]'] = user.id;
    } else if (pack) {
      if (!VALID_PACKS.has(pack)) return Response.json({ error: 'Invalid pack' }, { status: 400 });
      const p = PACK_PRICES[pack];
      params.mode = 'payment';
      params['line_items[0][price]'] = p.priceId;
      params['line_items[0][quantity]'] = '1';
      params['metadata[cedar_kind]'] = 'pack';
      params['metadata[cedar_pack]'] = pack;
      params['metadata[cedar_credits]'] = String(p.credits);
    } else {
      return Response.json({ error: 'Provide a tier or a pack' }, { status: 400 });
    }

    const balance = await getBalance(base44, user.id);
    const customerId = await ensureCustomer(base44, user, balance);
    params.customer = customerId;

    const session = await stripePost('checkout/sessions', params, crypto.randomUUID());
    return Response.json({ url: session.url });
  } catch (e) {
    console.error('[createCheckoutSession]', (e as Error).message);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}