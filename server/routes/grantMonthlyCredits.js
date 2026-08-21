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
  try {
    const expected = process.env.GRANT_TRIGGER_TOKEN;
    const presented = req.headers['x-cedar-trigger-token'] || req.body?.trigger_token || '';
    if (!expected || !tokensMatch(String(expected), String(presented))) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const stateRows = await pool.query('select * from system_state where key = $1', [STATE_KEY]);
    const lastRun = stateRows.rows[0]?.value ? new Date(stateRows.rows[0].value) : null;
    if (lastRun && Date.now() - lastRun.getTime() < COOLDOWN_HOURS * 60 * 60 * 1000) {
      return res.json({ ok: true, skipped_reason: 'cooldown', granted: 0, skipped: 0 });
    }
    if (stateRows.rows[0]) {
      await pool.query('update system_state set value = $1 where key = $2', [new Date().toISOString(), STATE_KEY]);
    } else {
      await pool.query('insert into system_state (key, value) values ($1, $2)', [STATE_KEY, new Date().toISOString()]);
    }

    const thisMonth = periodKey();
    const { rows: balances } = await pool.query('select * from credit_balances order by updated_at desc limit 500');

    let granted = 0;
    let skipped = 0;
    for (const b of balances) {
      if (b.tier === 'free' || !b.stripe_subscription_id) { skipped++; continue; }
      if (b.period_key === thisMonth) { skipped++; continue; }
      const result = await grantScheduledMonthly(b.user_id, b.tier, b.stripe_subscription_id, thisMonth);
      if (Number(result?.granted || 0) > 0) granted++;
      else skipped++;
    }

    res.json({ ok: true, granted, skipped });
  } catch (error) {
    console.error('[grantMonthlyCredits]', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
