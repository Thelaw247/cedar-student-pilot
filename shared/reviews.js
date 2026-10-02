/**
 * Student reviews: the rules the app, the API and the tests all read.
 *
 * A review is a star rating and a short description, asked for inside the
 * app (ReviewPrompt on Today, or Settings → Your review). It becomes social
 * proof on praelecta.ca only with the student's own consent (may_publish,
 * unticked by default) and after the founder has checked the wording
 * (approved_at, set by the API alone — see the app_reviews migration).
 *
 * What keeps this honest, by design rather than by promise:
 *  - Everyone eligible is asked the same question; nobody is steered by the
 *    stars they gave. A low rating goes through the same form as a high one.
 *  - The average on the homepage counts every rating, published or not, and
 *    appears only once there are enough of them to mean something.
 *  - Nothing is rewarded: no credits for a review, so no disclosure owed and
 *    no reason to doubt one.
 *  - The founder's own account is never asked.
 */

export const REVIEW_LIMITS = Object.freeze({ body: 400, display_name: 40, detail: 60, school: 80 });

/** The average is shown from this many ratings up; "5.0 from 2" proves nothing. */
export const MIN_RATINGS_FOR_AVERAGE = 5;

/** A student is asked once they have a processed lecture, or a week in the app. */
export const REVIEW_ASK_AFTER_DAYS = 7;

/** "Not now" means two weeks, on this device. "Don't ask again" is stored. */
export const REVIEW_SNOOZE_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether to ask this student for a review. A processed lecture is the
 * moment the product has done its job for them; a week in the app covers a
 * current student who has set up classes and a schedule but not recorded yet.
 * Someone who signed up five minutes ago is never asked.
 */
export function isReviewEligible({ lectures = [], accountCreatedAt, role, now = Date.now() } = {}) {
  if (role === 'admin') return false;
  if (lectures.some((l) => l?.status === 'complete')) return true;
  const created = Date.parse(accountCreatedAt || '');
  return Number.isFinite(created) && now - created >= REVIEW_ASK_AFTER_DAYS * DAY_MS;
}

/** The name the form suggests: the first word of the profile name. Editable. */
export function suggestedDisplayName(fullName) {
  return String(fullName || '').trim().split(/\s+/)[0] || '';
}

const clean = (value, max) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : null;
};

/**
 * Check the form and shape the row that is written. Returns
 * { ok, errors, row }; errors are keyed by field, in the words the form shows.
 */
export function validateReview(fields = {}) {
  const errors = {};
  const rating = Number(fields.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.rating = 'Pick a rating from 1 to 5 stars.';

  const rawBody = String(fields.body ?? '').trim();
  if (rawBody.length > REVIEW_LIMITS.body) errors.body = `Keep it under ${REVIEW_LIMITS.body} characters.`;
  const body = rawBody ? rawBody.slice(0, REVIEW_LIMITS.body) : null;

  const mayPublish = fields.may_publish === true;
  const displayName = clean(fields.display_name, REVIEW_LIMITS.display_name);
  if (mayPublish && !body) errors.body = 'Add a sentence to show on the website, or untick the box.';
  if (mayPublish && !displayName) errors.display_name = 'Add the name to show next to it.';

  const row = {
    rating: errors.rating ? null : rating,
    body,
    display_name: displayName,
    detail: clean(fields.detail, REVIEW_LIMITS.detail),
    school: clean(fields.school, REVIEW_LIMITS.school),
    may_publish: mayPublish,
    declined: false,
  };
  return { ok: Object.keys(errors).length === 0, errors, row };
}

/**
 * Where a student's own review stands, for Settings:
 * none · declined · private (counts toward the average, not shown) ·
 * pending (consented, waiting for the check) · shown.
 */
export function reviewStatus(row) {
  if (!row) return 'none';
  if (row.declined || row.rating == null) return 'declined';
  if (!row.may_publish) return 'private';
  return row.approved_at ? 'shown' : 'pending';
}

/**
 * The homepage line, from GET /public/reviews: null until there are enough
 * ratings for an average to mean something.
 */
export function ratingSummary(stats) {
  const count = Number(stats?.count) || 0;
  const average = Number(stats?.average);
  if (count < MIN_RATINGS_FOR_AVERAGE || !Number.isFinite(average) || average <= 0) return null;
  const rounded = Math.round(average * 10) / 10;
  return { count, average: rounded, text: `${rounded.toFixed(1)} out of 5 from ${count} students` };
}

/** "PHYS 117, University of Saskatchewan" under a quote. */
export const reviewCaption = (r) => [r?.detail, r?.school].filter(Boolean).join(', ');
