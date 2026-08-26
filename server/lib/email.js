const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export function emailIsConfigured() {
  return Boolean(String(process.env.RESEND_API_KEY || '').trim()
    && String(process.env.EMAIL_FROM_ADDRESS || '').trim());
}

export async function sendEmail({ to, subject, html, text, idempotencyKey }) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.EMAIL_FROM_ADDRESS || '').trim();
  if (!apiKey || !from) throw new Error('Email sending is not configured');
  if (!to || !subject || (!html && !text)) throw new TypeError('Email recipient, subject, and content are required');

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': String(idempotencyKey).slice(0, 256) } : {}),
    },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = result?.message || result?.error || `provider returned ${response.status}`;
    throw new Error(`Email delivery failed: ${detail}`);
  }
  if (!result?.id) throw new Error('Email provider returned an invalid response');
  return result;
}

export function escapeEmailHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]
  ));
}
