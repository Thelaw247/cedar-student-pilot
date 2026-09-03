import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTodaySchedule } from '@/hooks/useTodaySchedule';
import { fetchWithCache } from '@/hooks/useEntityData';
import { Clock, MapPin, GraduationCap, Headphones, ListChecks, BookOpen, CalendarPlus, FileText, AlertCircle } from 'lucide-react';
import { classTint, classColor } from '@/lib/color';
import { formatTime, todayString } from '@/lib/time';
import QuickRecordCard from '@/components/QuickRecordCard';
import { useFeatureGate } from '@/components/monetization/useFeatureGate';
import { Lock } from 'lucide-react';

/**
 * Extra-wide-desktop only (xl: ~1280px+). Below that, this column doesn't
 * render at all — mobile and regular desktop are completely unaffected.
 *
 * The rail is the desktop's quick-access surface (Aug 2026): the things a
 * student would otherwise dig through pages for — record, today's remaining
 * classes, the next deadlines, the last lectures, and one-tap jumps to the
 * most-used tools — all one glance to the right of the content. Everything
 * here is a shortcut to a real page; nothing exists only in the rail, so
 * mobile loses nothing.
 *
 * Credits deliberately do NOT appear here — the CreditMeter pill in the
 * Sidebar (under the profile) is the one credit surface on desktop, and it
 * names the plan. Two balances on one screen read as two sources of truth.
 */

const QUICK_ACTIONS = [
  { to: '/focus', icon: Headphones, label: 'Focus session' },
  { to: '/lecture-review/today', icon: ListChecks, label: 'Review today', feature: 'lecture_review' },
  { to: '/planner', icon: BookOpen, label: 'Study planner' },
  { to: '/todos', icon: ListChecks, label: 'To-do list' },
  { to: '/classes?add=1', icon: CalendarPlus, label: 'Add a class' },
];

export default function DesktopRail() {
  const { loaded, remaining, current } = useTodaySchedule();
  // The one gated shortcut shows its lock up front instead of dead-ending.
  const reviewGate = useFeatureGate('lecture_review');
  const [assignments, setAssignments] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [asgns, lecs, semesters] = await Promise.all([
          fetchWithCache('Assignment', 'list', []),
          fetchWithCache('Lecture', 'list', ['-date', 20]),
          fetchWithCache('Semester', 'filter', [{ is_active: true }]),
        ]);
        const cls = semesters.length > 0
          ? await fetchWithCache('Class', 'filter', [{ semester_id: semesters[0].id }])
          : [];
        if (!cancelled) {
          setAssignments(asgns);
          setLectures(lecs);
          setClasses(cls);
        }
      } catch {
        // Non-fatal — the rail simply shows fewer cards.
      }
    };
    load();
    // Stay current: a finished recording or an edited deadline shows up here
    // without a reload (same app-wide signal every page listens to).
    window.addEventListener('cedar-data-changed', load);
    return () => { cancelled = true; window.removeEventListener('cedar-data-changed', load); };
  }, []);

  const classById = new Map(classes.map((c) => [c.id, c]));
  const today = todayString();

  const dueSoon = assignments
    .filter((a) => (a.status || 'active') === 'active' && a.due_date && a.due_date >= today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 3);

  const recentLectures = lectures
    .filter((l) => l.ai_title || l.transcript)
    .slice(0, 3);

  const daysUntil = (dateStr) => {
    const d = Math.ceil((new Date(`${dateStr}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
    return d === 0 ? 'Today' : d === 1 ? '1 day' : `${d} days`;
  };

  return (
    <aside className="hidden xl:flex w-72 flex-shrink-0 flex-col gap-4 border-l border-border px-4 py-5 h-screen sticky top-0 overflow-y-auto">
      {/* One-tap recording for the class you're in / the next one */}
      <QuickRecordCard />

      {/* Rest of today */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
          Rest of today
        </p>
        {!loaded ? (
          <div className="h-16 rounded-xl bg-muted/50 animate-pulse" />
        ) : remaining.length === 0 ? (
          <p className="text-xs text-muted-foreground px-1">Nothing else scheduled today.</p>
        ) : (
          <div className="space-y-1.5">
            {remaining.map((c) => {
              const isNow = current?.id === c.id;
              return (
                <Link
                  key={c.id}
                  to={`/classes/${c.id}`}
                  className={`flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-muted ${isNow ? 'bg-primary/5' : ''}`}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: classTint(c.color) || 'hsl(var(--primary) / 0.1)', color: classColor(c.color) }}
                  >
                    <GraduationCap className="w-4 h-4" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />{formatTime(c.start_time)}
                      {c.room && <><MapPin className="w-2.5 h-2.5 ml-1" />{c.room}</>}
                    </p>
                  </div>
                  {isNow && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse flex-shrink-0" />}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Due soon — the next deadlines without a trip through the planner */}
      {dueSoon.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
            Due soon
          </p>
          <div className="space-y-1.5">
            {dueSoon.map((a) => {
              const cls = classById.get(a.class_id);
              const urgent = a.due_date <= today;
              return (
                <Link
                  key={a.id}
                  to={a.class_id ? `/classes/${a.class_id}?tab=assignments&assignmentId=${a.id}` : '/planner'}
                  className="flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-muted"
                >
                  <span className="w-[3px] h-7 rounded-full flex-shrink-0" style={{ backgroundColor: classColor(cls?.color) }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{a.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{cls?.name || 'Unassigned'}</p>
                  </div>
                  <span className={`text-[11px] font-medium tabular-nums flex-shrink-0 inline-flex items-center gap-1 ${urgent ? 'text-amber-600 dark:text-amber-500' : 'text-muted-foreground'}`}>
                    {urgent && <AlertCircle className="w-3 h-3" />}
                    {daysUntil(a.due_date)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent lectures — back into yesterday's material in one tap */}
      {recentLectures.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
            Recent lectures
          </p>
          <div className="space-y-1.5">
            {recentLectures.map((l) => {
              const cls = classById.get(l.class_id);
              return (
                <Link
                  key={l.id}
                  to={`/lectures/${l.id}`}
                  className="flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-muted"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: classTint(cls?.color) || 'hsl(var(--primary) / 0.1)', color: classColor(cls?.color) }}
                  >
                    <FileText className="w-4 h-4" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{l.ai_title || `Lecture — ${l.date}`}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{cls?.name || l.date}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick actions — the most-used tools, zero page-hunting */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
          Quick actions
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {QUICK_ACTIONS.map((q) => {
            const locked = q.feature === 'lecture_review' && !reviewGate.allowed;
            if (locked) {
              return (
                <button
                  key={q.to}
                  type="button"
                  onClick={reviewGate.lock}
                  title={`Unlocks with ${reviewGate.requiredTierName}`}
                  className="flex flex-col items-start gap-1.5 rounded-xl border border-border bg-muted/40 p-2.5 text-left hover:bg-muted transition-colors duration-micro"
                >
                  <span className="flex items-center gap-1">
                    <q.icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
                    <Lock className="w-3 h-3 text-muted-foreground" />
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground leading-tight">{q.label}</span>
                </button>
              );
            }
            return (
              <Link
                key={q.to}
                to={q.to}
                className="flex flex-col items-start gap-1.5 rounded-xl border border-border bg-card p-2.5 hover:border-primary/40 hover:bg-primary/[0.03] transition-colors duration-micro"
              >
                <q.icon className="w-4 h-4 text-primary" strokeWidth={1.75} />
                <span className="text-[11px] font-medium text-foreground leading-tight">{q.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
