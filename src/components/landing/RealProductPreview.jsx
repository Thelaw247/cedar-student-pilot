import React from 'react';
import { CalendarClock, CheckCircle2, Clock3, GraduationCap } from 'lucide-react';
import WeeklyCalendar from '@/components/WeeklyCalendar';
import { weekDates } from '@/lib/eventSchedule';

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

function prettyDate(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function RealProductPreview() {
  const dates = weekDates(new Date(), 1);
  const examDate = dates[4];
  const sessions = [
    { id: 's1', class_id: 'demo-phys', title: 'PHYS 117 Midterm — Session 1', scheduled_date: dates[0], scheduled_time: '18:00', duration_minutes: 60, status: 'scheduled', priority: 'medium' },
    { id: 's2', class_id: 'demo-phys', title: 'PHYS 117 Midterm — Session 2', scheduled_date: dates[1], scheduled_time: '19:30', duration_minutes: 60, status: 'scheduled', priority: 'medium' },
    { id: 's3', class_id: 'demo-phys', title: 'PHYS 117 Midterm — Session 3', scheduled_date: dates[2], scheduled_time: '17:00', duration_minutes: 60, status: 'scheduled', priority: 'high' },
    { id: 's4', class_id: 'demo-phys', title: 'PHYS 117 Midterm — Final review', scheduled_date: dates[3], scheduled_time: '19:00', duration_minutes: 45, status: 'scheduled', priority: 'high' },
  ];
  const events = [
    { id: 'work', title: 'Work shift', type: 'work', date: dates[1], start_time: '16:30', end_time: '19:00', color: '#F59E0B' },
    { id: 'lab', title: 'CHEM lab report', type: 'custom', date: dates[3], start_time: '15:30', end_time: '17:00', color: '#10B981' },
  ];

  return (
    <section id="study-schedule" className="border-y border-border bg-muted px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-[0.76fr_1.24fr] lg:items-center">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-5xl font-black tracking-[-0.07em] text-primary/25">03</span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Study-session booking</p>
                <p className="mt-0.5 text-sm font-semibold text-muted-foreground">Knowing what to study is only half the job.</p>
              </div>
            </div>
            <h2 className="mt-5 text-4xl font-bold leading-[1.04] tracking-[-0.05em] text-foreground sm:text-5xl">
              Give us the exam date. Get the study sessions on your calendar.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
              We spread study across the days before the test, checks the classes, events, and study blocks already on your calendar, and places the new sessions into open time instead of stacking everything into one cram night.
            </p>

            <div className="mt-7 rounded-2xl border border-primary/25 bg-card p-5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Built around research-backed spacing</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Distributed practice — studying across separate sessions instead of massing the same work together — has strong evidence for better long-term retention. We use that principle when we spread sessions across the time before your exam.
              </p>
              <a href="https://pubmed.ncbi.nlm.nih.gov/16719566/" target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-semibold text-primary hover:text-primary">
                Research basis: Cepeda et al., Psychological Bulletin (2006)
              </a>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-4"><CalendarClock className="h-4 w-4 text-primary" /><p className="mt-3 text-sm font-semibold text-foreground">Spread out</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Multiple sessions across the days before the deadline.</p></div>
              <div className="rounded-xl border border-border bg-card p-4"><GraduationCap className="h-4 w-4 text-primary" /><p className="mt-3 text-sm font-semibold text-foreground">Fit around class</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Existing classes, events, and study blocks are treated as busy time.</p></div>
              <div className="rounded-xl border border-border bg-card p-4"><Clock3 className="h-4 w-4 text-primary" /><p className="mt-3 text-sm font-semibold text-foreground">Review before test</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Exams and quizzes get a lighter final review before the due date.</p></div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_24px_70px_-38px_rgba(15,23,42,0.3)]">
            <div className="border-b border-border bg-card p-4 sm:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground/80">Actual Praelecta calendar component · sample schedule</p>
                  <h3 className="mt-1 text-lg font-bold tracking-[-0.025em] text-foreground">PHYS 117 Midterm</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">Exam: {prettyDate(examDate)}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary"><CheckCircle2 className="h-4 w-4" /> 4 sessions booked</span>
              </div>
            </div>

            <div className="bg-background p-3 sm:p-5">
              <WeeklyCalendar
                classes={classes}
                events={events}
                studySessions={sessions}
                weekOffset={1}
                dateAware
              />
            </div>

            <div className="border-t border-border bg-muted p-4 sm:px-5">
              <p className="text-xs font-semibold text-foreground/80">What we’re doing here</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <p className="rounded-lg bg-secondary px-3 py-2 text-[11px] leading-5 text-muted-foreground">Monday–Wednesday: study is distributed instead of saved for Thursday night.</p>
                <p className="rounded-lg bg-secondary px-3 py-2 text-[11px] leading-5 text-muted-foreground">Thursday: a shorter final review is kept open before Friday&rsquo;s exam.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}