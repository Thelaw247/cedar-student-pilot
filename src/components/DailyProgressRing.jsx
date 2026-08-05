import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Check, Clock } from 'lucide-react';

function parseTime(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function DailyProgressRing({ classes, events, studySessions, currentTime }) {
  const today = getTodayString();
  const nowMin = currentTime.getHours() * 60 + currentTime.getMinutes();

  const totalClasses = classes.length;
  const doneClasses = classes.filter(c => c.end_time && parseTime(c.end_time) < nowMin).length;

  const todayStudy = studySessions.filter(s => s.scheduled_date === today);
  const totalStudy = todayStudy.length;
  const doneStudy = todayStudy.filter(s => s.status === 'completed').length;

  const totalEvents = events.length;
  const doneEvents = events.filter(e => e.end_time && parseTime(e.end_time) < nowMin).length;

  const totalItems = totalClasses + totalStudy + totalEvents;
  const doneItems = doneClasses + doneStudy + doneEvents;
  const percentage = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  const segments = [
    { name: 'Classes', done: doneClasses, total: totalClasses, color: '#2D5BFF' },
    { name: 'Study', done: doneStudy, total: totalStudy, color: '#8B5CF6' },
    { name: 'Events', done: doneEvents, total: totalEvents, color: '#10B981' },
  ];

  const ringData = [];
  segments.forEach(s => {
    if (s.done > 0) ringData.push({ name: s.name, value: s.done, fill: s.color });
  });
  const remaining = totalItems - doneItems;
  if (remaining > 0) ringData.push({ name: 'Remaining', value: remaining, fill: 'hsl(var(--muted))' });

  const isOnTrack = totalItems === 0 || percentage >= 50;

  return (
    <div className="rounded-xl border border-border bg-card p-4 mb-4 flex items-center gap-4 timeline-shadow">
      <div className="relative w-20 h-20 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={ringData} dataKey="value" innerRadius="62%" outerRadius="100%" startAngle={90} endAngle={-270} stroke="none" />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-heading text-sm font-bold tabular-nums">{percentage}%</span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Today's Progress</p>
        <div className="space-y-1">
          {segments.map(s => (
            <div key={s.name} className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
              <span className="text-muted-foreground">{s.name}</span>
              <span className="font-medium ml-auto tabular-nums">{s.done}/{s.total}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-shrink-0 self-start">
        {totalItems === 0 ? (
          <span className="text-xs text-muted-foreground font-medium">Nothing scheduled</span>
        ) : isOnTrack ? (
          <div className="flex items-center gap-1.5 text-emerald-600">
            <Check className="w-4 h-4" />
            <span className="text-xs font-medium">On Track</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-amber-600">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium">Catch Up</span>
          </div>
        )}
      </div>
    </div>
  );
}
