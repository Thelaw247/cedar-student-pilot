import { base44 } from '@/api/base44Client';

/**
 * Start a Stripe checkout from anywhere in the app.
 *
 * One implementation so the UpgradeSheet, the Subscription page and the
 * Settings panel can never drift on how checkout begins. The payload is
 * { tier, billing_period } or { pack }; the server resolves the real Stripe
 * price (the client never sends one — see tiers.js header).
 *
 * Throws with a user-readable message; callers decide how to display it.
 */
export async function startCheckout(payload) {
  if (window.self !== window.top) {
    throw new Error('Checkout only works from the published app. Open Praelecta in a new tab to complete your purchase.');
  }
  const res = await base44.functions.invoke('createCheckoutSession', payload);
  const url = res?.data?.url || res?.data?.checkout_url;
  if (!url) throw new Error(res?.data?.error || 'Could not start checkout. Please try again.');
  window.location.href = url;
}
