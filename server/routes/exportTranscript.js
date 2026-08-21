import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';

// Direct port of exportTranscript's SECURITY-FIXED version (built earlier
// this session after a real scan finding: an open mail relay via a
// client-controlled email_to, plus stored XSS via unescaped HTML). Neither
// bug is reintroduced here — recipient is always the caller's own email,
// never client input, and every dynamic value in the print HTML is escaped.
//
// EMAIL MODE IS NOT YET FUNCTIONAL. The original used Base44's built-in
// SendEmail integration, which doesn't exist on this stack. Custom SMTP was
// deliberately deferred to Phase 6 (cutover prep) rather than set up early.
// Rather than silently no-op or fake success, this fails loudly with a clear
// error — same philosophy as appOrigin()/GEMINI_API_KEY failing closed
// elsewhere in this port. Print mode has no such dependency and is fully
// functional now.

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

router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { lecture_id, mode } = req.body || {};
    if (!lecture_id) return res.status(400).json({ error: 'lecture_id is required' });
    if (!mode || !['print', 'email'].includes(mode)) {
      return res.status(400).json({ error: 'mode must be "print" or "email"' });
    }

    if (mode === 'email') {
      // Recipient is ALWAYS the caller's own verified email — never client
      // input. This is the actual fix from the security scan, not a
      // mitigation layered on top of a client-supplied address.
      const key = todayKey(userId);
      const rows = (await pool.query('select * from system_state where key = $1', [key])).rows;
      const count = Number(rows[0]?.value || 0);
      if (count >= DAILY_EMAIL_LIMIT) {
        return res.status(429).json({ error: `Daily transcript email limit reached (${DAILY_EMAIL_LIMIT}/day). Try again tomorrow.` });
      }
      // Cost-hygiene cap only — not a security control, since there's no
      // variable recipient left for it to limit abuse of.
      if (rows[0]) {
        await pool.query('update system_state set value = $1 where key = $2', [String(count + 1), key]);
      } else {
        await pool.query('insert into system_state (key, value) values ($1, $2)', [key, '1']);
      }
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
      // No email-sending mechanism configured on this stack yet (SMTP
      // deferred to Phase 6). Fail loudly rather than silently no-op.
      return res.status(501).json({
        error: 'Email export is not yet available — email sending is not configured on this stack. Use print mode for now.',
      });
    }

    res.json({ status: 'ok', mode: 'print', html });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
