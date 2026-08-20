import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Escapes the five HTML-significant characters. Applied to every dynamic
 * value interpolated into the print-mode HTML template below — class name,
 * instructor, and lecture title are student-editable, and the AI summary /
 * concepts / transcript are model output, none of which is safe to trust as
 * literal HTML. A prior version of this file interpolated all of these raw,
 * which a security scan correctly flagged as a stored XSS: the frontend
 * writes this HTML directly into a new window (window.open + document.write
 * in TranscriptActions.jsx), so an unescaped <script> here executes for real.
 */
function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

const DAILY_EMAIL_LIMIT = 10;

function todayKey(userId: string): string {
  return `exportTranscript_email_${userId}_${new Date().toISOString().slice(0, 10)}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { lecture_id, mode } = body;
    if (!lecture_id) return Response.json({ error: 'lecture_id is required' }, { status: 400 });
    if (!mode || !['print', 'email'].includes(mode)) {
      return Response.json({ error: 'mode must be "print" or "email"' }, { status: 400 });
    }

    // SECURITY (re-flagged by scan after a first pass that rate-limited but
    // still accepted a client-supplied recipient): the recipient is now NEVER
    // taken from the request. It is always the authenticated caller's own
    // account email from auth.me(), which the client cannot influence. This
    // removes "email a transcript to a friend" as a capability rather than
    // narrow it — that is the actual fix, not a mitigation on top of the old
    // one. If third-party sharing is wanted back, it needs a real feature
    // (recipient verified via a confirmation link, or an allow-listed
    // contact list) — not a free-text field the backend trusts.
    //
    // The per-day cap below is kept for cost hygiene only (SendEmail is a
    // billed integration call) — it is no longer a security control, since
    // there is no longer a variable recipient for it to limit abuse of.
    if (mode === 'email') {
      const key = todayKey(user.id);
      const rows = await base44.asServiceRole.entities.SystemState.filter({ key });
      const count = Number(rows?.[0]?.value || 0);
      if (count >= DAILY_EMAIL_LIMIT) {
        return Response.json({ error: `Daily transcript email limit reached (${DAILY_EMAIL_LIMIT}/day). Try again tomorrow.` }, { status: 429 });
      }
      if (rows?.[0]) {
        await base44.asServiceRole.entities.SystemState.update(rows[0].id, { value: String(count + 1) });
      } else {
        await base44.asServiceRole.entities.SystemState.create({ key, value: '1' });
      }
    }

    const lecture = await base44.entities.Lecture.get(lecture_id);
    if (!lecture) return Response.json({ error: 'Lecture not found' }, { status: 404 });

    let cls = null;
    if (lecture.class_id) {
      try { cls = await base44.entities.Class.get(lecture.class_id); } catch (e) { /* skip */ }
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
    // Plain-text email body (below) never touches this HTML var, so it needs
    // no escaping of its own — only the print-mode HTML render does.
    const transcriptRaw = lecture.transcript || '[No transcript available]';
    const transcriptHtml = escapeHtml(transcriptRaw);

    // Build a clean, formatted HTML document for printing
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
  ${aiConcepts.length > 0 ? `<div class="section-label">Key Concepts</div><div class="concepts">${aiConcepts.map(c => `<span class="concept-tag">${c}</span>`).join('')}</div>` : ''}
  <div class="section-label">Transcript</div>
  <div class="transcript">${transcriptHtml}</div>
  <div class="footer">Generated by Cedar Student Pilot — ${new Date().toLocaleDateString()}</div>
</body>
</html>`;

    if (mode === 'email') {
      // Unescaped raw values are correct and safe here — this is a plain-text
      // email body, not HTML, so there is no injection surface to escape
      // against, and escaping would just show literal "&amp;" etc. to the
      // reader.
      const textBody = `${lecture.ai_title || `Lecture — ${lecture.date}`}
${cls?.name || 'Unknown Class'} — ${lecture.actual_instructor || cls?.instructor || 'Unknown'}
Date: ${lecture.date || 'N/A'} | Time: ${cls?.start_time || 'N/A'} – ${cls?.end_time || 'N/A'}${durationMin ? ` | Duration: ${durationMin} min` : ''}

${lecture.ai_summary ? 'SUMMARY\n' + lecture.ai_summary + '\n\n' : ''}TRANSCRIPT

${transcriptRaw}

— Generated by Cedar Student Pilot`;

      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: `${cls?.name || 'Unknown Class'} — ${lecture.ai_title || `Lecture — ${lecture.date}`} (${lecture.date || 'N/A'})`,
        body: textBody,
      });
      return Response.json({ status: 'sent', mode: 'email', sent_to: user.email });
    }

    // Print mode — return the formatted HTML
    return Response.json({ status: 'ok', mode: 'print', html });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
