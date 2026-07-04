import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Calendar, CheckCircle2, Users } from 'lucide-react';

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${dh}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatCountdown(minutes) {
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const SOCIAL_TYPES = ['custom', 'work', 'appointment'];

export default function UpNextCard({ todayClasses, events }) {
  const [now, setNow] = useState(new Date());
  const notifiedRef = useRef(new Set());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const nowMin = now.getHours() * 60 + now.getMinutes();

  const parseTime = (t) => {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

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
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

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
            new Notification('All classes done for today!', {
              body: `Next up: ${socialNext.title} at ${formatTime(socialNext.start_time)}`,
            });
          } else {
            new Notification('All classes done for today!', {
              body: "You're finished for today. Enjoy your evening!",
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
            style={{ backgroundColor: (nextClass.color || '#3B82F6') + '20', color: nextClass.color || '#3B82F6' }}>
            <GraduationCap className="w-6 h-6" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">Up Next</span>
              <span className="text-[10px] font-bold text-primary tabular-nums bg-primary/10 px-1.5 py-0.5 rounded">{formatCountdown(minutesUntil)}</span>
            </div>
            <p className="text-sm font-semibold text-foreground truncate">{nextClass.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {formatTime(nextClass.start_time)}{nextClass.room ? ` · ${nextClass.room}` : ''}
            </p>
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
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-500">All classes done for today!</p>
            <p className="text-[11px] text-muted-foreground">Great job getting through your day.</p>
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
              <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">Up Next</span>
              <span className="text-[10px] font-bold text-primary tabular-nums bg-primary/10 px-1.5 py-0.5 rounded">{formatCountdown(nextEvent.startMin - nowMin)}</span>
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