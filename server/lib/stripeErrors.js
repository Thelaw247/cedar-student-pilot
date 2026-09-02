// Classifiers for Stripe error messages. Kept in their own module (no db/pool
// imports) so routes and tests can pull them in cheaply.

// True when Stripe rejected a request because the customer id we sent does not
// exist in the current account+mode — most often a test-mode id reaching a live
// key after go-live, but also a deleted customer or an account switch. Stripe's
// message is stable ("No such customer: 'cus_…'"); match on it so the caller can
// recreate the customer and retry instead of hard-failing the checkout.
export function isNoSuchCustomer(error) {
  return /No such customer/i.test(error?.message || '');
}
