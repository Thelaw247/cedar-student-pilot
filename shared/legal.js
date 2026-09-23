/**
 * Single source of truth for the legal documents.
 *
 * LEGAL_VERSION is what gets recorded against an account at signup, so it has
 * to change whenever either document changes materially — otherwise a user's
 * stored consent points at wording they never saw. Bump it and the effective
 * date of whichever document changed, in the same commit as the change itself.
 *
 * The dates are rendered on the pages; the version is never shown, it is only
 * stored. Same pattern as tiers.js: one place, so the page and the recorded
 * consent cannot drift apart.
 */

export const LEGAL_VERSION = '2026-09-22';

/**
 * The address a user can actually reach a person at.
 *
 * Both legal documents told people to "reach out through the in-app support
 * link", and two error messages said "contact support". None of it existed —
 * there was no support link, route or address anywhere in the app, so every one
 * of those was a dead end. Stripe's business profile and App Store Connect both
 * want a reachable support contact as well, so it lives here once rather than
 * being typed into five places that then drift.
 */
export const SUPPORT_EMAIL = 'help@praelecta.ca';
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;

export const TERMS_EFFECTIVE_DATE = 'August 31, 2026';
export const PRIVACY_EFFECTIVE_DATE = 'September 22, 2026';

/**
 * The money-back guarantee, or none.
 *
 * The 22 Sep 2026 audit (D3.4) asked for an explicit guarantee with specific
 * terms next to the primary button, and suggested thirty days. A guarantee
 * is a promise the business has to keep on every semester plan sold, so it
 * is not switched on by a code change: set MONEY_BACK_DAYS to the number of
 * days and, from one sentence here, the callout appears under both payment
 * trust lines (PaymentTrustLine.jsx) and the terms gain the matching clause
 * (Terms.jsx). While it is 0, nothing about a guarantee is shown or promised
 * anywhere — the existing refund line ("if something we charged you for
 * didn't work, we'll refund it") stands on its own. Bump TERMS_EFFECTIVE_DATE
 * and LEGAL_VERSION in the same commit that turns it on.
 */
export const MONEY_BACK_DAYS = 0;

/** The audit's own line, or null while there is no guarantee to state. */
export const moneyBackGuarantee = () => (MONEY_BACK_DAYS > 0
  ? `${MONEY_BACK_DAYS}-day money-back if it doesn't work for your class — no questions, no support ticket.`
  : null);
