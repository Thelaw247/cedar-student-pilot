import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { secrets } from 'base44:runtime';

// sendStudyReminders — emails a student shortly before a scheduled study session.
//
// SECURITY NOTE (this function previously had none):
// Every deployed function gets a PUBLIC HTTP endpoint at
// /functions/sendStudyReminders. Attaching a scheduled automation does not make
// that endpoint private. Before this change the handler went straight from
// createClientFromRequest() to `asServiceRole` reads across EVERY user's
// StudySession and User records, with no caller verification at all — the only
// one of the app's 21 functions without an auth check.
//
// There are now exactly two accepted callers:
//
//   1. BROADCAST (the scheduled automation, or an operator with the secret).
//      Requires the REMINDERS_TRIGGER_TOKEN app secret, presented either as an
//      `x-cedar-trigger-token` header or as `args.trigger_token` in the body.
//      This is the only path allowed to touch other users' data.
//
//   2. SELF-SERVICE (a signed-in user). Processes ONLY that user's own
//      sessions, read through the user-scoped client so RLS applies.
//
// Anything else gets a 401. Critically this FAILS CLOSED: if the secret has not
// been configured yet, the broadcast path is refused outright rather than
// running unauthenticated.

const WINDOW_MINUTES = 30;

/** Constant-time-ish comparison so a mismatch doesn't leak length via timing. */
function tokensMatch(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Build the reminder email for one session. */
function buildEmail(user, className: string, session, diff: number) {
  return {
    to: user.email,
    subject: `Study Session Reminder: ${className} in ${diff} min`,
    body: `Hi ${user.full_name || 'there'},\n\nThis is a quick reminder that your study session for ${className} is scheduled to start in ${diff} minute${diff !== 1 ? 's' : ''}.\n\nScheduled time: ${session.scheduled_time}\nDuration: ${session.duration_minutes || 30} minutes\n\nOpen Cedar to start your focus session: just tap "Study Now" on the notification.\n\nGood luck!\n\n— Cedar Student Pilot`,
  };
}

/** Minutes until the session starts, or null when it isn't in the window. */
function minutesUntil(session, currentMin: number): number | null {
  if (!session.scheduled_time) return null;
  const [h, m] = session.scheduled_time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const diff = (h * 60 + m) - currentMin;
  if (diff < 0 || diff > WINDOW_MINUTES) return null;
  return diff;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Body is optional — a direct HTTP call may send nothing at all.
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { body = {}; }
    const args = (body?.args ?? {}) as Record<string, unknown>;

    // secrets.get() must be called per-request, not at module load.
    const expectedToken = secrets.get('REMINDERS_TRIGGER_TOKEN');
    const presentedToken =
      req.headers.get('x-cedar-trigger-token') ||
      (typeof args.trigger_token === 'string' ? args.trigger_token : '') ||
      '';

    const isBroadcast = !!expectedToken && tokensMatch(expectedToken, presentedToken);

    // Who, if anyone, is signed in? Never throws out of this block.
    let caller = null;
    if (!isBroadcast) {
      try { caller = await base44.auth.me(); } catch { caller = null; }
    }

    if (!isBroadcast && !caller) {
      // Fails closed. Includes the case where REMINDERS_TRIGGER_TOKEN has not
      // been set yet: the broadcast simply cannot run until it is configured.
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentMin = now.getHours() * 60 + now.getMinutes();

    // Broadcast reads every user's sessions and so must use the service role.
    // Self-service reads through the user-scoped client, so RLS confines it to
    // the caller's own rows — no cross-user access is possible on that path.
    const sessions = isBroadcast
      ? await base44.asServiceRole.entities.StudySession.filter({ status: 'scheduled', scheduled_date: todayStr })
      : await base44.entities.StudySession.filter({ status: 'scheduled', scheduled_date: todayStr });

    let emailsSent = 0;

    for (const session of sessions) {
      // Idempotency guard first: a repeat call costs one query and nothing else.
      if (session.email_notified) continue;

      const diff = minutesUntil(session, currentMin);
      if (diff === null) continue;

      // Resolve the recipient. On the self-service path that is always the
      // caller, so no User lookup (and no service-role read) is needed.
      let user = caller;
      if (isBroadcast) {
        const ownerId = session.user_id || session.created_by_id;
        if (!ownerId) continue;
        try {
          user = await base44.asServiceRole.entities.User.get(ownerId);
        } catch { continue; }
      }
      if (!user?.email) continue;

      let className = 'your study session';
      if (session.class_id) {
        try {
          const cls = isBroadcast
            ? await base44.asServiceRole.entities.Class.get(session.class_id)
            : await base44.entities.Class.get(session.class_id);
          className = cls?.name || className;
        } catch { /* fall back to the generic label */ }
      }

      try {
        await base44.asServiceRole.integrations.Core.SendEmail(buildEmail(user, className, session, diff));

        const marked = { email_notified: true };
        if (isBroadcast) await base44.asServiceRole.entities.StudySession.update(session.id, marked);
        else await base44.entities.StudySession.update(session.id, marked);

        emailsSent++;
      } catch (e) {
        console.error('Failed to send reminder for session', session.id, e);
      }
    }

    // Only `sent` is returned. The old response also included
    // `checked: sessions.length`, which handed any caller a live count of every
    // user's scheduled sessions for the day — a cross-tenant aggregate leak.
    return Response.json({ ok: true, sent: emailsSent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
