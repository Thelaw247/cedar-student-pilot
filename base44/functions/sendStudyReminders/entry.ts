import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get today's date
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentMin = now.getHours() * 60 + now.getMinutes();

    // Get all scheduled study sessions for today (service role — covers all users)
    const sessions = await base44.asServiceRole.entities.StudySession.filter({
      status: 'scheduled',
      scheduled_date: todayStr,
    });

    let emailsSent = 0;

    for (const session of sessions) {
      // Skip if already notified
      if (session.email_notified) continue;

      // Check if session is within the next 30 minutes
      if (!session.scheduled_time) continue;
      const [h, m] = session.scheduled_time.split(':').map(Number);
      const sessionMin = h * 60 + m;
      const diff = sessionMin - currentMin;

      if (diff < 0 || diff > 30) continue;

      // Get the user who owns this session (prefer the per-user owner field,
      // falling back to created_by_id for legacy rows created before RLS).
      const ownerId = session.user_id || session.created_by_id;
      if (!ownerId) continue;
      let user;
      try {
        user = await base44.asServiceRole.entities.User.get(ownerId);
      } catch (e) { continue; }
      if (!user || !user.email) continue;

      // Get class name for context
      let className = 'your study session';
      if (session.class_id) {
        try {
          const cls = await base44.asServiceRole.entities.Class.get(session.class_id);
          className = cls.name || className;
        } catch (e) { /* skip */ }
      }

      // Send email
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: user.email,
          subject: `Study Session Reminder: ${className} in ${diff} min`,
          body: `Hi ${user.full_name || 'there'},\n\nThis is a quick reminder that your study session for ${className} is scheduled to start in ${diff} minute${diff !== 1 ? 's' : ''}.\n\nScheduled time: ${session.scheduled_time}\nDuration: ${session.duration_minutes || 30} minutes\n\nOpen Cedar to start your focus session: just tap "Study Now" on the notification.\n\nGood luck!\n\n— Cedar Student Pilot`,
        });

        // Mark as notified to prevent duplicate emails
        await base44.asServiceRole.entities.StudySession.update(session.id, { email_notified: true });
        emailsSent++;
      } catch (e) {
        console.error('Failed to send email for session', session.id, e);
      }
    }

    return Response.json({ sent: emailsSent, checked: sessions.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});