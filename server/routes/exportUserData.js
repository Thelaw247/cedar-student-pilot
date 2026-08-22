import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';

// Every query is explicitly scoped by user_id. The server's database role
// bypasses RLS, so these predicates are part of the authorization boundary.

const router = express.Router();

const USER_TABLES = [
  'assignments',
  'calendar_events',
  'class_attendance',
  'classes',
  'credit_balances',
  'custom_tracks',
  'flashcards',
  'handbooks',
  'knowledge_coverage',
  'lectures',
  'notes',
  'practice_questions',
  'processed_stripe_events',
  'semesters',
  'study_records',
  'study_session_reviews',
  'study_sessions',
  'usage_events',
];

async function exportUserData(req, res) {
  try {
    const userId = req.user.id;
    const profilePromise = pool.query(
      'select id, role, avatar_url, full_name, created_at from profiles where id = $1',
      [userId],
    );
    const tablePromises = USER_TABLES.map((table) =>
      pool.query(`select * from ${table} where user_id = $1`, [userId]));

    const [profileResult, ...tableResults] = await Promise.all([
      profilePromise,
      ...tablePromises,
    ]);

    const data = Object.fromEntries(
      USER_TABLES.map((table, index) => [table, tableResults[index].rows]),
    );

    res.json({
      schema_version: 1,
      exported_at: new Date().toISOString(),
      account: {
        id: userId,
        email: req.user.email || null,
        created_at: req.user.created_at || null,
        profile: profileResult.rows[0] || null,
      },
      data,
    });
  } catch (error) {
    console.error('exportUserData failed', error);
    res.status(500).json({ error: 'Unable to export user data' });
  }
}

router.get('/', requireAuth, exportUserData);
router.post('/', requireAuth, exportUserData);

export default router;
