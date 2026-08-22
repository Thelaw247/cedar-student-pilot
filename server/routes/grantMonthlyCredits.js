import express from 'express';
import crypto from 'node:crypto';
import { pool } from '../lib/db.js';
import { periodKey } from '../lib/credits.js';
import { grantScheduledMonthly } from '../lib/stripe.js';

// Direct port of base44/functions/grantMonthlyCredits/entry.ts. Same
// shared-secret gate (GRANT_TRIGGER_TOKEN) and cooldown pattern as the
// Base44 version — see that function's preserved header comment for the full
// reasoning on why a shared secret is the only mechanism available for a
// scheduled task, and why the cooldown exists even with a valid token.
//
// Trigger this from Render's own Cron Job feature (or any scheduler) with a
// daily POST including { trigger_token: "..." } in the body, or an
// x-cedar-trigger-token header.

const COOLDOWN_HOURS = 20;
const STATE_KEY = 'grantMonthlyCredits_last_run';

function tokensMatch(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const router = express.Router();

router.post('/', async (req, res) => {
  let lockClient;
  let lockHeld = false;
  try {
    const expected = process.env.GRANT_TRIGGER_TOKEN;
    const presented = req.headers['x-cedar-trigger-token'] || req.body?.trigger_token || '';
    if (!expected || !tokensMatch(String(expected), String(presented))) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // A session-level advisory lock prevents overlapping scheduler requests.
    // It is automatically released if the connection dies.
    lockClient = await pool.connect();
    const lock = await lockClient.query(
      'select pg_try_advisory_lock(hashtext($1)) as acquired',
      [STATE_KEY],
    );
    lockHeld = lock.rows[0]?.acquired === true;
    if (!lockHeld) {
      return res.status(409).json({ error: 'Monthly grant sweep already running' });
    }

    const stateRows = await pool.query('select * from system_state where key = $1', [STATE_KEY]);
    const lastRun = stateRows.rows[0]?.value ? new Date(stateRows.rows[0].value) : null;
    if (lastRun && Date.now() - lastRun.getTime() < COOLDOWN_HOURS * 60 * 60 * 1000) {
      return res.json({ ok: true, skipped_reason: 'cooldown', granted: 0, skipped: 0 });
    }
    const thisMonth = periodKey();
    const { rows: balances } = await pool.query('select * from credit_balances order by updated_at');

    let granted = 0;
    let skipped = 0;
    const failures = [];
    for (const b of balances) {
      if (b.tier === 'free' || !b.stripe_subscription_id) { skipped++; continue; }
      if (b.period_key === thisMonth) { skipped++; continue; }
      try {
        const result = await grantScheduledMonthly(b.user_id, b.tier, b.stripe_subscription_id, thisMonth);
        if (Number(result?.granted || 0) > 0) granted++;
        else skipped++;
      } catch (error) {
        failures.push({ user_id: b.user_id, error: error.message });
      }
    }

    // Stamp completion only after every account succeeds. If a partial sweep
    // fails, the scheduler may retry immediately; per-user grant anchors and
    // period keys make already-completed accounts idempotent.
    if (failures.length > 0) {
      console.error('[grantMonthlyCredits] partial sweep failure', failures);
      return res.status(500).json({
        error: 'Monthly grant sweep incomplete',
        granted,
        skipped,
        failed: failures.length,
      });
    }

    await pool.query(
      `insert into system_state (key, value) values ($1, $2)
       on conflict (key) do update set value = excluded.value`,
      [STATE_KEY, new Date().toISOString()],
    );

    res.json({ ok: true, granted, skipped, failed: 0 });
  } catch (error) {
    console.error('[grantMonthlyCredits]', error.message);
    res.status(500).json({ error: 'Monthly grant sweep failed' });
  } finally {
    if (lockClient) {
      if (lockHeld) {
        await lockClient.query(
          'select pg_advisory_unlock(hashtext($1))',
          [STATE_KEY],
        ).catch(() => {});
      }
      lockClient.release();
    }
  }
});

export default router;
