import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { fetchWithCache } from '@/hooks/useEntityData';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useUndo, UndoToast } from '@/hooks/useUndo';
import { Plus, Sun, Moon, GraduationCap, Clock, MapPin, ChevronRight, Calendar, AlertCircle } from 'lucide-react';
import Timeline from '@/components/Timeline';
import WeeklyCalendar from '@/components/WeeklyCalendar';
import EditClassModal from '@/components/EditClassModal';
import TodayIntelligenceCard from '@/components/TodayIntelligenceCard';
import RiskIndicatorCard from '@/components/RiskIndicatorCard';
import AddExamOrStudyModal from '@/components/AddExamOrStudyModal';
import DailyProgressRing from '@/components/DailyProgressRing';
import FloatingActionButton from '@/components/FloatingActionButton';
import AutoPrintPrompt from '@/components/AutoPrintPrompt';

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDayOfWeek() {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[new Date().getDay()];
}

export default function Home() {
  const [tab, setTab] = useState('today');
  const [classes, setClasses] = useState([]);
  const [events, setEvents] = useState([]);
  const [activeSemester, setActiveSemester] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showAddClass, setShowAddClass] = useState(false);
  const [editClass, setEditClass] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [studySessions, setStudySessions] = useState([]);
  const [examWeek, setExamWeek] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showAddExamOrStudy, setShowAddExamOrStudy] = useState(false);
  const { toast, showUndo, handleUndo, dismiss } = useUndo();

  // Keyboard shortcuts: N = new event
  useKeyboardShortcuts({
    onNewEvent: () => setShowAddEvent(true),
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const semesters = await fetchWithCache('Semester', 'filter', [{ is_active: true }]);
      if (semesters.length > 0) setActiveSemester(semesters[0]);
      const today = getTodayString();

      const [allClasses, todayEvents, allAssignments, allSessions] = await Promise.all([
        semesters.length > 0
          ? fetchWithCache('Class', 'filter', [{ semester_id: semesters[0].id }])
          : Promise.resolve([]),
        fetchWithCache('CalendarEvent', 'filter', [{ date: today }]),
        fetchWithCache('Assignment', 'list', []),
        fetchWithCache('StudySession', 'list', []),
      ]);

      setClasses(allClasses);
      setEvents(todayEvents);
      setAssignments(allAssignments);
      setStudySessions(allSessions);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDeleteClass = useCallback(async (classData) => {
    const snapshot = { ...classData };
    try {
      await base44.entities.Class.delete(classData.id);
      showUndo(`"${classData.name}" deleted`, async () => {
        const { id, created_date, updated_date, created_by_id, ...rest } = snapshot;
        await base44.entities.Class.create(rest);
        loadData();
      });
      loadData();
    } catch (e) { console.error(e); }
  }, [showUndo, loadData]);

  const handleDeleteEvent = useCallback(async (eventId, eventData) => {
    const snapshot = { ...eventData };
    try {
      await base44.entities.CalendarEvent.delete(eventId);
      showUndo('Event deleted', async () => {
        const { id, created_date, updated_date, created_by_id, ...rest } = snapshot;
        await base44.entities.CalendarEvent.create(rest);
        loadData();
      });
      loadData();
    } catch (e) { console.error(e); }
  }, [showUndo, loadData]);

  // Refetch when sync completes after reconnection
  useEffect(() => {
    const handler = () => loadData();
    window.addEventListener('cedar-data-changed', handler);
    return () => window.removeEventListener('cedar-data-changed', handler);
  }, [loadData]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const greeting = (() => {
    const h = currentTime.getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const todayClasses = classes.filter(c => {
    return (c.days_of_week || []).some(d => d === getDayOfWeek());
  });

  const allItems = [
    ...todayClasses.map(c => ({
      id: c.id,
      title: c.name,
      time: c.start_time,
      endTime: c.end_time,
      type: 'class',
      room: c.room,
      instructor: c.instructor,
      color: c.color,
      classId: c.id,
    })),
    ...events.map(e => ({
      id: e.id,
      title: e.title,
      time: e.start_time,
      endTime: e.end_time,
      type: e.type,
      notes: e.notes,
      color: e.color,
    })),
  ].sort((a, b) => {
    const timeCompare = (a.time || '99:99').localeCompare(b.time || '99:99');
    if (!examWeek || timeCompare !== 0) return timeCompare;
    // During exam week, study blocks sort above custom/reminder events at the same time
    const priority = (item) =>
      item.type === 'study' ? 0
        : (item.type === 'custom' || item.type === 'reminder') ? 2
        : 1;
    return priority(a) - priority(b);
  }).map(item => {
    // Dim low-priority events during exam week
    if (examWeek && !item.classId && (item.type === 'custom' || item.type === 'reminder')) {
      return { ...item, dimmed: true };
    }
    return item;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!activeSemester) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center animate-fade-in">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <GraduationCap className="w-10 h-10 text-primary" strokeWidth={1.5} />
        </div>
        <h1 className="font-heading text-2xl font-bold text-foreground mb-2">Welcome to Cedar</h1>
        <p className="text-muted-foreground text-sm max-w-sm mb-8">
          Upload your university timetable to automatically set up your semester, or start with an empty schedule.
        </p>
        <Link to="/setup" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" />
          Set Up Semester
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-10 animate-fade-in">
      {/* Tab bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1 border-b border-border">
          <button onClick={() => setTab('today')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'today' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            Today
          </button>
          <button onClick={() => setTab('classes')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'classes' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            Classes
          </button>
        </div>
        <ThemeToggle />
      </div>

      {/* Today tab */}
      {tab === 'today' && (
        <div>
          {/* Greeting header */}
          <div className="mb-5">
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">{greeting}</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-muted-foreground">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <span className="text-muted-foreground/40">•</span>
              <p className="text-sm text-muted-foreground tabular-nums">
                {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
          </div>

          {/* Auto-print prompt for today's transcripts */}
          <AutoPrintPrompt />

          {/* Daily progress ring — "Am I on track?" */}
          <DailyProgressRing
            classes={todayClasses}
            events={events}
            studySessions={studySessions}
            currentTime={currentTime}
          />

          {/* Intelligence + alerts — "What should I work on?" + "Is there anything urgent?" */}
          <TodayIntelligenceCard
            todayClasses={todayClasses}
            events={events}
            assignments={assignments}
            studySessions={studySessions}
            onExamWeekChange={setExamWeek}
            onRecalculateComplete={loadData}
            onAddStudyBlock={() => setShowAddExamOrStudy(true)}
          />
          <RiskIndicatorCard />
          <Timeline items={allItems} onAddEvent={() => setShowAddEvent(true)} />
        </div>
      )}

      {/* Classes tab */}
      {tab === 'classes' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg font-semibold text-foreground">Weekly Schedule</h2>
            <button onClick={() => setShowAddClass(true)}
              className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> Add Class
            </button>
          </div>

          <WeeklyCalendar classes={classes} onEditClass={(c) => setEditClass(c)} />

          {/* Class list */}
          <div className="mt-6 space-y-2">
            {classes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <GraduationCap className="w-8 h-8 text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-sm text-muted-foreground">No classes yet.</p>
              </div>
            ) : (
              classes.map(c => (
                <button key={c.id} onClick={() => setEditClass(c)}
                  className="w-full flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:shadow-2 hover:-translate-y-0.5 transition-all duration-micro text-left">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: (c.color || '#3B82F6') + '20', color: c.color || '#3B82F6' }}>
                    <GraduationCap className="w-5 h-5" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-foreground truncate">{c.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      {c.instructor && <span>{c.instructor}</span>}
                      {c.room && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{c.room}</span>}
                      {c.start_time && <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{c.start_time}</span>}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddEvent && <AddEventModal onClose={() => { setShowAddEvent(false); loadData(); }} />}
      {showAddExamOrStudy && <AddExamOrStudyModal classes={classes} onClose={() => { setShowAddExamOrStudy(false); loadData(); }} />}
      {showAddClass && <EditClassModal semesterId={activeSemester.id} onClose={() => { setShowAddClass(false); loadData(); }} />}
      {editClass && <EditClassModal classData={editClass} semesterId={activeSemester.id} onDeleteClass={handleDeleteClass} onClose={() => { setEditClass(null); loadData(); }} />}

      {/* Undo toast */}
      <UndoToast toast={toast} onUndo={handleUndo} onDismiss={dismiss} />

      {/* Floating action button */}
      <FloatingActionButton actions={[
        { label: 'Add Event', icon: Calendar, onClick: () => setShowAddEvent(true) },
        { label: 'Add Exam', icon: AlertCircle, onClick: () => setShowAddExamOrStudy(true) },
        { label: 'Add Class', icon: GraduationCap, onClick: () => setShowAddClass(true) },
      ]} />
    </div>
  );
}

function ThemeToggle() {
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));
  return (
    <button
      onClick={() => {
        const next = !isDark;
        setIsDark(next);
        document.documentElement.classList.toggle('dark', next);
        localStorage.setItem('cedar-theme', next ? 'dark' : 'light');
      }}
      className="w-9 h-9 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

function AddEventModal({ onClose }) {
  const [form, setForm] = useState({
    title: '',
    date: getTodayString(),
    start_time: '',
    end_time: '',
    type: 'custom',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.start_time) return;
    setSaving(true);
    try {
      await base44.entities.CalendarEvent.create({ ...form, color: '#3B82F6' });
      onClose();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 glass" onClick={onClose}>
      <div className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border p-6 animate-fade-in" onClick={e => e.stopPropagation()}>
        <h3 className="font-heading text-lg font-semibold mb-4">Add Event</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="text" placeholder="Event title" value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })}
              className="px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            <input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })}
              className="px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
            <option value="custom">Custom</option>
            <option value="study">Study Block</option>
            <option value="work">Work Shift</option>
            <option value="appointment">Appointment</option>
            <option value="reminder">Reminder</option>
          </select>
          <textarea placeholder="Notes (optional)" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" rows={2} />
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted">Cancel</button>
            <button type="submit" disabled={saving || !form.title} className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              {saving ? 'Adding...' : 'Add Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}