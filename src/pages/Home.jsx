import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, Clock, MapPin, GraduationCap, Sparkles, ChevronRight, Sun, Moon } from 'lucide-react';

const eventTypeConfig = {
  class: { icon: GraduationCap, bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20' },
  study: { icon: Sparkles, bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-500/20' },
  work: { icon: Clock, bg: 'bg-purple-500/10', text: 'text-purple-600', border: 'border-purple-500/20' },
  custom: { icon: Plus, bg: 'bg-blue-500/10', text: 'text-blue-600', border: 'border-blue-500/20' },
  appointment: { icon: Clock, bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-500/20' },
  reminder: { icon: Clock, bg: 'bg-rose-500/10', text: 'text-rose-600', border: 'border-rose-500/20' },
};

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

function getTodayString() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

function getDayOfWeek() {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[new Date().getDay()];
}

export default function Home() {
  const [classes, setClasses] = useState([]);
  const [events, setEvents] = useState([]);
  const [activeSemester, setActiveSemester] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddEvent, setShowAddEvent] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const semesters = await base44.entities.Semester.filter({ is_active: true });
      if (semesters.length > 0) {
        setActiveSemester(semesters[0]);
        const allClasses = await base44.entities.Class.filter({ semester_id: semesters[0].id });
        setClasses(allClasses);
      }
      const today = getTodayString();
      const todayEvents = await base44.entities.CalendarEvent.filter({ date: today });
      setEvents(todayEvents);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const todayClasses = classes.filter(c => {
    const dayMap = { Sun: 'Sun', Mon: 'Mon', Tue: 'Tue', Wed: 'Wed', Thu: 'Thu', Fri: 'Fri', Sat: 'Sat' };
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
  ].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));

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
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs text-muted-foreground font-medium tracking-wide uppercase">
            {new Date().toLocaleDateString('en-US', { weekday: 'long' })}
          </p>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground mt-0.5">
            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
          </h1>
        </div>
        <ThemeToggle />
      </div>

      {/* Summary card */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-bold text-foreground font-heading">{todayClasses.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Classes Today</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-bold text-foreground font-heading">{classes.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total Courses</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-2xl font-bold text-foreground font-heading">{events.filter(e => e.type !== 'class').length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Events</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-lg font-semibold text-foreground">Today's Timeline</h2>
        <button
          onClick={() => setShowAddEvent(true)}
          className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
        >
          <Plus className="w-4 h-4" />
          Add Event
        </button>
      </div>

      {allItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">No events scheduled for today.</p>
          <button onClick={() => setShowAddEvent(true)} className="text-sm text-primary font-medium mt-2 hover:underline">
            Add your first event
          </button>
        </div>
      ) : (
        <div className="relative pl-6">
          <div className="absolute left-2 top-2 bottom-2 w-px bg-border"></div>
          <div className="space-y-3">
            {allItems.map((item) => {
              const config = eventTypeConfig[item.type] || eventTypeConfig.custom;
              const Icon = config.icon;
              return (
                <div key={item.id} className="relative group">
                  <div className={`absolute -left-[18px] top-4 w-2.5 h-2.5 rounded-full ${item.color || '#3B82F6'}`}
                       style={{ backgroundColor: item.color || '#3B82F6' }}></div>
                  <Link
                    to={item.classId ? `/classes/${item.classId}` : '#'}
                    className={`block rounded-xl border ${config.border} bg-card p-4 hover:shadow-md transition-all duration-200`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[11px] font-semibold ${config.text} px-1.5 py-0.5 rounded ${config.bg} uppercase tracking-wide`}>
                            {item.type}
                          </span>
                          <span className="text-xs text-muted-foreground">{formatTime(item.time)}{item.endTime ? ` – ${formatTime(item.endTime)}` : ''}</span>
                        </div>
                        <h3 className="font-medium text-foreground text-sm">{item.title}</h3>
                        {item.room && (
                          <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <MapPin className="w-3 h-3" /> {item.room}
                            {item.instructor && <span className="ml-1">• {item.instructor}</span>}
                          </p>
                        )}
                        {item.notes && <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>}
                      </div>
                      <div className={`w-9 h-9 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-4 h-4 ${config.text}`} strokeWidth={2} />
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showAddEvent && <AddEventModal onClose={() => { setShowAddEvent(false); loadData(); }} />}
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
      await base44.entities.CalendarEvent.create({
        ...form,
        color: eventTypeConfig[form.type]?.bg ? '#3B82F6' : '#3B82F6',
      });
      onClose();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 glass" onClick={onClose}>
      <div className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border p-6 animate-fade-in" onClick={e => e.stopPropagation()}>
        <h3 className="font-heading text-lg font-semibold mb-4">Add Event</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Event title"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            autoFocus
          />
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
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={saving || !form.title} className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {saving ? 'Adding...' : 'Add Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}