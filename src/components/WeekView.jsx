import React from 'react';
import { GraduationCap, Briefcase, BookOpen, Bell, Calendar as CalIcon, Clock, MapPin } from 'lucide-react';
import { getClassMeetingsForDate, getMeetingRoom } from '@/lib/classSchedule';
import { expandEventsInRange, weekDates, parseLocalDate } from '@/lib/eventSchedule';
import { sessionTitle } from '@/lib/sessionTitle';

const TYPE_META = {
  class:       { icon: GraduationCap, color: '#3B82F6', label: 'Class' },
  work:        { icon: Briefcase,     color: '#F59E0B', label: 'Work' },
  study:       { icon: BookOpen,      color: '#8B5CF6', label: 'Study' },
  appointment: { icon: CalIcon,       color: '#10B981', label: 'Appointment' },
  reminder:    { icon: Bell,          color: '#EC4899', label: 'Reminder' },
  custom:      { icon: CalIcon,       color: '#3B82F6', label: 'Event' },
};

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m || 0).padStart(2, '0')} ${period}`;
}

/**
 * WeekView — everything happening in one week, grouped by day: class meetings
 * (per-day aware), study sessions, and events (one-time + expanded recurring).
 * weekOffset shifts which week is shown (0 = current).
 */
export default function WeekView({ classes = [], events = [], studySessions = [], weekOffset = 0 }) {
  const dates = weekDates(new Date(), weekOffset);
  const rangeStart = dates[0];
  const rangeEnd = dates[6];
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  // Pre-expand events across the whole visible week once.
  const weekEvents = expandEventsInRange(events, rangeStart, rangeEnd);

  const itemsForDate = (dateStr) => {
    const items = [];

    // Actual class occurrences on this date, including irregular rules.
    for (const c of classes) {
      getClassMeetingsForDate(c, dateStr).forEach((meeting, index) => {
        items.push({
          key: `c-${c.id}-${dateStr}-${index}`, kind: 'class', title: c.name,
          start: meeting.start_time || c.start_time, end: meeting.end_time || c.end_time, color: c.color || '#3B82F6',
          room: getMeetingRoom(c, meeting), meta: meeting.component || meeting.instructor || c.instructor,
        });
      });
    }
    // Study sessions scheduled on this date.
    for (const s of studySessions.filter(ss => ss.scheduled_date === dateStr)) {
      items.push({
        // Titles come from the session's own `title` field. `notes` is the
        // description and is deliberately NOT used as a label here.
        key: `s-${s.id}`, kind: 'study', title: sessionTitle(s),
        start: s.scheduled_time, end: null, color: TYPE_META.study.color,
      });
    }
    // Event occurrences on this date.
    for (const e of weekEvents.filter(ev => ev.date === dateStr)) {
      const meta = TYPE_META[e.type] || TYPE_META.custom;
      items.push({
        key: `e-${e.id}-${dateStr}`, kind: e.type || 'custom', title: e.title,
        start: e.start_time, end: e.end_time, color: e.color || meta.color,
        recurring: e._recurring, notes: e.notes,
      });
    }
    return items.sort((a, b) => (a.start || '99:99').localeCompare(b.start || '99:99'));
  };

  return (
    <div className="space-y-3">
      {dates.map(dateStr => {
        const items = itemsForDate(dateStr);
        const d = parseLocalDate(dateStr);
        const isToday = dateStr === todayStr;
        return (
          <div key={dateStr} className={`rounded-xl border p-3 ${isToday ? 'border-primary/40 bg-primary/[0.03]' : 'border-border bg-card'}`}>
            <div className="flex items-center gap-2 mb-2">
              <p className={`text-sm font-semibold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                {d.toLocaleDateString('en-US', { weekday: 'long' })}
              </p>
              <p className="text-xs text-muted-foreground">{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
              {isToday && <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Today</span>}
            </div>

            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground py-1.5">Nothing scheduled</p>
            ) : (
              <div className="space-y-1.5">
                {items.map(it => {
                  const meta = TYPE_META[it.kind] || TYPE_META.custom;
                  const Icon = meta.icon;
                  return (
                    <div key={it.key} className="flex items-center gap-2.5 rounded-lg bg-muted/40 px-2.5 py-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: (it.color || meta.color) + '20', color: it.color || meta.color }}>
                        <Icon className="w-3.5 h-3.5" strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-foreground truncate">{it.title}</p>
                          {it.recurring && <span className="text-[9px] text-muted-foreground border border-border rounded px-1">weekly</span>}
                        </div>
                        {(it.room || it.meta) && (
                          <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                            {it.room && <><MapPin className="w-2.5 h-2.5" />{it.room}</>}
                            {it.room && it.meta && <span className="mx-0.5">·</span>}
                            {it.meta}
                          </p>
                        )}
                      </div>
                      {it.start && (
                        <div className="text-right flex-shrink-0">
                          <p className="text-[11px] text-muted-foreground tabular-nums flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />{fmtTime(it.start)}
                          </p>
                          {it.end && <p className="text-[10px] text-muted-foreground/70 tabular-nums">{fmtTime(it.end)}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
