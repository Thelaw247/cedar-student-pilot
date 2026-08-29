import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';

/**
 * First-party paywall/funnel telemetry (MON-04 Phase D).
 *
 * Fire-and-forget from the client (lib/analytics.js). Deliberately tiny:
 * a WHITELISTED event name plus a shallow meta object of short scalar
 * values — no free text, no content, nothing a third party ever sees.
 * Unknown events are dropped with a 204 (never an error a user can feel),
 * and a logging failure never fails the request. ownerAnalytics reads the
 * aggregate counts.
 */

const EVENTS = new Set([
  'onboarding_paywall_viewed',
  'onboarding_exit_offer_shown',
  'onboarding_exit_scholar_clicked',
  'onboarding_continue_free',
  'upgrade_sheet_opened',
  'checkout_started',
  'feature_lock_tapped',
]);

const MAX_META_KEYS = 6;
const MAX_VALUE_LEN = 64;

function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const out = {};
  let n = 0;
  for (const [k, v] of Object.entries(meta)) {
    if (n >= MAX_META_KEYS) break;
    if (typeof k !== 'string' || k.length > 32) continue;
    if (typeof v === 'number' || typeof v === 'boolean') { out[k] = v; n++; continue; }
    if (typeof v === 'string' && v.length <= MAX_VALUE_LEN) { out[k] = v; n++; }
  }
  return n > 0 ? out : null;
}

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  const { event, meta } = req.body || {};
  if (typeof event !== 'string' || !EVENTS.has(event)) {
    return res.status(204).end(); // unknown events are silently dropped
  }
  try {
    await pool.query(
      'insert into product_events (user_id, event, meta) values ($1, $2, $3)',
      [req.user.id, event, sanitizeMeta(meta)],
    );
  } catch (e) {
    console.error('[trackEvent] non-fatal:', e.message);
  }
  return res.status(204).end();
});

export default router;
