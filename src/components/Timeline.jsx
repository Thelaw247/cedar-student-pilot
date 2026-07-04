import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, GraduationCap, Clock, Sparkles, Plus, Briefcase, Calendar, AlertCircle } from 'lucide-react';

const eventTypeConfig = {
  class: { icon: GraduationCap, text: 'text-primary' },
  study: { icon: Sparkles, text: 'text-purple-600' },
  work: { icon: Briefcase, text: 'text-emerald-600' },
  custom: { icon: Calendar, text: 'text-emerald-600' },
  appointment: { icon: Clock, text: 'text-emerald-600' },
  reminder: { icon: Clock, text: 'text-gray-500' },
};

function parseTime(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.split(':').map(Number);
  return parts[0] * 60 + (parts[1] || 0);
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${dh}:${String(m).padStart(2, '0')} ${ampm}`;
}

function getPriorityColor(item) {
  if (item.type === 'exam') return '#EF4444';
  if (item.type === 'study') return '#8B5CF6';
  if (item.type === 'class') return item.color || '#2D5BFF';
  if (['custom', 'appointment', 'work'].includes(item.type)) return '#10B981';
  if (item.type === 'reminder') return '#9CA3AF';
  return item.color || '#2D5BFF';
}

function findConflicts(items) {
  const parsed = items.map(it => {
    const s = parseTime(it.time);
    const e = parseTime(it.endTime) || (s != null ? s + 60 : null);
    return { item: it, s, e };
  }).filter(p => p.s != null && p.e != null);
  const conflicts = [];
  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      if (parsed[i].s < parsed[j].e && parsed[j].s < parsed[i].e) {
        conflicts.push([parsed[i].item, parsed[j].item]);
      }
    }
  }
  return conflicts;
}

const HOUR_HEIGHT = 56;

export default function Timeline({ items, onAddEvent }) {
  const nowRef = useRef(null);

  useEffect(() => {
    if (nowRef.current) {
      const t = setTimeout(() => {
        nowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
      return () => clearTimeout(t);
    }
  }, [items]);
  if (!items || items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center">
        <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground">No events scheduled for today.</p>
        {onAddEvent && (
          <button onClick={onAddEvent} className="text-sm text-primary font-medium mt-2 hover:underline">
            Add your first event
          </button>
        )}
      </div>
    );
  }

  // Dynamically collapse the range from the first event to the last event
  const eventTimes = items.map(it => {
    const s = parseTime(it.time);
    const e = parseTime(it.endTime) || (s != null ? s + 60 : null);
    return { s, e };
  }).filter(t => t.s != null);

  let startMin = 0;
  let endMin = 24 * 60;
  if (eventTimes.length > 0) {
    const earliest = Math.min(...eventTimes.map(t => t.s));
    const latest = Math.max(...eventTimes.map(t => t.e || t.s + 60));
    startMin = Math.floor(earliest / 60) * 60;
    endMin = Math.ceil(latest / 60) * 60;
  }

  const totalHeight = ((endMin - startMin) / 60) * HOUR_HEIGHT;

  const hours = [];
  for (let m = startMin; m <= endMin; m += 60) hours.push(m);

  const conflicts = findConflicts(items);
  const conflictingIds = new Set(conflicts.flat().map(i => i.id));

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowTop = ((nowMin - startMin) / 60) * HOUR_HEIGHT;
  const showNow = nowMin >= startMin && nowMin <= endMin;

  return (
    <div>
    {conflicts.length > 0 && (
      <div className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/5 p-2.5 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
        <p className="text-xs text-rose-600 font-medium">
          {conflicts.length} scheduling conflict{conflicts.length !== 1 ? 's' : ''} detected — overlapping events highlighted in red
        </p>
      </div>
    )}
    <div className="relative" style={{ height: totalHeight }}>
      {/* Hour grid lines + labels */}
      {hours.map((min, i) => {
        const top = ((min - startMin) / 60) * HOUR_HEIGHT;
        const h = min / 60;
        const ampm = h >= 12 ? 'PM' : 'AM';
        const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return (
          <div key={i} className="absolute left-0 right-0 flex items-start" style={{ top }}>
            <div className="w-14 flex-shrink-0 pr-2 text-right pt-[-4px]">
              <span className="text-[10px] font-medium text-muted-foreground tabular-nums">{dh} {ampm}</span>
            </div>
            <div className="flex-1 border-t border-border"></div>
          </div>
        );
      })}

      {/* Now indicator */}
      {showNow && (
        <div ref={nowRef} className="absolute left-0 right-0 z-20 flex items-center" style={{ top: nowTop }}>
          <div className="w-14 flex-shrink-0 pr-2 flex justify-end">
            <div className="w-2 h-2 rounded-full bg-destructive"></div>
          </div>
          <div className="flex-1 border-t-2 border-destructive"></div>
        </div>
      )}

      {/* Event blocks */}
      {items.map((item) => {
        const start = parseTime(item.time);
        const end = parseTime(item.endTime) || (start != null ? start + 60 : null);
        if (start == null) return null;

        const clampedStart = Math.max(start, startMin);
        const clampedEnd = Math.min(end || start + 60, endMin);
        const top = ((clampedStart - startMin) / 60) * HOUR_HEIGHT;
        const height = Math.max(22, ((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT - 2);
        const config = eventTypeConfig[item.type] || eventTypeConfig.custom;
        const Icon = config.icon;
        const color = getPriorityColor(item);
        const isConflicting = conflictingIds.has(item.id);

        const blockClass = `absolute rounded-lg border bg-card timeline-shadow transition-all overflow-hidden z-10 ${isConflicting ? 'border-rose-500/50 ring-1 ring-rose-500/30' : 'border-border'} ${item.dimmed ? 'opacity-40 grayscale' : ''}`;
        const blockStyle = {
          top: top + 1,
          height,
          left: '60px',
          right: '4px',
          borderLeft: `3px solid ${color}`,
        };

        const blockContent = (
          <div className="px-2 py-0.5">
            <div className="flex items-center gap-1.5">
              <Icon className={`w-3 h-3 ${config.text} flex-shrink-0`} strokeWidth={2} />
              <span className="text-xs font-medium text-foreground truncate">{item.title}</span>
            </div>
            {height > 34 && (
              <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                {formatTime(item.time)}{item.endTime ? ` – ${formatTime(item.endTime)}` : ''}
              </p>
            )}
            {height > 50 && item.room && (
              <p className="text-[10px] text-muted-foreground truncate flex items-center gap-0.5 mt-0.5">
                <MapPin className="w-2.5 h-2.5" /> {item.room}
                {item.instructor && <span className="ml-1">• {item.instructor}</span>}
              </p>
            )}
            {height > 66 && item.notes && (
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">{item.notes}</p>
            )}
          </div>
        );

        if (item.classId) {
          return (
            <Link key={item.id} to={`/classes/${item.classId}`} className={blockClass} style={blockStyle}>
              {blockContent}
            </Link>
          );
        }
        return (
          <div key={item.id} className={blockClass} style={blockStyle}>
            {blockContent}
          </div>
        );
      })}
    </div>
    </div>
  );
}