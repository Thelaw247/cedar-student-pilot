import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Flag, Headphones } from 'lucide-react';
import Widget, { WidgetRow } from '@/components/ui/Widget';
import { formatShortDate, formatTime } from '@/lib/time';
import { sessionTitle } from '@/lib/sessionTitle';
import { sessionStudyPath } from '@/lib/studyScope';
import { localDay } from '@/lib/localDay';
import { nextUpFor, daysLeftLabel, sittingDayLabel } from '@/lib/studyNextUp';

/**
 * What is next for the class on screen: the nearest deadline, how much of it
 * has been reviewed, and the sitting the student booked for it.
 *
 * It sits first in the study panel on purpose. Everything below it is a tool;
 * this is the reason to use one. The page used to open on a class picker and
 * a list of checkboxes, with the exam that made the student open it at all
 * on the other tab.
 *
 * Three facts, each one real:
 *   the date      "Due Tue, Oct 20 · in 16 days", from the assignment row
 *   the progress  "1 of 5 lectures reviewed", the same count the deadline's
 *                 coverage checklist shows, with one tap to select the ones
 *                 still to do
 *   the sitting   "You booked Today, 5:30 PM" over "50 min · Midterm 1
 *                 review", with Study this, which hands the booked session
 *                 to the clock above
 *
 * Nothing is invented to fill a gap: a class with no upcoming deadline and no
 * booked sitting gets no card. A project deadline gets its date and no bar,
 * because a project is steps, not lectures.
 *
 * Props:
 *   classId         the class on screen
 *   lectures        that class's lectures
 *   deadlines       the semester's assignments (null while loading)
 *   sessions        the semester's scheduled sessions (null while loading)
 *   coverage        knowledge_coverage rows (null while loading)
 *   onPickLectures  called with lecture ids to make the selection above the
 *                   tools: the "Select the 3 not reviewed" tap
 */
export default function StudyNextUp({ classId, lectures = [], deadlines = null, sessions = null, coverage = null, onPickLectures = null }) {
  const navigate = useNavigate();
  const today = localDay();
  const next = nextUpFor({ classId, deadlines, sessions, lectures, coverage, today });
  if (!next) return null;

  const { deadline, daysLeft, progress, session } = next;
  // "Today, 5:30 PM" on the line that is read, "50 min · Midterm 1 review"
  // under it: the length was on the first line and truncated on a phone.
  const sittingWhen = (s) => {
    const parts = [sittingDayLabel(s.scheduled_date, today, formatShortDate)];
    if (s.scheduled_time) parts.push(formatTime(s.scheduled_time));
    return parts.join(', ');
  };
  const sittingWhat = (s, a) => {
    const parts = [];
    if (s.duration_minutes) parts.push(`${s.duration_minutes} min`);
    parts.push(sessionTitle(s, a));
    return parts.join(' · ');
  };
  const studyThis = (s) => navigate(sessionStudyPath(s));

  // A booked sitting with no deadline to hang it on is still a plan the
  // student made, and the clock above is one tap from keeping it.
  if (!deadline) {
    return (
      <Widget
        icon={Headphones}
        title={`You booked ${sittingWhen(session)}`}
        meta={sittingWhat(session)}
        className="mb-6"
        action={
          <button type="button" onClick={() => studyThis(session)}
            className="text-xs font-medium text-primary hover:underline py-2 -my-2 px-1 -mx-1 flex-shrink-0">
            Study this
          </button>
        }
      />
    );
  }

  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;
  const left = progress ? progress.notReviewedIds.length : 0;

  return (
    <Widget
      icon={Flag}
      title={deadline.title}
      meta={`Due ${formatShortDate(deadline.due_date, { weekday: true })} · ${daysLeftLabel(daysLeft)}`}
      className="mb-6"
    >
      {progress && (
        <div className="px-4 pb-3.5">
          <div className="flex items-center gap-3">
            {/* The bar is the thing read at a glance; the words make it exact. */}
            <span className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden" role="progressbar"
              aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}
              aria-label={`${progress.done} of ${progress.total} lectures reviewed`}>
              <span className="block h-full rounded-full bg-primary transition-all duration-standard ease-standard" style={{ width: `${pct}%` }} />
            </span>
            <span className="text-xs font-medium text-foreground tabular-nums flex-shrink-0">
              {progress.done} of {progress.total} lecture{progress.total === 1 ? '' : 's'} reviewed
            </span>
          </div>
          {/* The gap, named, and made into the selection in one tap. "3 not
              reviewed" is a true count, not a countdown: when the list is
              done the line says so and asks for nothing. */}
          {left > 0 && onPickLectures ? (
            <button type="button" onClick={() => onPickLectures(progress.notReviewedIds)}
              className="mt-2 text-xs font-medium text-primary hover:underline py-2 -my-2 px-1 -mx-1">
              Select the {left} not reviewed yet
            </button>
          ) : left === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">All reviewed. A quiz now shows what stuck.</p>
          ) : null}
        </div>
      )}
      {session && (
        <WidgetRow
          icon={Headphones}
          title={`You booked ${sittingWhen(session)}`}
          meta={sittingWhat(session, deadline)}
          right={<span className="text-xs font-medium text-primary">Study this</span>}
          onClick={() => studyThis(session)}
        />
      )}
    </Widget>
  );
}
