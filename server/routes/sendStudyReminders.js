import express from 'express';
import { pool } from '../lib/db.js';

// Direct port of base44/functions/sendStudyReminders/entry.ts. See that
// file's preserved header comment for the security history (this was the
// one function with no auth check at all before a prior fix) — the same two
// accepted callers (broadcast via REMINDERS_TRIGGER_TOKEN, self-service via
// a real session) carry over unchanged.
//
// EMAIL SENDING NOT YET CONFIGURED on this stack (SMTP deferred to Phase 6).
// Checked ONCE up front rather than failing per-session in the loop below —
// this function's entire job is sending emails, so if no provider exists,
// every session would fail identically; better to say so once, clearly.

const router = express.Router();
const WINDOW_MINUTES = 30;

function tokensMatch(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function minutesUntil(session, currentMin) {
  if (!session.scheduled_time) return null;
  const [h, m] = session.scheduled_time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const diff = (h * 60 + m) - currentMin;
  if (diff < 0 || diff > WINDOW_MINUTES) return null;
  return diff;
}

async function requireAuthOrToken(req) {
  const expectedToken = process.env.REMINDERS_TRIGGER_TOKEN;
  const presentedToken = req.headers['x-cedar-trigger-token'] || req.body?.trigger_token || '';
  const isBroadcast = !!expectedToken && tokensMatch(String(expectedToken), String(presentedToken));
  if (isBroadcast) return { isBroadcast: true, caller: null };

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return { isBroadcast: false, caller: null };
  try {
    const resp = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: process.env.SUPABASE_ANON_KEY } });
    if (!resp.ok) return { isBroadcast: false, caller: null };
    const user = await resp.json();
    return { isBroadcast: false, caller: user?.id ? user : null };
  } catch {
    return { isBroadcast: false, caller: null };
  }
}

router.post('/', async (req, res) => {
  try {
    const { isBroadcast, caller } = await requireAuthOrToken(req);
    if (!isBroadcast && !caller) return res.status(401).json({ error: 'Unauthorized' });

    // No email-sending mechanism configured yet — fail loudly, once, rather
    // than attempt (and fail) per session below.
    if (!process.env.EMAIL_FROM_ADDRESS) {
      return res.status(501).json({ ok: false, sent: 0, error: 'Email sending is not yet configured on this stack (SMTP deferred to Phase 6).' });
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentMin = now.getHours() * 60 + now.getMinutes();

    const sessions = isBroadcast
      ? (await pool.query(`select * from study_sessions where status = 'scheduled' and scheduled_date = $1`, [todayStr])).rows
      : (await pool.query(`select * from study_sessions where status = 'scheduled' and scheduled_date = $1 and user_id = $2`, [todayStr, caller.id])).rows;

    let emailsSent = 0;
    for (const session of sessions) {
      if (session.email_notified) continue;
      const diff = minutesUntil(session, currentMin);
      if (diff === null) continue;
      // Actual send is intentionally not implemented — see the 501 above.
      // This loop structure is kept so wiring in a real provider later is a
      // one-function change, not a rewrite.
    }

    res.json({ ok: true, sent: emailsSent });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
