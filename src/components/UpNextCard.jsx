import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Calendar, CheckCircle2, Users } from 'lucide-react';
import { formatTime, formatCountdown, parseTimeToMinutes } from '@/lib/time';
import { classTint, classColor } from '@/lib/color';
import { getSetting } from '@/lib/settings';

const SOCIAL_TYPES = ['custom', 'work', 'appointment'];

/**
 * Whether the browser may be told when a class ends. The switch lives in
 * Settings → Notifications and asks the browser for permission when it is
 * turned on, there, where the student can see what they are allowing. This
 * card used to ask on its own the first time Today opened: a permission
 * prompt before the page had shown anything, on an account minutes old. A
 * browser that said yes back then keeps what it had (the switch unset).
 */
export function classChangeNotificationsOn() {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return false;
  return getSetting('classChangeNotifications') !== false;
}

export default function UpNextCard({ todayClasses, events, firstWeek = false }) {
  const [now, setNow] = useState(new Date());
  const notifiedRef = useRef(new Set());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const nowMin = now.getHours() * 60 + now.getMinutes();

  const parseTime = parseTimeToMinutes;

  const allClasses = (todayClasses || [])
    .filter(c => c.start_time && c.end_time)
    .map(c => ({ ...c, startMin: parseTime(c.start_time), endMin: parseTime(c.end_time) }));

  const allEvents = (events || [])
    .filter(e => e.start_time)
    .map(e => ({ ...e, startMin: parseTime(e.start_time), endMin: parseTime(e.end_time) || parseTime(e.start_time) + 60 }));

  const hasClassesToday = allClasses.length > 0;
  const currentClass = allClasses.find(c => nowMin >= c.startMin && nowMin < c.endMin);
  const allClassesDone = hasClassesToday && !currentClass && allClasses.every(c => c.endMin <= nowMin);

  const nextClass = allClasses
    .filter(c => c.startMin > nowMin)
    .sort((a, b) => a.startMin - b.startMin)[0];

  const nextSocialEvent = allEvents
    .filter(e => SOCIAL_TYPES.includes(e.type) && e.startMin > nowMin)
    .sort((a, b) => a.startMin - b.startMin)[0];

  const nextEvent = allEvents
    .filter(e => e.startMin > nowMin)
    .sort((a, b) => a.startMin - b.startMin)[0];

  // Notification: fire when a class ends
  useEffect(() => {
    if (!classChangeNotificationsOn()) return;

    const justEnded = allClasses.filter(c => {
      const minutesSinceEnd = nowMin - c.endMin;
      return minutesSinceEnd >= 0 && minutesSinceEnd <= 1;
    });

    for (const cls of justEnded) {
      if (!notifiedRef.current.has(cls.id)) {
        notifiedRef.current.add(cls.id);
        const next = allClasses
          .filter(c => c.startMin > nowMin)
          .sort((a, b) => a.startMin - b.startMin)[0];

        if (next) {
          new Notification(`Next class: ${next.name}`, {
            body: `Starts in ${formatCountdown(next.startMin - nowMin)}${next.room ? ` at ${next.room}` : ''}`,
          });
        } else {
          const socialNext = allEvents
            .filter(e => SOCIAL_TYPES.includes(e.type) && e.startMin > nowMin)
            .sort((a, b) => a.startMin - b.startMin)[0];

          if (socialNext) {
            new Notification('All classes done for today', {
              body: `Next up: ${socialNext.title} at ${formatTime(socialNext.start_time)}`,
            });
          } else {
            new Notification('All classes done for today', {
              body: 'Nothing else on the timetable. Enjoy the evening.',
            });
          }
        }
      }
    }
  }, [nowMin]);

  // --- Build content ---

  let content = null;

  if (nextClass) {
    const minutesUntil = nextClass.startMin - nowMin;
    content = (
      <Link to={`/classes/${nextClass.id}`}
        className="block rounded-xl border border-border bg-card p-4 hover:shadow-md transition-all">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: classTint(nextClass.color) || 'hsl(var(--primary) / 0.1)', color: classColor(nextClass.color) }}>
            <GraduationCap className="w-6 h-6" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-primary">Up next</span>
              <span className="text-[11px] font-semibold text-primary tabular-nums bg-primary/10 px-1.5 py-0.5 rounded">{minutesUntil < 1 ? 'now' : `in ${formatCountdown(minutesUntil)}`}</span>
            </div>
            <p className="text-sm font-semibold text-foreground truncate">{nextClass.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {formatTime(nextClass.start_time)}{nextClass.room ? ` · ${nextClass.room}` : ''}
            </p>
            {/* Until the first recording exists, the card says when to press
                the button: a plan with a cue ("when X, do Y") is followed far
                more often than an intention without one. */}
            {firstWeek && (
              <p className="text-[11px] text-primary mt-1">Press Record when it starts. The notes make themselves.</p>
            )}
          </div>
        </div>
      </Link>
    );
  } else if (allClassesDone) {
    content = (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-500">All classes done for today</p>
            <p className="text-[11px] text-muted-foreground">Nothing else on the timetable.</p>
          </div>
        </div>
        {nextSocialEvent && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-emerald-500/20">
            <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{nextSocialEvent.title}</p>
              <p className="text-[11px] text-muted-foreground">
                {formatTime(nextSocialEvent.start_time)} · {formatCountdown(nextSocialEvent.startMin - nowMin)} from now
              </p>
            </div>
          </div>
        )}
      </div>
    );
  } else if (!hasClassesToday && nextEvent) {
    content = (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-6 h-6 text-primary" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-primary">Up next</span>
              <span className="text-[11px] font-semibold text-primary tabular-nums bg-primary/10 px-1.5 py-0.5 rounded">{nextEvent.startMin - nowMin < 1 ? 'now' : `in ${formatCountdown(nextEvent.startMin - nowMin)}`}</span>
            </div>
            <p className="text-sm font-semibold text-foreground truncate">{nextEvent.title}</p>
            <p className="text-[11px] text-muted-foreground">{formatTime(nextEvent.start_time)}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!content && !currentClass) return null;

  return (
    <div className="mb-3 space-y-2">
      {currentClass && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{currentClass.name}</p>
            <p className="text-[11px] text-muted-foreground">
              In progress · ends in {formatCountdown(currentClass.endMin - nowMin)}
            </p>
          </div>
        </div>
      )}
      {content}
    </div>
  );
}