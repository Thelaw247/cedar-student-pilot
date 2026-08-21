import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { stripeDelete } from '../lib/stripe.js';
import { TIER_GRANT, periodKey } from '../lib/credits.js';

// Direct port of base44/functions/deleteUserData/entry.ts. Same ordering
// discipline as the original: cancel Stripe FIRST (see that file's preserved
// header comment for exactly why), and if cancellation fails, ABORT before
// touching any data — losing the record of a still-billing subscription is
// the one outcome this function must never produce.
//
// Unlike the original, there's no separate "authenticated vs service-role
// client" distinction here — this server's DB connection has no RLS
// enforcement at all (see server/lib/db.js), so EVERY query below is
// explicitly scoped by user_id. That WHERE clause is the only thing standing
// between this and deleting someone else's data.
//
// The auth.users row itself is NOT deleted — login persists, only data and
// billing reset to a fresh state, matching the original's own behavior
// ("signing in again will start a fresh free-tier account", not "you need to
// sign up again").

const router = express.Router();

// Children before parents — matches the FK dependency order in the schema.
const USER_SCOPED_TABLES = [
  'study_session_reviews', 'flashcards', 'practice_questions', 'knowledge_coverage',
  'notes', 'class_attendance', 'lectures', 'assignments', 'study_sessions',
  'study_records', 'calendar_events', 'custom_tracks', 'classes', 'semesters',
];
const SERVICE_TABLES = ['handbooks', 'usage_events', 'processed_stripe_events'];

router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    if (req.body?.confirm !== 'DELETE') {
      return res.status(400).json({ error: 'Confirmation required', hint: 'Send { "confirm": "DELETE" }' });
    }

    const summary = {};
    const errors = [];
    let totalDeleted = 0;

    // ---------------------------------------------------- 1. stop billing ---
    let subscriptionCancelled = false;
    let cancelledSubscriptionId = '';
    try {
      const { rows } = await pool.query('select * from credit_balances where user_id = $1', [userId]);
      for (const b of rows) {
        if (!b.stripe_subscription_id) continue;
        try {
          await stripeDelete(`subscriptions/${b.stripe_subscription_id}`);
          subscriptionCancelled = true;
          cancelledSubscriptionId = b.stripe_subscription_id;
        } catch (e) {
          const msg = e.message || '';
          if (msg.includes('resource_missing') || msg.includes('No such subscription')) {
            subscriptionCancelled = true;
          } else {
            errors.push(`stripe:cancel_subscription — ${msg}`);
          }
        }
      }
    } catch (e) {
      errors.push(`stripe:lookup — ${e.message}`);
    }

    if (errors.some((e) => e.startsWith('stripe:cancel_subscription'))) {
      return res.status(502).json({
        status: 'aborted', reason: 'subscription_cancel_failed',
        message: 'Your subscription could not be cancelled, so nothing was deleted. No data has been changed. Please try again or cancel from the billing portal first.',
        errors,
      });
    }

    // ------------------------------------------------- 2. academic data ----
    for (const table of USER_SCOPED_TABLES) {
      try {
        const result = await pool.query(`delete from ${table} where user_id = $1`, [userId]);
        summary[table] = result.rowCount;
        totalDeleted += result.rowCount;
      } catch (e) {
        errors.push(`${table} — ${e.message}`);
      }
    }

    // ------------------------------------------- 3. billing/system data ----
    for (const table of SERVICE_TABLES) {
      try {
        const result = await pool.query(`delete from ${table} where user_id = $1`, [userId]);
        summary[table] = result.rowCount;
        totalDeleted += result.rowCount;
      } catch (e) {
        errors.push(`${table} — ${e.message}`);
      }
    }

    // credit_balances is RESET, not deleted (unique on user_id, and the
    // auto-provisioning trigger only fires on auth.users INSERT — there's no
    // insert here to re-trigger it, so an explicit reset is the correct
    // equivalent of the original's delete-it-and-let-getBalance-recreate-it).
    try {
      await pool.query(
        `update credit_balances set tier = 'free', subscription_credits = $1, purchased_credits = 0,
           period_key = $2, last_grant_date = current_date, fair_use_flagged = false,
           applied_credit_operations = '{}', fulfilled_stripe_anchors = '{}',
           stripe_customer_id = null, stripe_subscription_id = null, updated_at = now()
         where user_id = $3`,
        [TIER_GRANT.free, periodKey(), userId],
      );
    } catch (e) {
      errors.push(`credit_balances:reset — ${e.message}`);
    }

    console.log('[deleteUserData] reset complete', JSON.stringify({
      user_id: userId, total_deleted: totalDeleted, subscription_cancelled: subscriptionCancelled, error_count: errors.length,
    }));

    res.json({
      status: errors.length > 0 ? 'complete_with_errors' : 'complete',
      total_deleted: totalDeleted,
      deleted_by_entity: summary,
      subscription_cancelled: subscriptionCancelled,
      cancelled_subscription_id: cancelledSubscriptionId,
      errors,
      note: 'All app data has been deleted and any active subscription cancelled. No refund was issued. Your account is reset to a fresh free tier. Uploaded audio files are no longer linked to your account; contact support if you need stored files purged from backups.',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
