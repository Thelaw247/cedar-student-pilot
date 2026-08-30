# Praelecta auth email templates

Supabase Auth sends these (its dashboard holds the live copy; this folder is
the versioned source of truth — edit here, paste there).

## Install: reset-password email (one-time, ~2 minutes)

1. Supabase dashboard → project dyowooyijuxghwnwuxcr → Authentication →
   Emails → "Reset password".
   - Subject: `Reset your Praelecta password`
   - Body: paste `recovery.html` (Source/HTML mode).
2. Authentication → URL Configuration — REQUIRED for the link to land:
   - Site URL: `https://cedar-student-pilot.dewetluus.workers.dev`
   - Redirect URLs: add
     `https://cedar-student-pilot.dewetluus.workers.dev/reset-password`
     (and the custom domain's twin at cutover).
   If the redirect isn't allowlisted, Supabase falls back to the Site URL
   and the email link "does nothing" — the most common cause of a
   "reset isn't working" report.

## Delivery notes

- Current sender is Supabase's built-in mailer
  (noreply@mail.app.supabase.io): capped around 2 emails/hour and prone to
  the spam folder. Fine for the pilot, not for launch.
- At cutover (runbook Phase 0): verify the domain in Resend, then set
  Authentication → Emails → SMTP Settings to Resend's SMTP
  (smtp.resend.com, username `resend`, password = API key, from =
  no-reply@<domain>). Every auth email then sends from the Praelecta domain
  with real deliverability — templates above unchanged.
- Requests for addresses with no account return 200 and send nothing
  (anti-enumeration) — expected, not a bug.

The other templates (confirm signup / magic link / email change) can clone
this design — swap the heading, body sentence, and button label.
