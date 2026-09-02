/**
 * The one email layout every Praelecta message uses — the API's own sends
 * (study reminders, transcript exports) and, via scripts/build-email-templates.mjs,
 * the Supabase Auth templates (confirm signup, reset password, magic link,
 * email change). One place to change the look; every email changes together.
 *
 * Email-client rules, learned the usual way: table layout, every style
 * inline, a system font stack, no external CSS or scripts. The logo is the
 * one external image, served from praelecta.ca; the wordmark next to it is
 * text, so a client that blocks images still shows who it is from.
 */

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const LOGO_URL = 'https://praelecta.ca/logo-mark.png';
const SITE_URL = 'https://praelecta.ca';
const SUPPORT_EMAIL = 'help@praelecta.ca';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * @param {object} o
 * @param {string} o.heading         Card title.
 * @param {string[]} o.paragraphs    Body sentences, already safe HTML (use escapeHtml for user text).
 * @param {{label:string, url:string}} [o.cta]  The one button.
 * @param {string} [o.footnote]      Small grey text under the button ("Didn't ask for this?…").
 * @param {string} [o.preheader]     Inbox preview line, hidden in the body.
 * @param {boolean} [o.rawUrls]      When true, o.cta.url is a template variable and is not escaped.
 */
export function renderEmail({ heading, paragraphs = [], cta, footnote, preheader, rawUrls = false }) {
  const url = cta ? (rawUrls ? cta.url : escapeHtml(cta.url)) : '';
  const p = (html, extra = '') =>
    `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:23px;color:#3D4661;${extra}">${html}</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F7F9FD;">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F9FD;padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr>
          <td style="padding:0 8px 18px;">
            <a href="${SITE_URL}" style="text-decoration:none;">
              <img src="${LOGO_URL}" width="36" height="36" alt="" style="display:inline-block;vertical-align:middle;border:0;border-radius:9px;">
              <span style="display:inline-block;vertical-align:middle;margin-left:10px;font-family:${FONT};font-size:18px;font-weight:700;color:#101828;letter-spacing:-0.02em;">Praelecta</span>
            </a>
          </td>
        </tr>
        <tr>
          <td style="background-color:#FFFFFF;border:1px solid #DFE4EE;border-radius:16px;padding:32px;">
            <h1 style="margin:0 0 14px;font-family:${FONT};font-size:22px;font-weight:700;color:#101828;letter-spacing:-0.02em;line-height:1.25;">${escapeHtml(heading)}</h1>
            ${paragraphs.map((html) => p(html)).join('\n            ')}
            ${cta ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0 0;">
              <tr>
                <td align="center">
                  <a href="${url}" style="display:inline-block;background-color:#2E66FF;color:#FFFFFF;font-family:${FONT};font-size:15px;font-weight:600;text-decoration:none;padding:13px 32px;border-radius:12px;">${escapeHtml(cta.label)}</a>
                </td>
              </tr>
            </table>` : ''}
            ${footnote ? `<p style="margin:24px 0 0;font-family:${FONT};font-size:12.5px;line-height:19px;color:#6B7488;">${footnote}</p>` : ''}
            ${cta ? `<p style="margin:16px 0 0;font-family:${FONT};font-size:11px;line-height:17px;color:#9AA3B8;word-break:break-all;">Button not working? Copy this link into your browser:<br><a href="${url}" style="color:#2E66FF;text-decoration:underline;">${url}</a></p>` : ''}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 8px 0;">
            <p style="margin:0;font-family:${FONT};font-size:11.5px;line-height:18px;color:#9AA3B8;">
              Praelecta · Made in Canada · <a href="mailto:${SUPPORT_EMAIL}" style="color:#9AA3B8;">${SUPPORT_EMAIL}</a><br>
              Your recordings and notes stay private to you.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
