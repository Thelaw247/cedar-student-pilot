import React from 'react';
import { CalendarClock, Lock } from 'lucide-react';
import { useFeatureGate } from '@/components/monetization/useFeatureGate';

/**
 * Shown after an exam or assignment is saved on a plan that does not include
 * study planning.
 *
 * The deadline itself is free and is already saved by the time this appears —
 * this is only about the sessions. It exists because the alternative was
 * silence: the modal called generateStudySchedule when the plan allowed it,
 * skipped it when it did not, and closed either way, so a student on Student
 * added an assignment, got no sessions, and was told nothing. Worse, the same
 * booking happens automatically and free when Praelecta finds a deadline in a
 * lecture, so the absence looked like a bug rather than a plan boundary.
 *
 * Two ways out and no dead end: see the plans, or carry on without sessions.
 */
export default function ScheduleSkippedNotice({ typeLabel = 'assignment', onClose }) {
  const { requiredTierName, lock } = useFeatureGate('study_schedule');

  return (
    <div>
      <div className="flex items-start gap-3 mb-4">
        <span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <CalendarClock className="w-5 h-5 text-primary" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-heading text-base font-semibold text-foreground">Your {typeLabel} is saved</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            The deadline is on your calendar and you&rsquo;ll still get reminders for it.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/40 p-4 mb-4">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold mb-2">
          <Lock className="w-3 h-3" strokeWidth={2.5} /> {requiredTierName} and up
        </span>
        <p className="text-sm text-foreground font-medium">No study sessions were booked.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Planning the work backwards from a deadline — sessions spread one a day, around your classes
          and your preferred study times — ships with {requiredTierName}.
        </p>
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onClose}
          className="flex-1 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors duration-micro">
          Not now
        </button>
        <button type="button" onClick={lock}
          className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-micro">
          See plans
        </button>
      </div>
    </div>
  );
}
