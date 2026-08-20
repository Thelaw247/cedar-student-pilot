import React from 'react';
import DailyProgressRing from '@/components/DailyProgressRing';
import WeeklyCalendar from '@/components/WeeklyCalendar';

const classes = [
  {
    id: 'demo-phys',
    name: 'PHYS 117',
    room: 'Engineering 2B01',
    days_of_week: ['Mon', 'Wed', 'Fri'],
    start_time: '09:30',
    end_time: '10:20',
    color: '#2E66FF',
  },
  {
    id: 'demo-math',
    name: 'MATH 123',
    room: 'Arts 134',
    days_of_week: ['Tue', 'Thu'],
    start_time: '11:00',
    end_time: '12:20',
    color: '#8B5CF6',
  },
  {
    id: 'demo-chem',
    name: 'CHEM 112',
    room: 'Thorvaldson 105',
    days_of_week: ['Mon', 'Wed', 'Fri'],
    start_time: '14:30',
    end_time: '15:20',
    color: '#10B981',
  },
];

function localDateString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function RealProductPreview() {
  const demoTime = new Date();
  demoTime.setHours(13, 10, 0, 0);
  const today = localDateString(demoTime);

  return (
    <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_30px_80px_-36px_rgba(15,23,42,0.35)]">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
        <div>
          <p className="text-sm font-semibold text-slate-950">Cedar Student Pilot</p>
          <p className="text-[11px] text-slate-500">Live preview using the real Cedar interface</p>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">Production UI</span>
      </div>

      <div className="bg-background p-4 sm:p-6 pointer-events-none select-none">
        <div className="mb-5">
          <p className="text-xs text-muted-foreground">Today</p>
          <h3 className="font-heading mt-0.5 text-xl font-bold text-foreground sm:text-2xl">Your semester at a glance</h3>
        </div>

        <DailyProgressRing
          classes={classes}
          events={[{ id: 'demo-event', title: 'Lab report', end_time: '16:00' }]}
          studySessions={[{ id: 'demo-study', scheduled_date: today, status: 'scheduled' }]}
          attendance={[{ id: 'demo-att', class_id: 'demo-phys', date: today, attended: true }]}
          lectures={[{ id: 'demo-lec', class_id: 'demo-phys', date: today }]}
          currentTime={demoTime}
        />

        <WeeklyCalendar classes={classes} />
      </div>
    </div>
  );
}
