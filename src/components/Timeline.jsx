import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Clock, AlertCircle, Trash2 } from 'lucide-react';
import EmptyTimeSuggestion from '@/components/EmptyTimeSuggestion';
import { eventMeta } from '@/lib/eventMeta';
import { classColor } from '@/lib/color';
import { parseTimeToMinutes as parseTime, formatTime } from '@/lib/time';

/**
 * Rail color rules (Design Blueprint, law 02): classes and study sessions
 * render in the class's own color; exams use the problem token; personal
 * events are neutral. Types are told apart by icon + label, never by an
 * invented hue — the old map gave "work" a different color here than
 * WeekView did.
 */
function railColor(item) {
  if (item.type === 'exam') return 'hsl(var(--destructive))';
  if (item.type === 'class' || item.type === 'study') return classColor(item.color);
  return 'hsl(var(--muted-foreground) / 0.55)';
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

export default function Timeline({ items, onAddEvent, onDeleteItem }) {
  const hasEvents = items && items.length > 0;

  // Parse event times
  const eventTimes = hasEvents ? items.map(it => {
    const s = parseTime(it.time);
    const e = parseTime(it.endTime) || (s != null ? s + 60 : null);
    return { s, e };
  }).filter(t => t.s != null) : [];

  // Default to a standard day view (8am–10pm); expand if events extend beyond
  let startMin = 8 * 60;
  let endMin = 22 * 60;
  if (eventTimes.length > 0) {
    const earliest = Math.min(...eventTimes.map(t => t.s));
    const latest = Math.max(...eventTimes.map(t => t.e || t.s + 60));
    startMin = Math.min(startMin, Math.floor(earliest / 60) * 60);
    endMin = Math.max(endMin, Math.ceil(latest / 60) * 60);
  }

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // If all events have passed, extend the timeline so there's room to add new events
  if (nowMin >= endMin) {
    endMin = Math.min(24 * 60, Math.ceil((nowMin + 180) / 60) * 60);
  }

  const totalHeight = ((endMin - startMin) / 60) * HOUR_HEIGHT;

  const hours = [];
  for (let m = startMin; m <= endMin; m += 60) hours.push(m);

  const conflicts = findConflicts(items || []);
  const conflictingIds = new Set(conflicts.flat().map(i => i.id));

  // Calculate free periods between consecutive events (gaps >= 30 min)
  const sortedByStart = (items || [])
    .map(it => {
      const s = parseTime(it.time);
      const e = parseTime(it.endTime) || (s != null ? s + 60 : null);
      return { s, e };
    })
    .filter(p => p.s != null && p.e != null)
    .sort((a, b) => a.s - b.s);

  const gaps = [];
  for (let i = 0; i < sortedByStart.length - 1; i++) {
    const currentEnd = sortedByStart[i].e;
    const nextStart = sortedByStart[i + 1].s;
    if (nextStart - currentEnd >= 30) {
      gaps.push({ start: currentEnd, end: nextStart, key: `gap-${i}` });
    }
  }

  // Add trailing free time after the last event
  if (sortedByStart.length > 0) {
    const lastEnd = sortedByStart[sortedByStart.length - 1].e;
    if (endMin - lastEnd >= 30) {
      gaps.push({ start: lastEnd, end: endMin, key: 'gap-trailing' });
    }
  }

  const nowTop = ((nowMin - startMin) / 60) * HOUR_HEIGHT;
  const showNow = nowMin >= startMin && nowMin <= endMin;

  return (
    <div>
    {conflicts.length > 0 && (
      <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 flex-shrink-0" />
        <p className="text-xs text-amber-700 dark:text-amber-500 font-medium">
          {conflicts.length} scheduling conflict{conflicts.length !== 1 ? 's' : ''} — the overlapping events are highlighted below
        </p>
      </div>
    )}
    <div className="relative" style={{ height: totalHeight }}>
      {/* Hour grid lines stay behind event cards; labels remain visible in the time gutter. */}
      {hours.map((min, i) => {
        const top = ((min - startMin) / 60) * HOUR_HEIGHT;
        const h = min / 60;
        const ampm = h >= 12 ? 'PM' : 'AM';
        const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return (
          <div key={i} className="absolute left-0 right-0 flex items-start" style={{ top, zIndex: 0 }}>
            <div className="w-14 flex-shrink-0 pr-2 text-right">
              <span className="text-[10px] font-medium text-muted-foreground tabular-nums bg-background px-1 leading-tight">{dh} {ampm}</span>
            </div>
            <div className="flex-1 border-t border-border"></div>
          </div>
        );
      })}

      {/* Now indicator line — z-5 so event blocks (z-10) naturally cover it */}
      {showNow && (
        <div className="absolute pointer-events-none" style={{ top: nowTop, left: '60px', right: '4px', zIndex: 5 }}>
          <div className="border-t-2 border-destructive"></div>
        </div>
      )}

      {/* Now bubble — the current time in the gutter, riding the line */}
      {showNow && (
        <div className="absolute left-0 w-14 flex justify-center pointer-events-none" style={{ top: nowTop - 8, zIndex: 30 }}>
          <span className="rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold tabular-nums px-1.5 py-0.5 leading-none whitespace-nowrap">
            {formatTime(`${now.getHours()}:${now.getMinutes()}`)}
          </span>
        </div>
      )}

      {/* Empty time suggestions — free period cards between events */}
      {gaps.map(gap => (
        <EmptyTimeSuggestion
          key={gap.key}
          gapStart={gap.start}
          gapEnd={gap.end}
          startMin={startMin}
          hourHeight={HOUR_HEIGHT}
          nowMin={nowMin}
        />
      ))}

      {/* Event blocks */}
      {(items || []).map((item) => {
        const start = parseTime(item.time);
        const end = parseTime(item.endTime) || (start != null ? start + 60 : null);
        if (start == null) return null;

        const clampedStart = Math.max(start, startMin);
        const clampedEnd = Math.min(end || start + 60, endMin);
        const top = ((clampedStart - startMin) / 60) * HOUR_HEIGHT;
        const height = Math.max(28, ((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT - 2);
        const Icon = eventMeta(item.type).icon;
        const color = railColor(item);
        const isConflicting = conflictingIds.has(item.id);
        // The past quiets down so the eye lands on what's next.
        const isPast = (end || start + 60) < nowMin;

        const blockClass = `absolute rounded-lg border bg-card timeline-shadow transition-all duration-micro overflow-hidden z-10 hover:shadow-2 hover:-translate-y-0.5 ${isConflicting ? 'border-amber-500/50 ring-1 ring-amber-500/30' : 'border-border'} ${item.dimmed ? 'opacity-40 grayscale' : isPast ? 'opacity-55' : ''}`;
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
              <Icon className="w-3 h-3 text-muted-foreground flex-shrink-0" strokeWidth={2} />
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

        // Only items the caller says are deletable get the control, and only
        // when the block is tall enough for it not to sit on the title.
        const canDelete = !!onDeleteItem && !!item.deletable && height > 34;
        const deleteControl = canDelete ? (
          <button
            type="button"
            aria-label={`Delete ${item.title}`}
            title={`Delete ${item.title}`}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteItem(item); }}
            className="absolute top-1 right-1 z-20 rounded-md p-1 text-muted-foreground/70 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        ) : null;

        if (item.classId) {
          return (
            <Link key={item.id} to={`/classes/${item.classId}`} className={`group ${blockClass}`} style={blockStyle}>
              {blockContent}
            </Link>
          );
        }
        return (
          <div key={item.id} className={`group ${blockClass}`} style={blockStyle}>
            {blockContent}
            {deleteControl}
          </div>
        );
      })}

      {/* No events prompt */}
      {!hasEvents && (
        <div className="absolute top-0 bottom-0 flex items-center justify-center" style={{ left: '60px', right: '4px' }}>
          <div className="text-center">
            <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground mb-1">No events scheduled for today.</p>
            {onAddEvent && (
              <button onClick={onAddEvent} className="text-sm text-primary font-medium hover:underline">
                Add your first event
              </button>
            )}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
