import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { GraduationCap, BookOpen, AlertCircle, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${dh}:${String(m).padStart(2, '0')} ${ampm}`;
}

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

function daysBetween(dateStr) {
  const today = new Date(getTodayString());
  const target = new Date(dateStr);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

export default function TodayIntelligenceCard({
  todayClasses,
  assignments,
  studySessions,
  onExamWeekChange,
  onRecalculateComplete,
}) {
  const [recalculating, setRecalculating] = useState(false);
  const today = getTodayString();
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

  // Study blocks today
  const todaySessions = studySessions.filter(s => s.scheduled_date === today && s.status === 'scheduled');
  const totalStudyMinutes = todaySessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);

  // Top priority: soonest-due assignment
  const topPriority = assignments
    .filter(a => a.due_date >= today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0] || null;
  const topDays = topPriority ? daysBetween(topPriority.due_date) : null;

  // Exam week: any exam/quiz due within 7 days
  const upcomingExams = assignments
    .filter(a => (a.type === 'exam' || a.type === 'quiz') && a.due_date >= today && a.due_date <= getTodayPlusDays(7))
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const isExamWeek = upcomingExams.length > 0;

  // Behind schedule
  const behindSessions = studySessions.filter(s => s.status === 'scheduled' && s.scheduled_date < today);

  useEffect(() => {
    onExamWeekChange?.(isExamWeek);
  }, [isExamWeek, onExamWeekChange]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      for (const session of behindSessions) {
        await base44.functions.invoke('rebookStudySession', { session_id: session.id });
      }
      onRecalculateComplete?.();
    } catch (e) {
      console.error(e);
    }
    setRecalculating(false);
  };

  return (
    <div className="mb-4 space-y-3">
      {/* What Matters Today */}
      <div className="rounded-xl border border-border bg-gradient-to-b from-primary/5 to-transparent p-3 sm:p-4">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">What Matters Today</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Next Class */}
          <Link to={nextClass ? `/classes/${nextClass.id}` : '/classes'}
            className="flex items-center gap-2.5 rounded-lg p-2.5 bg-card border border-border hover:shadow-sm transition-all">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: (nextClass?.color || '#3B82F6') + '20', color: nextClass?.color || '#3B82F6' }}>
              <GraduationCap className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              {nextClass ? (
                <>
                  <p className="text-sm font-semibold text-foreground truncate">{nextClass.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {formatTime(nextClass.start_time)}{nextClass.room ? ` · ${nextClass.room}` : ''}
                  </p>
                  <p className="text-[11px] text-primary font-medium">
                    {nextClass.minutesUntil > 0
                      ? `in ${nextClass.minutesUntil} min`
                      : nextClass.minutesUntil >= -15
                        ? 'started'
                        : ''}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-foreground">No classes today</p>
                  <p className="text-[11px] text-muted-foreground">Enjoy your day</p>
                </>
              )}
            </div>
          </Link>

          {/* Study Blocks */}
          <Link to="/planner"
            className="flex items-center gap-2.5 rounded-lg p-2.5 bg-card border border-border hover:shadow-sm transition-all">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-5 h-5 text-amber-600" strokeWidth={1.5} />
            </div>
            <div className="min-w-0 flex-1">
              {todaySessions.length > 0 ? (
                <>
                  <p className="text-sm font-semibold text-foreground">
                    {todaySessions.length} study block{todaySessions.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{totalStudyMinutes} min total</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-foreground">No study blocks</p>
                  <p className="text-[11px] text-muted-foreground">Add an exam to plan</p>
                </>
              )}
            </div>
          </Link>

          {/* Top Priority */}
          {topPriority && (
            <Link to={topPriority.class_id ? `/classes/${topPriority.class_id}` : '/planner'}
              className="flex items-center gap-2.5 rounded-lg p-2.5 bg-card border border-border hover:shadow-sm transition-all">
              <div className="w-9 h-9 rounded-lg bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-rose-600" strokeWidth={1.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{topPriority.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {topDays === 0 ? 'Due today' : topDays === 1 ? '1 day left' : `${topDays} days left`}
                </p>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* Exam Week banner */}
      {isExamWeek && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-center gap-2.5 animate-fade-in">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-500">Exam Week</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {upcomingExams.map(e => {
                const d = daysBetween(e.due_date);
                return `${e.title} (${d === 0 ? 'today' : d === 1 ? 'tomorrow' : `${d}d`})`;
              }).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {/* Behind Schedule banner */}
      {behindSessions.length > 0 && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 flex items-center gap-2.5 animate-fade-in">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-500">You're Behind</p>
            <p className="text-[11px] text-muted-foreground">
              {behindSessions.length} missed session{behindSessions.length !== 1 ? 's' : ''} to reschedule
            </p>
          </div>
          <button onClick={handleRecalculate} disabled={recalculating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 disabled:opacity-50 flex-shrink-0">
            {recalculating
              ? <><Loader2 className="w-3 h-3 animate-spin" /> Recalculating</>
              : <><RefreshCw className="w-3 h-3" /> Recalculate</>}
          </button>
        </div>
      )}
    </div>
  );
}

function getTodayPlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}