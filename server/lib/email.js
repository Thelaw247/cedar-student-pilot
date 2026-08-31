const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const EMAIL_TIMEOUT_MS = 15_000; // reminders run in a loop; one hung send must not stall the rest

export function emailIsConfigured() {
  return Boolean(String(process.env.RESEND_API_KEY || '').trim()
    && String(process.env.EMAIL_FROM_ADDRESS || '').trim());
}

/**
 * Where the app's own mail is sent FROM.
 *
 * This has to be a domain we control and have verified with the provider, or
 * DMARC rejects it — praelecta.ca is p=reject with strict alignment. Beyond
 * that the check stays out of the way.
 *
 * An earlier version of this forced a send.praelecta.ca subdomain and treated
 * the root as an error. That was wrong and worth recording. Resend does
 * recommend a subdomain, but the reason is reputation isolation, which matters
 * to high-volume senders and not to a pre-launch app sending confirmations,
 * password resets and reminders to people who asked for them. The cost was
 * real and immediate: every user would see noreply@send.praelecta.ca.
 *
 * The "only one SPF record" concern was overstated too. Merging Google and the
 * mail provider into one record is routine — two includes against a ten-lookup
 * limit — and DKIM was never a conflict, since Google signs with the
 * google._domainkey selector and Resend with resend._domainkey. Different
 * selectors on one domain is what selectors are for.
 *
 * So: any address on praelecta.ca or a subdomain of it is accepted, and the
 * choice between them is a product decision rather than something enforced
 * here. What IS still worth catching is a sender on a domain we do not control
 * at all, which cannot be verified and will fail DMARC outright.
 */
const MAIL_DOMAIN = 'praelecta.ca';

export function emailStatus(env = process.env) {
  const key = String(env.RESEND_API_KEY || '').trim();
  const from = String(env.EMAIL_FROM_ADDRESS || '').trim();
  const missing = [!key && 'RESEND_API_KEY', !from && 'EMAIL_FROM_ADDRESS'].filter(Boolean);
  if (missing.length) {
    return { ok: false, message: `outbound email: ${missing.join(' and ')} not set — study reminders and transcript exports will fail` };
  }
  const domain = from.split('@').pop().toLowerCase();
  const ours = domain === MAIL_DOMAIN || domain.endsWith(`.${MAIL_DOMAIN}`);
  if (!ours) {
    return {
      ok: false,
      message: `outbound email: sending from ${domain}, which is not ${MAIL_DOMAIN} or a subdomain of it — it cannot be verified with the provider and will fail DMARC`,
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
