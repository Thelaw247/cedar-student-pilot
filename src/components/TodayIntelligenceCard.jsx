import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, CalendarClock, X } from 'lucide-react';
import UpNextCard from '@/components/UpNextCard';
import RebookSessionModal from '@/components/RebookSessionModal';
import { isDismissedToday, dismissToday } from '@/lib/dismiss';
import { todayString } from '@/lib/time';

/**
 * The top of the Home page: the "up next" hero, then only the two signals the
 * rest of the page cannot show.
 *
 * This used to also carry a "Today at a glance" widget (next class, study
 * blocks, top priority). Every one of those rows was already on screen — the
 * next class is the UpNextCard directly above it, and the classes and study
 * blocks are the day's timeline directly below it — so the widget was a
 * third copy of the same day. It is gone. What stays is what the calendar
 * cannot say on its own: an exam inside the next seven days, and scheduled
 * sessions that slipped into the past and need rebooking.
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
  todayClasses,
  events,
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

  const upcomingExams = assignments
    .filter(a => (a.type === 'exam' || a.type === 'quiz') && a.due_date >= today && a.due_date <= getTodayPlusDays(7))
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const isExamWeek = upcomingExams.length > 0;

  const behindSessions = studySessions.filter(s => s.status === 'scheduled' && s.scheduled_date < today);

  const showExamWeek = isExamWeek && !examWeekDismissed;
  const showBehind = behindSessions.length > 0 && !behindDismissed;

  return (
    <div className="mb-4 space-y-3">
      {/* Hero: what's happening right now / next */}
      <UpNextCard todayClasses={todayClasses} events={events || []} />

      {(showExamWeek || showBehind) && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
          {showExamWeek && (
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-amber-500/5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-500">Exam week</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {upcomingExams.map(e => {
                    const d = daysBetween(e.due_date);
                    return `${e.title} (${d === 0 ? 'today' : d === 1 ? 'tomorrow' : `${d}d`})`;
                  }).join(' · ')}
                </p>
              </div>
              <button onClick={() => { dismissToday('examweek'); setExamWeekDismissed(true); }}
                aria-label="Dismiss"
                className="text-muted-foreground hover:text-foreground flex-shrink-0 p-1 -m-1">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {showBehind && (
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-rose-500/5">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-rose-700 dark:text-rose-500">You're behind</p>
                <p className="text-[11px] text-muted-foreground">
                  {behindSessions.length} missed session{behindSessions.length !== 1 ? 's' : ''} to reschedule
                </p>
              </div>
              <button onClick={() => setRebookSession(behindSessions[0])}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 flex-shrink-0">
                <CalendarClock className="w-3 h-3" /> Rebook
              </button>
              <button onClick={() => { dismissToday('behind'); setBehindDismissed(true); }}
                aria-label="Dismiss"
                className="text-muted-foreground hover:text-foreground flex-shrink-0 p-1 -m-1">
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
