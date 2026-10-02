import express from 'express';
import { pool } from '../lib/db.js';

/**
 * GET /public/reviews — student reviews for the homepage.
 *
 * No auth, like /public/stats. Returns the reviews a student agreed to show
 * (may_publish) AND the founder has checked (approved_at), newest check
 * first, and the average of EVERY rating in the table — shown or not — so
 * the number on the homepage is the honest average rather than the average
 * of the quotes that were picked. The page decides when that average is
 * worth showing (shared/reviews.js, MIN_RATINGS_FOR_AVERAGE).
 *
 * Only the words, the first name, the course and the school leave the
 * database; never an id, an email or a date. Cached in memory like the
 * stats, so a visit is not a query; owner-reviews clears the cache when a
 * review is approved or hidden.
 */

const router = express.Router();

export const REVIEWS_TTL_MS = 10 * 60 * 1000;
export const PUBLIC_REVIEWS_LIMIT = 12;

let cached = { at: 0, value: null };

export async function loadPublicReviews(db, { limit = PUBLIC_REVIEWS_LIMIT } = {}) {
  const [shown, totals] = await Promise.all([
    db.query(
      `select rating, body, display_name, detail, school
         from app_reviews
        where approved_at is not null
          and may_publish
          and not declined
          and rating is not null
          and btrim(coalesce(body, '')) <> ''
        order by approved_at desc
        limit $1`,
      [limit],
    ),
    db.query(
      `select count(rating)::int as count, avg(rating)::float8 as average
         from app_reviews
        where rating is not null`,
    ),
  ]);
  const row = totals.rows[0] || {};
  const count = Number(row.count || 0);
  return {
    count,
    average: count > 0 ? Math.round(Number(row.average) * 100) / 100 : null,
    reviews: shown.rows.map((r) => ({
      rating: Number(r.rating),
      quote: r.body,
      name: r.display_name,
      detail: r.detail || null,
      school: r.school || null,
    })),
  };
}

export async function publicReviews(db, { now = Date.now, ttl = REVIEWS_TTL_MS } = {}) {
  const at = now();
  if (cached.value && at - cached.at < ttl) return cached.value;
  const value = await loadPublicReviews(db);
  cached = { at, value };
  return value;
}

/** Forget the cached reviews: called after an approval, and by the tests. */
export function resetPublicReviewsCache() {
  cached = { at: 0, value: null };
}

router.get('/reviews', async (req, res) => {
  try {
    const reviews = await publicReviews(pool);
    res.set('Cache-Control', 'public, max-age=600');
    res.json(reviews);
  } catch (error) {
    console.error('[public-reviews]', error.message);
    res.status(503).json({ error: 'reviews unavailable' });
  }
});

export default router;
