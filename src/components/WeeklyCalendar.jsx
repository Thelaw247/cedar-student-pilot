import React from 'react';
import { Clock } from 'lucide-react';
import { getClassMeetings } from '@/lib/classSchedule';
import { weekDates, expandEventsInRange, parseLocalDate } from '@/lib/eventSchedule';
import { sessionTitle } from '@/lib/sessionTitle';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOUR_HEIGHT = 44;

// The grid always spans 8am–5pm so the calendar looks the same from week to
// week. Without a fixed floor/ceiling the window collapsed to whatever happened
// to be scheduled — a single 10–11am class rendered a one-hour-tall calendar.
// Anything outside this range extends the grid, plus one hour of padding so the
// outlying event isn't flush against the edge.
const DAY_START_MIN = 8 * 60;   // 08:00
const DAY_END_MIN = 17 * 60;    // 17:00
const EDGE_PADDING_MIN = 60;    // extra hour beyond an out-of-range event

// Breathing room so an event block never sits on top of an hour line: 1px below
// the line it starts on, clear of the next one, and inset from the column edges
// so the gridline stays visible either side of it.
const BLOCK_INSET_X = 4;        // px each side
const BLOCK_GAP_Y = 3;          // px trimmed from the block's height

// Rendered height of an hour label, used to keep the first and last ones from
// straddling the gridlines that bound the grid.
const LABEL_HEIGHT = 12;

// Colors for non-class items so the grid reads consistently with the rest of
// the app (study = violet, work = amber, etc.).
const TYPE_COLORS = {
  work: '#F59E0B',
  study: '#8B5CF6',
  appointment: '#10B981',
  reminder: '#EC4899',
  custom: '#3B82F6',
};

function parseTime(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.split(':').map(Number);
  return parts[0] * 60 + (parts[1] || 0);
}

function formatHour(h) {
  // Wrap past midnight — an event ending at 23:30 pushes the grid to hour 24,
  // which would otherwise read "12PM" instead of "12AM".
  const hh = ((h % 24) + 24) % 24;
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const dh = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${dh}${ampm}`;
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${dh}:${String(m || 0).padStart(2, '0')} ${ampm}`;
}

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * WeeklyCalendar — a week-at-a-glance time grid (day columns × hour rows).
 *
 * Base mode (Classes page): pass only `classes` — renders the recurring class
 * timetable, exactly as before.
 *
 * Date-aware mode (Today → Weekly): also pass `events`, `studySessions`,
 * `weekOffset`, and `dateAware`. The grid then maps the shown week's dates onto
 * the columns and overlays study sessions and (expanded recurring) events, so
 * the Today weekly view and the Classes schedule share one identical grid.
 */
export default function WeeklyCalendar({
  classes = [],
  events = [],
  studySessions = [],
  weekOffset = 0,
  dateAware = false,
  onEditClass,
  onEditEvent,
}) {
  // Map the seven day-columns to concrete dates for the shown week (date-aware).
  const dates = dateAware ? weekDates(new Date(), weekOffset) : null; // Mon..Sun
  const dayToDate = {};
  if (dates) DAYS.forEach((d, i) => { dayToDate[d] = dates[i]; });
  const todayStr = todayString();

  // Expand recurring + one-time events across the visible week once.
  const weekEvents = dateAware && dates ? expandEventsInRange(events, dates[0], dates[6]) : [];

  // Collect every item, grouped by day label. Classes are day-of-week based
  // (same every week); study/events are placed by their concrete date.
  const itemsByDay = {};
  for (const day of DAYS) {
    const items = [];
    for (const c of classes) {
      for (const m of getClassMeetings(c).filter(mm => mm.day === day)) {
        items.push({
          key: `c-${c.id}-${day}`, kind: 'class', title: c.name,
          start: m.start_time, end: m.end_time, color: c.color || '#3B82F6',
          room: c.room, onClick: onEditClass ? () => onEditClass(c) : null,
        });
      }
    }
    if (dateAware) {
      const dstr = dayToDate[day];
      for (const s of studySessions.filter(ss => ss.scheduled_date === dstr)) {
        items.push({
          // See src/lib/sessionTitle.js — `notes` is a description, not a title.
          key: `s-${s.id}`, kind: 'study', title: sessionTitle(s),
          start: s.scheduled_time, end: null, color: TYPE_COLORS.study,
        });
      }
      for (const e of weekEvents.filter(ev => ev.date === dstr)) {
        items.push({
          key: `e-${e.id}-${dstr}`, kind: e.type || 'custom', title: e.title,
          start: e.start_time, end: e.end_time,
          color: e.color || TYPE_COLORS[e.type] || TYPE_COLORS.custom,
          recurring: e._recurring,
          onClick: onEditEvent ? () => onEditEvent(e) : null,
        });
      }
    }
    itemsByDay[day] = items;
  }

  const hasAnything = DAYS.some(d => itemsByDay[d].length > 0);
  if (!hasAnything) {
    return (
      <div className="rounded-xl border border-dashed border-border p-12 text-center">
        <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground">
          {dateAware ? 'Nothing scheduled this week.' : 'No classes yet. Add a class to see your weekly schedule.'}
        </p>
      </div>
    );
  }

  // Timed vs untimed split (untimed items get an "all-day" band above the grid).
  const timedByDay = {};
  const untimedByDay = {};
  for (const day of DAYS) {
    timedByDay[day] = itemsByDay[day].filter(it => parseTime(it.start) != null);
    untimedByDay[day] = itemsByDay[day].filter(it => parseTime(it.start) == null);
  }
  const anyUntimed = DAYS.some(d => untimedByDay[d].length > 0);

  // Time range: the standard 8am–5pm day. Anything scheduled outside that
  // widens the grid to the containing hour plus one hour of padding, so an
  // early or late event never sits flush against the top or bottom edge.
  const allTimes = [];
  for (const day of DAYS) {
    for (const it of timedByDay[day]) {
      const s = parseTime(it.start);
      const e = parseTime(it.end) || (s != null ? s + 60 : null);
      if (s != null) allTimes.push(s);
      if (e != null) allTimes.push(e);
    }
  }
  const earliest = allTimes.length ? Math.min(...allTimes) : DAY_START_MIN;
  const latest = allTimes.length ? Math.max(...allTimes) : DAY_END_MIN;
  const startMin = earliest < DAY_START_MIN
    ? Math.max(0, Math.floor(earliest / 60) * 60 - EDGE_PADDING_MIN)
    : DAY_START_MIN;
  const endMin = latest > DAY_END_MIN
    ? Math.min(24 * 60, Math.ceil(latest / 60) * 60 + EDGE_PADDING_MIN)
    : DAY_END_MIN;
  const totalHeight = ((endMin - startMin) / 60) * HOUR_HEIGHT;

  const hours = [];
  for (let m = startMin; m <= endMin; m += 60) hours.push(m);

  // Show only days that have something (fallback Mon–Fri), matching the base grid.
  const activeDays = DAYS.filter(d => itemsByDay[d].length > 0);
  const displayDays = activeDays.length > 0 ? activeDays : DAYS.slice(0, 5);

  return (
    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <div className="min-w-[600px] rounded-xl border border-border bg-card overflow-hidden">
        {/* Day headers */}
        <div className="flex border-b border-border bg-muted/30">
          <div className="w-12 flex-shrink-0"></div>
          {displayDays.map(d => {
            const dstr = dateAware ? dayToDate[d] : null;
            const isToday = !!dstr && dstr === todayStr;
            const dateObj = dstr ? parseLocalDate(dstr) : null;
            return (
              <div key={d} className={`flex-1 text-center py-2 ${isToday ? 'bg-primary/10' : ''}`}>
                <span className={`text-xs font-semibold ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>{d}</span>
                {dateObj && (
                  <span className={`block text-[10px] tabular-nums ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                    {dateObj.getDate()}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* All-day / untimed band (only when some item has no time) */}
        {anyUntimed && (
          <div className="flex border-b border-border/60">
            <div className="w-12 flex-shrink-0 flex items-center justify-end pr-2">
              <span className="text-[9px] font-medium text-muted-foreground">all-day</span>
            </div>
            {displayDays.map(day => (
              <div key={day} className="flex-1 border-l border-border p-1 space-y-1 min-h-[28px]">
                {untimedByDay[day].map(it => {
                  const Tag = it.onClick ? 'button' : 'div';
                  return (
                    <Tag key={it.key} onClick={it.onClick || undefined}
                      className="block w-full text-left rounded-md px-1 py-0.5 overflow-hidden"
                      style={{ backgroundColor: (it.color) + '18', borderLeft: `2px solid ${it.color}` }}>
                      <span className="text-[10px] font-medium text-foreground truncate block leading-tight">{it.title}</span>
                    </Tag>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* Timed grid */}
        <div className="flex relative" style={{ height: totalHeight }}>
          {/* Time labels */}
          <div className="w-12 flex-shrink-0 relative">
            {hours.map(m => {
              const line = ((m - startMin) / 60) * HOUR_HEIGHT;
              const h = m / 60;
              // Labels are centred on their gridline, except the first and last
              // — those would hang over the grid's top and bottom borders, so
              // they're clamped to sit just inside instead.
              const top = Math.min(
                Math.max(line - LABEL_HEIGHT / 2, 0),
                Math.max(0, totalHeight - LABEL_HEIGHT)
              );
              return (
                <div key={m} className="absolute right-2 text-[10px] font-medium text-muted-foreground tabular-nums leading-none" style={{ top }}>
                  {formatHour(h)}
                </div>
              );
            })}
          </div>
          {/* Day columns */}
          {displayDays.map(day => {
            const dstr = dateAware ? dayToDate[day] : null;
            const isToday = !!dstr && dstr === todayStr;
            return (
              <div key={day} className={`flex-1 relative border-l border-border ${isToday ? 'bg-primary/[0.03]' : ''}`}>
                {hours.map(m => {
                  const top = ((m - startMin) / 60) * HOUR_HEIGHT;
                  return <div key={m} className="absolute left-0 right-0 border-t border-border/40" style={{ top }}></div>;
                })}
                {timedByDay[day].map((it, mi) => {
                  const start = parseTime(it.start);
                  const end = parseTime(it.end) || start + 60;
                  if (start == null) return null;
                  // Sit 1px below the hour line this starts on, and stop short
                  // of the next one, so the block never covers a gridline.
                  const top = ((start - startMin) / 60) * HOUR_HEIGHT + 1;
                  const height = Math.max(18, ((end - start) / 60) * HOUR_HEIGHT - BLOCK_GAP_Y);
                  const color = it.color || '#3B82F6';
                  const Tag = it.onClick ? 'button' : 'div';
                  return (
                    <Tag key={it.key || `${day}-${mi}`} onClick={it.onClick || undefined}
                      className="absolute rounded-md text-left p-1 overflow-hidden hover:shadow-md transition-all"
                      style={{
                        top,
                        height,
                        // Inset from the column edges so the hour lines stay
                        // visible either side of the block.
                        left: BLOCK_INSET_X,
                        right: BLOCK_INSET_X,
                        // Tint layered over the card colour keeps the block
                        // opaque, so gridlines don't show through the middle
                        // of an event.
                        backgroundColor: 'hsl(var(--card))',
                        backgroundImage: `linear-gradient(${color}18, ${color}18)`,
                        borderLeft: `2px solid ${color}`,
                      }}>
                      <p className="text-[10px] font-semibold text-foreground truncate leading-tight">{it.title}</p>
                      {height > 28 && <p className="text-[9px] text-muted-foreground tabular-nums leading-tight">{formatTime(it.start)}</p>}
                      {height > 40 && it.room && <p className="text-[9px] text-muted-foreground truncate leading-tight">{it.room}</p>}
                    </Tag>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
