import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { resetPublicReviewsCache } from './publicReviews.js';

/**
 * POST /owner-reviews — the founder's review queue, admins only.
 *
 * {}                       → every review, the ones waiting for a check first
 * { id, approve: true }    → show it on praelecta.ca (only if the student
 *                            consented and there are words to show)
 * { id, approve: false }   → take it off the site; the rating still counts
 *
 * approved_at is the one column on app_reviews a student cannot write
 * (column grants in the migration), so this route is the only way a review
 * reaches the website. Approving does not touch the rating, the words or the
 * consent; it is a yes or no on what the student wrote.
 */

const router = express.Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function decideReview(db, id, approve) {
  if (!UUID.test(String(id || ''))) return { status: 400, error: 'A review id is required.' };
  if (approve) {
    const { rows } = await db.query(
      `update app_reviews
          set approved_at = now()
        where id = $1
          and may_publish
          and not declined
          and rating is not null
          and btrim(coalesce(body, '')) <> ''
        returning id`,
      [id],
    );
    if (!rows.length) {
      return { status: 409, error: 'This review cannot be shown: the student did not agree to it being public, or there are no words to show.' };
    }
  } else {
    await db.query('update app_reviews set approved_at = null where id = $1', [id]);
  }
  resetPublicReviewsCache();
  return { status: 200 };
}

export async function listReviews(db) {
  const { rows } = await db.query(
    `select r.id, r.rating, r.body, r.display_name, r.detail, r.school,
            r.may_publish, r.declined, r.approved_at, r.created_at, r.updated_at,
            u.email, p.full_name
       from app_reviews r
       join auth.users u on u.id = r.user_id
       left join profiles p on p.id = r.user_id
      order by (r.may_publish and r.approved_at is null and r.rating is not null) desc,
               r.updated_at desc`,
  );
  const rated = rows.filter((r) => r.rating != null);
  const average = rated.length ? Math.round((rated.reduce((s, r) => s + Number(r.rating), 0) / rated.length) * 100) / 100 : null;
  return {
    reviews: rows,
    summary: {
      ratings: rated.length,
      average,
      waiting: rows.filter((r) => r.may_publish && !r.approved_at && r.rating != null).length,
      shown: rows.filter((r) => r.may_publish && r.approved_at).length,
      declined: rows.filter((r) => r.declined).length,
    },
  };
}

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id, approve } = req.body || {};
    if (id !== undefined) {
      const decision = await decideReview(pool, id, approve === true);
      if (decision.status !== 200) return res.status(decision.status).json({ error: decision.error });
    }
    res.json(await listReviews(pool));
  } catch (error) {
    console.error('[owner-reviews]', error.message);
    res.status(500).json({ error: 'Could not load the reviews.' });
  }
});

export default router;
