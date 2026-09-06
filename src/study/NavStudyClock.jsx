import React from 'react';
import { useStudySession, useStudyTick } from '@/study/StudySessionContext';
import { formatClockSeconds } from '@/lib/studySession';

/**
 * The running clock, on the Study nav item, everywhere.
 *
 * Moving the timer above the router is what stops a quiz ending the session
 * it belongs to. It also creates the opposite hazard: a clock that keeps
 * counting on a page that never mentions it, until the student comes back
 * hours later and saves a sitting they did not sit.
 *
 * RecordingIsland is the existing answer to exactly this for recordings — a
 * visible handle on every page. This is the same idea at a tenth the size,
 * hung on a nav item that already exists rather than as a second floating
 * thing competing for the same corner. Tapping it goes to the controls.
 *
 * Renders nothing at all when no session is running, which is most of the time.
 */
export default function NavStudyClock({ to }) {
  const s = useStudySession();
  const t = useStudyTick();
  if (to !== '/study' || !s.running) return null;
  const onBreak = s.phase === 'break';
  return (
    <span
      title={`${Math.floor(t.studySeconds / 60)} of ${s.goalMinutes} minutes`}
      className={`ml-auto inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
        onBreak ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary/10 text-primary'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.phase === 'paused' ? 'bg-current' : 'bg-current animate-pulse'}`} />
      {formatClockSeconds(t.studySeconds)}
    </span>
  );
}

/** The dot alone, for the mobile bar where there is no room for digits. */
export function NavStudyDot({ to }) {
  const s = useStudySession();
  if (to !== '/study' || !s.running) return null;
  return (
    <span aria-hidden="true"
      className={`absolute top-0.5 right-2 w-2 h-2 rounded-full ${s.phase === 'break' ? 'bg-emerald-500' : 'bg-primary'} ${s.phase === 'paused' ? '' : 'animate-pulse'}`} />
  );
}
