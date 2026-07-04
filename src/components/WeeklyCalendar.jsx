import React from 'react';
import { Clock } from 'lucide-react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOUR_HEIGHT = 44;

function parseTime(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.split(':').map(Number);
  return parts[0] * 60 + (parts[1] || 0);
}

function formatHour(h) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${dh}${ampm}`;
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${dh}:${String(m || 0).padStart(2, '0')} ${ampm}`;
}

export default function WeeklyCalendar({ classes, onEditClass }) {
  if (!classes || classes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center">
        <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground">No classes yet. Add a class to see your weekly schedule.</p>
      </div>
    );
  }

  const allTimes = classes.flatMap(c => {
    const s = parseTime(c.start_time);
    const e = parseTime(c.end_time) || (s != null ? s + 60 : null);
    return [s, e].filter(t => t != null);
  });

  const startMin = allTimes.length ? Math.floor(Math.min(...allTimes) / 60) * 60 : 8 * 60;
  const endMin = allTimes.length ? Math.ceil(Math.max(...allTimes) / 60) * 60 : 18 * 60;
  const totalHeight = ((endMin - startMin) / 60) * HOUR_HEIGHT;

  const hours = [];
  for (let m = startMin; m <= endMin; m += 60) hours.push(m);

  const activeDays = DAYS.filter(d => classes.some(c => (c.days_of_week || []).includes(d)));
  const displayDays = activeDays.length > 0 ? activeDays : DAYS.slice(0, 5);

  return (
    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <div className="min-w-[600px] rounded-xl border border-border bg-card overflow-hidden">
        {/* Day headers */}
        <div className="flex border-b border-border bg-muted/30">
          <div className="w-12 flex-shrink-0"></div>
          {displayDays.map(d => (
            <div key={d} className="flex-1 text-center py-2 text-xs font-semibold text-muted-foreground">{d}</div>
          ))}
        </div>
        {/* Grid */}
        <div className="flex relative" style={{ height: totalHeight }}>
          {/* Time labels */}
          <div className="w-12 flex-shrink-0 relative">
            {hours.map(m => {
              const top = ((m - startMin) / 60) * HOUR_HEIGHT;
              const h = m / 60;
              return (
                <div key={m} className="absolute right-2 text-[10px] font-medium text-muted-foreground tabular-nums" style={{ top: top - 6 }}>
                  {formatHour(h)}
                </div>
              );
            })}
          </div>
          {/* Day columns */}
          {displayDays.map(day => (
            <div key={day} className="flex-1 relative border-l border-border">
              {hours.map(m => {
                const top = ((m - startMin) / 60) * HOUR_HEIGHT;
                return <div key={m} className="absolute left-0 right-0 border-t border-border/40" style={{ top }}></div>;
              })}
              {classes.filter(c => (c.days_of_week || []).includes(day)).map(c => {
                const start = parseTime(c.start_time);
                const end = parseTime(c.end_time) || start + 60;
                if (start == null) return null;
                const top = ((start - startMin) / 60) * HOUR_HEIGHT;
                const height = Math.max(20, ((end - start) / 60) * HOUR_HEIGHT - 2);
                return (
                  <button key={c.id} onClick={() => onEditClass?.(c)}
                    className="absolute left-0.5 right-0.5 rounded-md text-left p-1 overflow-hidden hover:shadow-md transition-all"
                    style={{ top, height, backgroundColor: (c.color || '#3B82F6') + '18', borderLeft: `2px solid ${c.color || '#3B82F6'}` }}>
                    <p className="text-[10px] font-semibold text-foreground truncate leading-tight">{c.name}</p>
                    {height > 28 && <p className="text-[9px] text-muted-foreground tabular-nums leading-tight">{formatTime(c.start_time)}</p>}
                    {height > 40 && c.room && <p className="text-[9px] text-muted-foreground truncate leading-tight">{c.room}</p>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}