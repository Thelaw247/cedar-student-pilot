import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';

// Every query is explicitly scoped by user_id. The server's database role
// bypasses RLS, so these predicates are part of the authorization boundary.

const router = express.Router();

// app_reviews and product_events joined in Oct 2026: the privacy policy
// promises a full copy, and a review a student wrote, or the record of which
// onboarding steps they took, is their data as much as a lecture is.
const USER_TABLES = [
  'app_reviews',
  'assignments',
  'calendar_events',
  'class_attendance',
  'classes',
  'credit_balances',
  'custom_tracks',
  'flashcards',
  'handbooks',
  'knowledge_coverage',
  'lecture_materials',
  'lectures',
  'notes',
  'practice_questions',
  'processed_stripe_events',
  'product_events',
  'semesters',
  'study_records',
  'study_session_reviews',
  'study_sessions',
  'todos',
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
        // Which version of the terms and privacy policy this account agreed
        // to, and when (recorded at signup in the auth metadata).
        consent: {
          legal_version: req.user.user_metadata?.legal_version || null,
          legal_accepted_at: req.user.user_metadata?.legal_accepted_at || null,
        },
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
