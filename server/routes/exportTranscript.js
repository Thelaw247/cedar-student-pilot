import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { emailIsConfigured, sendEmail } from '../lib/email.js';

// Direct port of exportTranscript's SECURITY-FIXED version (built earlier
// this session after a real scan finding: an open mail relay via a
// client-controlled email_to, plus stored XSS via unescaped HTML). Neither
// bug is reintroduced here — recipient is always the caller's own email,
// never client input, and every dynamic value in the print HTML is escaped.
//
// Email mode uses the caller's verified Supabase email only. The provider is
// intentionally server-side and fails closed when its credentials are absent.

const router = express.Router();

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAILY_EMAIL_LIMIT = 10;

function todayKey(userId) {
  return `exportTranscript_email_${userId}_${new Date().toISOString().slice(0, 10)}`;
}

async function reserveEmailAllowance(userId) {
  const key = todayKey(userId);
  const result = await pool.query(
    `insert into system_state (key, value) values ($1, '1')
     on conflict (key) do update
       set value = (case when system_state.value ~ '^[0-9]+$' then system_state.value::integer else 0 end + 1)::text
       where (case when system_state.value ~ '^[0-9]+$' then system_state.value::integer else 0 end) < $2
     returning value`,
    [key, DAILY_EMAIL_LIMIT],
  );
  return result.rowCount > 0;
}

async function releaseEmailAllowance(userId) {
  const key = todayKey(userId);
  await pool.query(
    `update system_state
       set value = greatest((case when value ~ '^[0-9]+$' then value::integer else 1 end) - 1, 0)::text
     where key = $1`,
    [key],
  );
}

router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { lecture_id, mode } = req.body || {};
    if (!lecture_id) return res.status(400).json({ error: 'lecture_id is required' });
    if (!mode || !['print', 'email'].includes(mode)) {
      return res.status(400).json({ error: 'mode must be "print" or "email"' });
    }

    const lecture = (await pool.query('select * from lectures where id = $1 and user_id = $2', [lecture_id, userId])).rows[0];
    if (!lecture) return res.status(404).json({ error: 'Lecture not found' });

    let cls = null;
    if (lecture.class_id) {
      cls = (await pool.query('select * from classes where id = $1 and user_id = $2', [lecture.class_id, userId])).rows[0] || null;
    }

    const className = escapeHtml(cls?.name || 'Unknown Class');
    const instructor = escapeHtml(lecture.actual_instructor || cls?.instructor || 'Unknown');
    const topic = escapeHtml(lecture.ai_title || `Lecture — ${lecture.date}`);
    const date = escapeHtml(lecture.date || 'N/A');
    const startTime = escapeHtml(cls?.start_time || 'N/A');
    const endTime = escapeHtml(cls?.end_time || 'N/A');
    const durationMin = lecture.duration_seconds > 0 ? Math.round(lecture.duration_seconds / 60) : null;
    const aiSummary = lecture.ai_summary ? escapeHtml(lecture.ai_summary) : '';
    const aiConcepts = Array.isArray(lecture.ai_concepts) ? lecture.ai_concepts.map(escapeHtml) : [];
    const transcriptRaw = lecture.transcript || '[No transcript available]';
    const transcriptHtml = escapeHtml(transcriptRaw);

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${topic} — ${className}</title>
<style>
  @page { margin: 1in; }
  body { font-family: Georgia, 'Times New Roman', serif; line-height: 1.7; color: #1a1a1a; max-width: 700px; margin: 0 auto; }
  .header { border-bottom: 2px solid #2D5BFF; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { font-size: 20px; margin: 0 0 8px 0; color: #1a1a1a; }
  .meta { font-size: 13px; color: #555; display: flex; flex-wrap: wrap; gap: 16px; }
  .meta span { white-space: nowrap; }
  .meta strong { color: #1a1a1a; }
  .section-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #2D5BFF; font-weight: 600; margin-bottom: 6px; }
  .summary { background: #f8f9ff; border-left: 3px solid #2D5BFF; padding: 12px 16px; margin-bottom: 24px; font-size: 14px; }
  .transcript { font-size: 14px; white-space: pre-wrap; word-wrap: break-word; }
  .concepts { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; }
  .concept-tag { background: #eef2ff; color: #2D5BFF; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-family: sans-serif; }
  .footer { margin-top: 32px; border-top: 1px solid #ddd; padding-top: 12px; font-size: 11px; color: #999; text-align: center; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
  <div class="header">
    <h1>${topic}</h1>
    <div class="meta">
      <span><strong>Class:</strong> ${className}</span>
      <span><strong>Professor:</strong> ${instructor}</span>
      <span><strong>Date:</strong> ${date}</span>
      <span><strong>Time:</strong> ${startTime} – ${endTime}</span>
      ${durationMin ? `<span><strong>Duration:</strong> ${durationMin} min</span>` : ''}
    </div>
  </div>
  ${aiSummary ? `<div class="section-label">Summary</div><div class="summary">${aiSummary}</div>` : ''}
  ${aiConcepts.length > 0 ? `<div class="section-label">Key Concepts</div><div class="concepts">${aiConcepts.map((c) => `<span class="concept-tag">${c}</span>`).join('')}</div>` : ''}
  <div class="section-label">Transcript</div>
  <div class="transcript">${transcriptHtml}</div>
  <div class="footer">Generated by Cedar Student Pilot — ${new Date().toLocaleDateString()}</div>
</body>
</html>`;

    if (mode === 'email') {
      if (!emailIsConfigured()) {
        return res.status(501).json({ error: 'Email export is not configured. Use print mode for now.' });
      }
      if (!EMAIL_RE.test(req.user.email || '')) return res.status(422).json({ error: 'Your account does not have a valid email address' });
      // Recipient is ALWAYS the caller's verified auth email—never client input.
      if (!(await reserveEmailAllowance(userId))) {
        return res.status(429).json({ error: `Daily transcript email limit reached (${DAILY_EMAIL_LIMIT}/day). Try again tomorrow.` });
      }
      try {
        const result = await sendEmail({
          to: req.user.email,
          subject: `${topic.replace(/&[^;]+;/g, '')} — ${className.replace(/&[^;]+;/g, '')}`,
          html,
          idempotencyKey: `transcript/${userId}/${lecture_id}/${new Date().toISOString().slice(0, 10)}`,
        });
        return res.json({ status: 'ok', mode: 'email', message_id: result.id });
      } catch (error) {
        await releaseEmailAllowance(userId).catch(() => {});
        throw error;
      }
    }

    res.json({ status: 'ok', mode: 'print', html });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
