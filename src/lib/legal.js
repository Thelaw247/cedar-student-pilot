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

export const LEGAL_VERSION = '2026-08-31';

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
export const PRIVACY_EFFECTIVE_DATE = 'August 2, 2026';
