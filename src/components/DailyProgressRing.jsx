import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { parseTimeToMinutes, todayString } from '@/lib/time';

/**
 * Today's progress (Design Blueprint §4). A hand-drawn SVG arc — one hue,
 * rounded caps, animated close — replacing the recharts PieChart that powered
 * an 80px donut in three off-brand colors. Dropping recharts here also
 * removes the heaviest dependency from the most-visited screen.
 *
 * Color rules: progress is brand blue on the chip-grey track; the verdict is
 * text in the meta line, not a colored badge; amber appears only for the
 * "attendance unanswered" attention state (semantic, law 02).
 */
const R = 30;
const CIRC = 2 * Math.PI * R;

export default function DailyProgressRing({ classes, events, studySessions, attendance = [], lectures = [], currentTime }) {
  const today = todayString();
  const nowMin = currentTime.getHours() * 60 + currentTime.getMinutes();

  /* A class counts as done only when the student CONFIRMED it, never because
   * the clock passed its end time. The previous rule was
   *   parseTime(c.end_time) < nowMin
   * which reported 100% for a day where every class was skipped - the ring
   * measured the time of day, not the student's progress, and told them they
   * were "On Track" for a day they missed entirely.
   *
   * Confirmation means either an explicit ClassAttendance row with
   * attended: true (the AttendancePrompt answer), or a Lecture recorded for
   * that class today, which is proof of attendance on its own.
   *
   * Unanswered classes stay in the total but not in the done count, so an
   * ignored prompt reads as incomplete rather than complete. */
  const attendedToday = new Set(
    (attendance || [])
      .filter((a) => a.date === today && a.attended === true && a.class_id)
      .map((a) => a.class_id),
  );
  const recordedToday = new Set(
    (lectures || [])
      .filter((l) => l.date === today && l.class_id)
      .map((l) => l.class_id),
  );

  const totalClasses = classes.length;
  const doneClasses = classes.filter(
    (c) => attendedToday.has(c.id) || recordedToday.has(c.id),
  ).length;

  /* Classes that have ended but are still unanswered — surfaced so a low
   * percentage reads as "you have not told us yet", not lost progress. */
  const pendingClasses = classes.filter(
    (c) =>
      !attendedToday.has(c.id) &&
      !recordedToday.has(c.id) &&
      c.end_time &&
      parseTimeToMinutes(c.end_time) < nowMin,
  ).length;

  const todayStudy = studySessions.filter(s => s.scheduled_date === today);
  const totalStudy = todayStudy.length;
  const doneStudy = todayStudy.filter(s => s.status === 'completed').length;

  const totalEvents = events.length;
  const doneEvents = events.filter(e => e.end_time && parseTimeToMinutes(e.end_time) < nowMin).length;

  const totalItems = totalClasses + totalStudy + totalEvents;
  const doneItems = doneClasses + doneStudy + doneEvents;
  const percentage = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
  const complete = totalItems > 0 && doneItems === totalItems;

  // Animate the arc closed on mount / when progress changes. CSS handles the
  // motion (and prefers-reduced-motion users just see it snap via media query
  // support in the transition below being cheap either way).
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const offset = drawn ? CIRC * (1 - percentage / 100) : CIRC;

  /* Before anything is done the ring shows how much the day holds, not 0%.
   * A zero is the least motivating number a progress ring can show, and at
   * 8 AM it is also meaningless: nothing could have been done yet. Past the
   * halfway mark the line says "nearly there": the closer the end, the
   * harder people push for it, and the words should pull the same way. */
  const notStarted = totalItems > 0 && doneItems === 0;
  const verdict = totalItems === 0
    ? 'Nothing scheduled today'
    : complete
      ? 'Day complete'
      : notStarted
        ? `${totalItems} thing${totalItems === 1 ? '' : 's'} today`
        : percentage >= 50
          ? `${doneItems} of ${totalItems} done, nearly there`
          : `${doneItems} of ${totalItems} done`;

  const breakdown = [
    totalClasses > 0 && `${doneClasses}/${totalClasses} classes`,
    totalStudy > 0 && `${doneStudy}/${totalStudy} study`,
    totalEvents > 0 && `${doneEvents}/${totalEvents} events`,
  ].filter(Boolean).join(' · ');

  return (
    <div className="rounded-xl border border-border bg-card shadow-1 p-4 mb-4 flex items-center gap-4">
      <div className="relative w-[72px] h-[72px] flex-shrink-0" role="img"
        aria-label={notStarted ? `${totalItems} things today, none done yet` : `${percentage} percent of today complete`}>
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={R} fill="none" className="stroke-muted" strokeWidth="7" />
          <circle
            cx="36" cy="36" r={R} fill="none"
            className="stroke-primary"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            transform="rotate(-90 36 36)"
            style={{ transition: 'stroke-dashoffset 1.1s var(--ease-standard)' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {complete
            ? <Check className="w-6 h-6 text-primary" strokeWidth={2.5} />
            : notStarted
              ? <span className="font-heading text-lg font-bold tabular-nums text-foreground">{totalItems}</span>
              : <span className="font-heading text-sm font-bold tabular-nums text-foreground">{percentage}%</span>}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{notStarted ? "Today's plan" : "Today's progress"}</p>
        <p className="text-sm font-semibold text-foreground mt-0.5">{verdict}</p>
        {breakdown && (
          <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">{breakdown}</p>
        )}
        {pendingClasses > 0 && (
          <p className="text-[11px] text-amber-600 dark:text-amber-500 mt-1">
            {pendingClasses} {pendingClasses === 1 ? 'class needs' : 'classes need'} an attendance answer
          </p>
        )}
      </div>
    </div>
  );
}
