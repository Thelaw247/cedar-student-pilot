import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { getBalance } from '../../shared/credits.ts';
import { stripePost } from '../../shared/stripe.ts';

/**
 * Opens the Stripe Billing Portal for the caller's customer. The hosted portal
 * handles cancellation, plan changes and card updates — we do not hand-build
 * any billing management.
 */
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const balance = await getBalance(base44, user.id);
    if (!balance.stripe_customer_id) {
      return Response.json({ error: 'No billing account found' }, { status: 400 });
    }

    const APP_ID = Deno.env.get('BASE44_APP_ID') || '';
    const session = await stripePost('billing_portal/sessions', {
      customer: balance.stripe_customer_id,
      return_url: 'https://cedar-student-pilot.base44.app/settings',
      'metadata[base44_app_id]': APP_ID,
    }, crypto.randomUUID());

    return Response.json({ url: session.url });
  } catch (e) {
    console.error('[createPortalSession]', (e as Error).message);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}