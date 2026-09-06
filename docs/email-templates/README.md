# Praelecta email templates

Every email Praelecta sends comes from one layout, `server/lib/emailLayout.js`:
the API's own messages (study reminders, transcript exports) render it
directly, and the four Supabase Auth templates in this folder are generated
from it by `node scripts/build-email-templates.mjs`. Change the layout, run
the script, paste — never edit the generated `.html` files by hand.

## Install the auth templates (one-time, ~5 minutes)

Supabase dashboard → project `dyowooyijuxghwnwuxcr` → **Authentication** →
**Emails** (Templates tab). For each template: click it, set the **Subject**,
switch the body editor to source/HTML, select-all, paste the file, **Save**.

| Template in Supabase | File | Subject |
|---|---|---|
| Confirm sign up | `confirmation.html` | Confirm your Praelecta account |
| Reset password | `recovery.html` | Reset your Praelecta password |
| Magic link | `magic_link.html` | Your Praelecta sign-in link |
| Change email address | `email_change.html` | Confirm your new email address |

"Invite user" and "Reauthentication" are not used by the app; leave them.

**6 Sep 2026 — only `confirmation.html` changed.** It now renders Supabase's
`{{ .Token }}`, the six-digit code, above the one-tap link. Re-paste that one
template; the other three are byte-identical to what is already installed.
Nothing else has to change — `verifyOtp({ type: 'signup' })` on the confirm
screen has always accepted this code, there was simply never one in the email.

Check: **Authentication → URL Configuration** must have Site URL
`https://praelecta.ca` and the redirect allowlist entries for it, or the
links land on the login page instead of the reset page.

## Delivery

Auth mail goes out through Resend's SMTP (Authentication → Emails → SMTP
Settings, sender `noreply@praelecta.ca`), so it is signed for praelecta.ca and
lands in inboxes. Raise **Authentication → Rate Limits → emails** from the
default to 100/hour before launch; the default is a development ceiling.

The logo in the header is `https://praelecta.ca/logo-mark.png`. Clients that
block remote images show the alt text "Praelecta" instead.

## Testing a template

Send yourself a password reset from `https://praelecta.ca/login` → Forgot
password. In Gmail, open the message → ⋮ → Show original: SPF, DKIM and DMARC
should all read PASS.
