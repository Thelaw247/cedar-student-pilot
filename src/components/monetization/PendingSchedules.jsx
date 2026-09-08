import React, { useEffect, useRef, useState } from 'react';
import { CalendarCheck2, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useBalance } from '@/hooks/useBalance';
import { hasFeature } from '@/lib/tiers';
import { bookSessionsFor } from '@/lib/saveDeadline';
import { pendingScheduleIds, forgetPendingSchedule } from '@/lib/pendingSchedule';

/**
 * The other half of ScheduleSkippedNotice.
 *
 * A student on Student adds a midterm, is told no sessions were booked and
 * why, taps "See plans", pays for Scholar — and, before this, came back to a
 * midterm with nothing scheduled against it. The upgrade worked; the thing
 * they upgraded FOR did not happen, and there was no sign anywhere that it
 * was still owed.
 *
 * So the deadline's id is left behind on the way out (lib/pendingSchedule.js)
 * and this picks it up the moment the plan allows it. It lives in Layout
 * rather than on the checkout page on purpose: the upgrade can land by any
 * route — the Stripe redirect, the webhook arriving while the student is
 * already back in the app, a plan bought later from Settings — and all of
 * them end with a tier that has the feature, which is the only condition
 * this waits on.
 *
 * Booking is idempotent server-side (studyScheduler.js refuses to book a
 * second set for an assignment that already has sessions), so a duplicate run
 * costs a request and creates nothing. Each id is forgotten whatever the
 * outcome — a deadline that was deleted, or a booking that fails, must not
 * retry on every page load forever. The "Plan study sessions" button on the
 * deadline itself is the way back in if it does.
 */
export default function PendingSchedules() {
  const { tier } = useBalance();
  const allowed = hasFeature(tier, 'study_schedule');
  const runningRef = useRef(false);
  const [booked, setBooked] = useState(null); // { titles: string[] }

  useEffect(() => {
    if (!allowed || runningRef.current) return;
    const ids = pendingScheduleIds();
    if (ids.length === 0) return;

    runningRef.current = true;
    let cancelled = false;
    (async () => {
      const today = new Date().toLocaleDateString('en-CA');
      const titles = [];
      for (const id of ids) {
        try {
          const assignment = await base44.entities.Assignment.get(id);
          // generateStudySchedule charges a credit as soon as its gate passes,
          // whether or not any session comes back — and bookAssignmentSessions
          // returns nothing for a deadline that has passed or already has
          // sessions. Both are cheap to rule out here, and both are exactly
          // what a week-old pending id looks like.
          const stale = !assignment || assignment.status !== 'active'
            || !assignment.due_date || assignment.due_date < today;
          if (!stale) {
            const existing = await base44.entities.StudySession.filter({ assignment_id: id });
            if (existing.length === 0) {
              const created = await bookSessionsFor(id);
              if (created > 0) titles.push(assignment.title || 'your deadline');
            }
          }
        } catch {
          // Deleted, or the booking refused. Either way it is not owed any
          // more — dropping it is what stops this retrying forever.
        }
        forgetPendingSchedule(id);
      }
      if (!cancelled && titles.length > 0) setBooked({ titles });
    })();
    return () => { cancelled = true; };
  }, [allowed]);

  if (!booked) return null;

  const what = booked.titles.length === 1
    ? booked.titles[0]
    : `${booked.titles.length} deadlines`;

  return (
    <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[min(24rem,calc(100vw-2rem))] animate-fade-in">
      <div className="rounded-xl border border-border bg-card shadow-lg p-3 flex items-start gap-3">
        <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <CalendarCheck2 className="w-4 h-4 text-primary" />
        </span>
        <p className="flex-1 min-w-0 text-sm text-foreground">
          Study sessions are booked for <span className="font-medium">{what}</span>.
        </p>
        <button onClick={() => setBooked(null)} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
