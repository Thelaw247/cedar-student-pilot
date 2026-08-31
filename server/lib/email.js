const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const EMAIL_TIMEOUT_MS = 15_000; // reminders run in a loop; one hung send must not stall the rest

export function emailIsConfigured() {
  return Boolean(String(process.env.RESEND_API_KEY || '').trim()
    && String(process.env.EMAIL_FROM_ADDRESS || '').trim());
}

/**
 * Where the app's own mail is sent FROM, and why it must not be the root domain.
 *
 * praelecta.ca is a Google Workspace domain — it carries the human mailboxes and
 * a root SPF record listing Google. A domain gets exactly ONE SPF record, so
 * adding Resend to the root means editing that same record, and a mistake there
 * breaks every human email as well as every app email. It also means Workspace
 * and Resend share one reputation: a bounce-heavy reminder run would damage
 * deliverability for mail a person actually typed.
 *
 * So app mail lives on send.praelecta.ca, with its own SPF, its own DKIM and its
 * own reputation. The root DMARC is p=reject with sp=reject and strict
 * alignment, which the subdomain satisfies because Resend signs with
 * d=send.praelecta.ca — DKIM aligns strictly, and DMARC passes on DKIM alone.
 *
 * A root-domain FROM address would still SEND. It would just fail SPF until
 * someone edited the Workspace record, which is exactly the silent, weeks-later
 * failure this warns about at boot instead.
 */
const APP_MAIL_SUBDOMAIN = 'send.praelecta.ca';

export function emailStatus(env = process.env) {
  const key = String(env.RESEND_API_KEY || '').trim();
  const from = String(env.EMAIL_FROM_ADDRESS || '').trim();
  const missing = [!key && 'RESEND_API_KEY', !from && 'EMAIL_FROM_ADDRESS'].filter(Boolean);
  if (missing.length) {
    return { ok: false, message: `outbound email: ${missing.join(' and ')} not set — study reminders and transcript exports will fail` };
  }
  const domain = from.split('@').pop().toLowerCase();
  if (domain !== APP_MAIL_SUBDOMAIN) {
    return {
      ok: false,
      message: `outbound email: sending from ${domain}, not ${APP_MAIL_SUBDOMAIN} — app mail on the Workspace root domain has to be added to the single root SPF record or it fails authentication`,
    };
  }
  return { ok: true, message: `outbound email: configured, sending from ${domain}` };
}

export function logEmailStatus(env = process.env, logger = console) {
  const status = emailStatus(env);
  if (status.ok) logger.log(`[boot] ${status.message}`);
  else logger.error(`[boot] ${status.message}`);
  return status;
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
    signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
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
