import express from 'express';
import { pool } from '../lib/db.js';
import { emailIsConfigured, escapeEmailHtml, sendEmail } from '../lib/email.js';

// Direct port of base44/functions/sendStudyReminders/entry.ts. See that
// file's preserved header comment for the security history (this was the
// one function with no auth check at all before a prior fix) — the same two
// accepted callers (broadcast via REMINDERS_TRIGGER_TOKEN, self-service via
// a real session) carry over unchanged.
//
// Delivery is provider-backed and idempotent. A session is marked notified
// only after the provider accepts the message.

const router = express.Router();
const WINDOW_MINUTES = 30;

function localDateAndMinutes(date = new Date()) {
  const timeZone = String(process.env.REMINDERS_TIME_ZONE || 'America/Regina').trim();
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

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
    const resp = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: process.env.SUPABASE_ANON_KEY }, signal: AbortSignal.timeout(15_000) });
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
    if (!emailIsConfigured()) {
      return res.status(501).json({ ok: false, sent: 0, error: 'Email sending is not configured on this stack.' });
    }

    const clock = localDateAndMinutes();
    const todayStr = clock.date;
    const currentMin = clock.minutes;

    const sessions = isBroadcast
      ? (await pool.query(`select * from study_sessions where status = 'scheduled' and scheduled_date = $1`, [todayStr])).rows
      : (await pool.query(`select * from study_sessions where status = 'scheduled' and scheduled_date = $1 and user_id = $2`, [todayStr, caller.id])).rows;

    let emailsSent = 0;
    let emailsFailed = 0;
    for (const session of sessions) {
      if (session.email_notified) continue;
      const diff = minutesUntil(session, currentMin);
      if (diff === null) continue;
      const recipient = isBroadcast
        ? (await pool.query('select email from auth.users where id = $1', [session.user_id])).rows[0]?.email
        : caller.email;
      if (!recipient) continue;
      const title = escapeEmailHtml(session.title || 'Study session');
      const time = escapeEmailHtml(session.scheduled_time || 'soon');
      try {
        await sendEmail({
          to: recipient,
          subject: `Praelecta reminder: ${String(session.title || 'Study session').replace(/[\r\n]/g, ' ')}`,
          html: `<p>Your <strong>${title}</strong> session starts at ${time}${diff ? ` (in about ${diff} minutes)` : ''}.</p><p>Open Praelecta when you are ready to begin.</p>`,
          text: `Your ${session.title || 'study'} session starts at ${session.scheduled_time || 'soon'}${diff ? ` (in about ${diff} minutes)` : ''}.`,
          idempotencyKey: `study-reminder/${session.id}/${todayStr}`,
        });
        await pool.query(
          `update study_sessions set email_notified = true where id = $1 and user_id = $2 and email_notified = false`,
          [session.id, session.user_id],
        );
        emailsSent += 1;
      } catch (error) {
        emailsFailed += 1;
        console.error('[study-reminder] delivery failed', session.id, error.message);
      }
    }

    res.status(emailsFailed ? 207 : 200).json({ ok: emailsFailed === 0, sent: emailsSent, failed: emailsFailed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
