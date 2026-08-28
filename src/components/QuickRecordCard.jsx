import React from 'react';
import { Mic, Loader2, MapPin } from 'lucide-react';
import { useTodaySchedule } from '@/hooks/useTodaySchedule';
import { useQuickRecord } from '@/recording/useQuickRecord';
import { classTint } from '@/lib/color';
import { formatTime, parseTimeToMinutes, formatCountdown } from '@/lib/time';

/**
 * Quick-access recording, docked beside the calendar (Design Blueprint
 * follow-up). Lives at the top of the DesktopRail — a real layout column,
 * so it can never fall over other content. Shows the class you're in (live
 * dot) or the next one coming up (countdown), and one mic button: tap it
 * and you're recording — the island takes over from there.
 *
 * Hides itself while a session is live (the island is the control surface
 * then) and on days with no classes (nothing to record toward).
 */
export default function QuickRecordCard() {
  const { loaded, current, next, now } = useTodaySchedule();
  const { startForClass, startingId, recordingActive } = useQuickRecord();

  if (!loaded || recordingActive) return null;
  const cls = current || next;
  if (!cls) return null;

  const isLive = !!current;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const minutesUntil = !isLive && cls.start_time ? parseTimeToMinutes(cls.start_time) - nowMin : null;
  const starting = startingId === cls.id;

  return (
    <div
      className="rounded-xl border border-border bg-card shadow-1 p-3.5 overflow-hidden relative"
      style={{ borderColor: isLive ? classTint(cls.color, 45) : undefined }}
    >
      {/* Soft class-tinted wash keeps it sleek without a second border */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: classTint(cls.color, 4) }} />
      <div className="relative">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
          {isLive && <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />}
          {isLive ? 'In class now' : 'Up next'}
        </p>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{cls.name}</p>
            <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
              {isLive
                ? <>{cls.room ? <><MapPin className="w-2.5 h-2.5" /> {cls.room}</> : `until ${formatTime(cls.end_time)}`}</>
                : <>{formatTime(cls.start_time)}{minutesUntil > 0 ? ` · in ${formatCountdown(minutesUntil)}` : ''}</>}
            </p>
          </div>
          <button
            onClick={() => startForClass(cls)}
            disabled={starting}
            aria-label={`Record ${cls.name}`}
            title={cls.recording_consent_confirmed ? 'Start recording' : 'Record (confirms permission first)'}
            className="relative w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 hover:bg-primary/90 active:scale-95 transition-all duration-micro disabled:opacity-60 shadow-1"
          >
            {isLive && !starting && (
              <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping motion-reduce:hidden" aria-hidden="true" />
            )}
            {starting
              ? <Loader2 className="w-[18px] h-[18px] animate-spin relative" />
              : <Mic className="w-5 h-5 relative" strokeWidth={2} />}
          </button>
        </div>
      </div>
    </div>
  );
}
