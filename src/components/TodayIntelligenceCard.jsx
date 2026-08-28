import React, { useState, useEffect } from 'react';
import { BookOpen, AlertCircle, AlertTriangle, Plus, CalendarClock, X, Sparkles, GraduationCap } from 'lucide-react';
import UpNextCard from '@/components/UpNextCard';
import RebookSessionModal from '@/components/RebookSessionModal';
import Widget, { WidgetRow } from '@/components/ui/Widget';
import { isDismissedToday, dismissToday } from '@/lib/dismiss';
import { formatTime, todayString } from '@/lib/time';

/**
 * The "Today at a glance" widget (Design Blueprint, Home fixes #2–#4).
 * Previously this was three bordered layers deep: a gradient wrapper holding
 * UpNextCard's bordered card holding three more bordered tiles in amber /
 * rose / class-color hues. Now: UpNextCard stands alone as the hero, and the
 * glance items are rows of ONE widget — class-color rails, neutral icons,
 * semantic color only on the two signal rows (exam week, behind schedule).
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
  onExamWeekChange,
  onRecalculateComplete,
  onAddStudyBlock,
}) {
  const [rebookSession, setRebookSession] = useState(null);
  // Per-day dismissals (lib/dismiss): a dismissed-but-still-true problem
  // returns tomorrow instead of being silenced for good.
  const [examWeekDismissed, setExamWeekDismissed] = useState(() => isDismissedToday('examweek'));
  const [behindDismissed, setBehindDismissed] = useState(() => isDismissedToday('behind'));

  const today = todayString();
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // Next class: upcoming or just-started
  const nextClass = todayClasses
    .filter(c => c.start_time)
    .map(c => {
      const [h, m] = c.start_time.split(':').map(Number);
      return { ...c, minutesUntil: h * 60 + m - nowMin };
    })
    .filter(c => c.minutesUntil >= -15)
    .sort((a, b) => a.minutesUntil - b.minutesUntil)[0] || null;

  const todaySessions = studySessions.filter(s => s.scheduled_date === today && s.status === 'scheduled');
  const totalStudyMinutes = todaySessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);

  const topPriority = assignments
    .filter(a => a.due_date >= today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0] || null;
  const topDays = topPriority ? daysBetween(topPriority.due_date) : null;

  const upcomingExams = assignments
    .filter(a => (a.type === 'exam' || a.type === 'quiz') && a.due_date >= today && a.due_date <= getTodayPlusDays(7))
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const isExamWeek = upcomingExams.length > 0;

  const behindSessions = studySessions.filter(s => s.status === 'scheduled' && s.scheduled_date < today);

  useEffect(() => {
    onExamWeekChange?.(isExamWeek);
  }, [isExamWeek, onExamWeekChange]);

  // The law-04 summary: the collapsed header already answers the day.
  const metaParts = [
    `${todayClasses.length} ${todayClasses.length === 1 ? 'class' : 'classes'}`,
    todaySessions.length > 0 ? `${todaySessions.length} study ${todaySessions.length === 1 ? 'block' : 'blocks'}` : null,
    topPriority ? (topDays === 0 ? 'due today' : `next due in ${topDays}d`) : 'nothing due',
  ].filter(Boolean).join(' · ');

  return (
    <div className="mb-4 space-y-3">
      {/* Hero: what's happening right now / next */}
      <UpNextCard todayClasses={todayClasses} events={events || []} />

      <Widget
        icon={Sparkles}
        title="Today at a glance"
        meta={metaParts}
        collapsible
        storageKey="glance"
      >
        {/* Next class */}
        <WidgetRow
          railColor={nextClass?.color}
          icon={!nextClass ? GraduationCap : undefined}
          title={nextClass ? nextClass.name : todayClasses.length > 0 ? 'Classes done' : 'No classes today'}
          meta={nextClass
            ? `${formatTime(nextClass.start_time)}${nextClass.room ? ` · ${nextClass.room}` : ''}`
            : todayClasses.length > 0 ? 'All finished for today' : 'Enjoy your day'}
          right={nextClass ? (nextClass.minutesUntil > 0 ? `in ${nextClass.minutesUntil} min` : 'started') : undefined}
          to={nextClass ? `/classes/${nextClass.id}` : '/classes'}
        />

        {/* Study blocks */}
        {todaySessions.length > 0 ? (
          <WidgetRow
            icon={BookOpen}
            title={`${todaySessions.length} study block${todaySessions.length !== 1 ? 's' : ''}`}
            meta={`${totalStudyMinutes} min total`}
            to="/planner"
          />
        ) : (
          <WidgetRow
            icon={Plus}
            title="No study blocks yet"
            meta="Add an exam or study block"
            onClick={onAddStudyBlock}
          />
        )}

        {/* Top priority — deep-links into the class's Assignments tab */}
        {topPriority && (
          <WidgetRow
            icon={AlertCircle}
            title={topPriority.title}
            meta={topDays === 0 ? 'Due today' : topDays === 1 ? '1 day left' : `${topDays} days left`}
            to={topPriority.class_id ? `/classes/${topPriority.class_id}?tab=assignments&assignmentId=${topPriority.id}` : '/planner'}
          />
        )}

        {/* Signal rows — the only semantic color in the widget (law 02) */}
        {isExamWeek && !examWeekDismissed && (
          <div className="flex items-center gap-2.5 px-4 py-2.5 border-t border-border bg-amber-500/5">
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

        {behindSessions.length > 0 && !behindDismissed && (
          <div className="flex items-center gap-2.5 px-4 py-2.5 border-t border-border bg-rose-500/5">
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
      </Widget>

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
