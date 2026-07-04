import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Clock, TrendingUp, Calendar, Brain, BarChart3, Headphones, Loader2, GraduationCap } from 'lucide-react';

export default function Analytics() {
  const [records, setRecords] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const recs = await base44.entities.StudyRecord.list('-date', 200);
        setRecords(recs);
        const semesters = await base44.entities.Semester.filter({ is_active: true });
        if (semesters.length > 0) {
          const cls = await base44.entities.Class.filter({ semester_id: semesters[0].id });
          setClasses(cls);
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  const classMap = Object.fromEntries(classes.map(c => [c.id, c]));

  // Calculate totals
  const todayStr = new Date().toISOString().split('T')[0];
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];

  const todaySeconds = records.filter(r => r.date === todayStr).reduce((s, r) => s + r.duration_seconds, 0);
  const weekSeconds = records.filter(r => r.date >= weekAgoStr).reduce((s, r) => s + r.duration_seconds, 0);
  const totalSeconds = records.reduce((s, r) => s + r.duration_seconds, 0);

  // Bar chart data (last 7 days)
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const seconds = records.filter(r => r.date === dateStr).reduce((s, r) => s + r.duration_seconds, 0);
    days.push({
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      minutes: Math.round(seconds / 60),
      isToday: dateStr === todayStr,
    });
  }

  // Streak calculation
  let streak = 0;
  const sortedDates = [...new Set(records.map(r => r.date))].sort().reverse();
  if (sortedDates.length > 0) {
    const today = new Date();
    for (let i = 0; i < sortedDates.length; i++) {
      const expected = new Date();
      expected.setDate(today.getDate() - i);
      if (sortedDates[i] === expected.toISOString().split('T')[0]) streak++;
      else break;
    }
  }

  // Goal achievements
  const goalMet = records.filter(r => r.duration_seconds >= (r.goal_minutes || 90) * 60).length;

  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return `${seconds}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-10 animate-fade-in">
        <h1 className="font-heading text-xl sm:text-2xl font-bold mb-2">Analytics</h1>
        <p className="text-sm text-muted-foreground mb-8">Track your study time and progress.</p>
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground mb-1">No study sessions recorded yet.</p>
          <p className="text-xs text-muted-foreground">Start a focus session to see your analytics here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-10 animate-fade-in">
      <h1 className="font-heading text-xl sm:text-2xl font-bold mb-2">Analytics</h1>
      <p className="text-sm text-muted-foreground mb-8">Track your study time and progress.</p>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatCard icon={Clock} label="Today" value={formatDuration(todaySeconds)} color="text-primary" />
        <StatCard icon={TrendingUp} label="This Week" value={formatDuration(weekSeconds)} color="text-emerald-600" />
        <StatCard icon={BarChart3} label="All Time" value={formatDuration(totalSeconds)} color="text-amber-600" />
      </div>

      {/* Streak & goals */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">Current Streak</span>
          </div>
          <p className="font-heading text-2xl font-bold">{streak} {streak === 1 ? 'day' : 'days'}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-medium text-muted-foreground">Goals Met</span>
          </div>
          <p className="font-heading text-2xl font-bold">{goalMet}</p>
        </div>
      </div>

      {/* Weekly chart */}
      <div className="rounded-xl border border-border bg-card p-5 mb-8">
        <h3 className="text-sm font-semibold mb-4">Last 7 Days</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={days}>
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
              formatter={(v) => [`${v} min`, 'Studied']}
            />
            <Bar dataKey="minutes" radius={[6, 6, 0, 0]}>
              {days.map((entry, i) => (
                <Cell key={i} fill={entry.isToday ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.4)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent sessions */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Recent Sessions</h3>
        <div className="space-y-2">
          {records.slice(0, 15).map(r => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Headphones className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {r.class_id ? (classMap[r.class_id]?.name || 'Study Session') : 'Study Session'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  {r.mode && ` • ${r.mode === 'pomodoro' ? 'Pomodoro' : 'Simple'}`}
                  {r.cycles_completed > 0 && ` • ${r.cycles_completed} cycles`}
                </p>
              </div>
              <p className="text-sm font-semibold tabular-nums">{formatDuration(r.duration_seconds)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <Icon className={`w-4 h-4 mb-2 ${color}`} />
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-lg font-bold">{value}</p>
    </div>
  );
}