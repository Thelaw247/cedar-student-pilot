import express from 'express';
import { pool } from '../lib/db.js';

/**
 * GET /public/stats — the numbers the landing page shows as proof of use.
 *
 * Aggregates only, no auth: how many students have an account and how many
 * lectures they have recorded. A typed number on the landing page would be
 * out of date the day after it was written; this is read from the database
 * and cached in memory, so the page always shows a true count without a
 * query per visitor. The landing page renders without the numbers when this
 * is unreachable — it is a nicety, never load-bearing.
 */

const router = express.Router();

export const STATS_TTL_MS = 10 * 60 * 1000;

let cached = { at: 0, value: null };

export async function loadPublicStats(db) {
  const { rows } = await db.query(
    `select (select count(*)::int from auth.users) as students,
            (select count(*)::int from lectures where status = 'complete') as lectures,
            (select coalesce(floor(sum(duration_seconds) / 3600), 0)::int from lectures) as hours`,
  );
  const row = rows[0] || {};
  return { students: Number(row.students || 0), lectures: Number(row.lectures || 0), hours: Number(row.hours || 0) };
}

export async function publicStats(db, { now = Date.now, ttl = STATS_TTL_MS } = {}) {
  const at = now();
  if (cached.value && at - cached.at < ttl) return cached.value;
  const value = await loadPublicStats(db);
  cached = { at, value };
  return value;
}

/** Test seam: forget the cached numbers. */
export function resetPublicStatsCache() {
  cached = { at: 0, value: null };
}

router.get('/stats', async (req, res) => {
  try {
    const stats = await publicStats(pool);
    res.set('Cache-Control', 'public, max-age=600');
    res.json(stats);
  } catch (error) {
    console.error('[public-stats]', error.message);
    res.status(503).json({ error: 'stats unavailable' });
  }
});

export default router;
