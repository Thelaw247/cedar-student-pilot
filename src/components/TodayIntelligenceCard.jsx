import React, { useState } from 'react';
import { AlertTriangle, CalendarClock, X } from 'lucide-react';
import RebookSessionModal from '@/components/RebookSessionModal';
import { isDismissedToday, dismissToday } from '@/lib/dismiss';
import { todayString } from '@/lib/time';

/**
 * The two signals the rest of the Today page cannot show: an exam inside the
 * next seven days, and booked sessions that slipped into the past and need
 * rebooking.
 *
 * This used to also render the "up next" hero and, before that, a "Today at
 * a glance" widget; both were copies of what was already on screen (the
 * hero now sits first on the page, in Home.jsx, above the progress ring).
 * What stays is what the calendar cannot say on its own.
 *
 * Tone: both are nudges about the week, not failures, so both are amber.
 * "Missed study" was rose with a filled red button, directly under a rose
 * risk card about the same thing, and the day's first screen read as two
 * alarms about studying before the student had done anything.
 */

function daysBetween(dateStr) {
  const today = new Date(todayString());
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getTodayPlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export default function TodayIntelligenceCard({
  assignments,
  studySessions,
  onRecalculateComplete,
}) {
  const [rebookSession, setRebookSession] = useState(null);
  // Per-day dismissals (lib/dismiss): a dismissed-but-still-true problem
  // returns tomorrow instead of being silenced for good.
  const [examWeekDismissed, setExamWeekDismissed] = useState(() => isDismissedToday('examweek'));
  const [behindDismissed, setBehindDismissed] = useState(() => isDismissedToday('behind'));

  const today = todayString();

  const upcomingExams = (assignments || [])
    .filter(a => (a.type === 'exam' || a.type === 'quiz') && a.due_date >= today && a.due_date <= getTodayPlusDays(7))
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const isExamWeek = upcomingExams.length > 0;

  const behindSessions = (studySessions || []).filter(s => s.status === 'scheduled' && s.scheduled_date < today);

  const showExamWeek = isExamWeek && !examWeekDismissed;
  const showBehind = behindSessions.length > 0 && !behindDismissed;

  if (!showExamWeek && !showBehind && !rebookSession) return null;

  return (
    <div className="mb-4">
      {(showExamWeek || showBehind) && (
        <div className="overflow-hidden rounded-xl border border-amber-500/30 bg-amber-500/5 divide-y divide-amber-500/20">
          {showExamWeek && (
            <div className="flex items-center gap-2.5 px-4 py-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-500">
                  {upcomingExams.length === 1 ? 'An exam this week' : `${upcomingExams.length} exams this week`}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {upcomingExams.map(e => {
                    const d = daysBetween(e.due_date);
                    return `${e.title} (${d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`})`;
                  }).join(' · ')}
                </p>
              </div>
              <button onClick={() => { dismissToday('examweek'); setExamWeekDismissed(true); }}
                aria-label="Dismiss"
                className="text-muted-foreground hover:text-foreground flex-shrink-0 p-3 -m-3">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {showBehind && (
            <div className="flex items-center gap-2.5 px-4 py-2.5">
              <CalendarClock className="w-4 h-4 text-amber-600 dark:text-amber-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-500">
                  {behindSessions.length === 1 ? 'A study session slipped' : `${behindSessions.length} study sessions slipped`}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {behindSessions.length === 1 ? 'Booked, not sat. Give it a new time.' : 'Booked, not sat. Give them new times.'}
                </p>
              </div>
              <button onClick={() => setRebookSession(behindSessions[0])}
                className="inline-flex min-h-[40px] items-center gap-1.5 px-3.5 py-2 rounded-lg border border-amber-500/40 bg-card text-xs font-medium text-amber-700 dark:text-amber-500 hover:bg-amber-500/10 transition-colors duration-micro flex-shrink-0">
                <CalendarClock className="w-3 h-3" /> Rebook
              </button>
              <button onClick={() => { dismissToday('behind'); setBehindDismissed(true); }}
                aria-label="Dismiss"
                className="text-muted-foreground hover:text-foreground flex-shrink-0 p-3 -m-3">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {rebookSession && (
        <RebookSessionModal
          session={rebookSession}
          onClose={() => setRebookSession(null)}
          onRebooked={onRecalculateComplete}
        />
      )}
    </div>
  );
}
