import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { GraduationCap, ChevronRight } from 'lucide-react';

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// Personal events no longer get stamped with an invented per-type hue (law
// 02) — they render neutral everywhere, and types are told apart by icon +
// label. Events created before this change keep the color they stored.

function getTodayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Add Event — covers work and other events, as either a one-time entry or a
 * weekly recurring series (start/end date, start/end time, chosen days).
 * Class creation lives in the Classes tab, so choosing "a class" here routes
 * there via onAddClass rather than duplicating the class form.
 */
export default function AddEventModal({ classes, onAddClass, onClose }) {
  const [repeat, setRepeat] = useState('none'); // 'none' | 'weekly'
  const [form, setForm] = useState({
    title: '',
    type: 'custom',
    date: getTodayString(),
    start_time: '',
    end_time: '',
    notes: '',
    recurrence_days: [],
    recurrence_start_date: getTodayString(),
    recurrence_end_date: '',
  });
  const [saving, setSaving] = useState(false);

  const toggleDay = (d) => {
    setForm(prev => ({
      ...prev,
      recurrence_days: prev.recurrence_days.includes(d)
        ? prev.recurrence_days.filter(x => x !== d)
        : [...prev.recurrence_days, d],
    }));
  };

  const canSave = form.title && form.start_time && (
    repeat === 'none'
      ? !!form.date
      : form.recurrence_days.length > 0 && form.recurrence_start_date && form.recurrence_end_date
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      if (repeat === 'weekly') {
        await base44.entities.CalendarEvent.create({
          title: form.title,
          type: form.type,
          start_time: form.start_time,
          end_time: form.end_time,
          notes: form.notes,
          recurrence: 'weekly',
          recurrence_days: form.recurrence_days,
          recurrence_start_date: form.recurrence_start_date,
          recurrence_end_date: form.recurrence_end_date,
        });
      } else {
        await base44.entities.CalendarEvent.create({
          title: form.title,
          type: form.type,
          date: form.date,
          start_time: form.start_time,
          end_time: form.end_time,
          notes: form.notes,
          recurrence: 'none',
        });
      }
      onClose();
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 glass" onClick={onClose}>
      <div className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border p-6 animate-fade-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="font-heading text-lg font-semibold mb-4">Add Event</h3>

        {/* Route class creation to the Classes tab (single source of truth) */}
        <button onClick={onAddClass}
          className="w-full flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3 mb-4 text-left hover:border-primary/40 transition-colors">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Adding a class?</p>
            <p className="text-xs text-muted-foreground">Classes are managed in the Classes tab.</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        </button>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="text" placeholder="Event title (e.g. Work shift)" value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })} className={inputCls} autoFocus />

          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={inputCls}>
            <option value="custom">General</option>
            <option value="work">Work</option>
            <option value="study">Study block</option>
            <option value="appointment">Appointment</option>
            <option value="reminder">Reminder</option>
          </select>

          {/* One-time vs recurring */}
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <button type="button" onClick={() => setRepeat('none')}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${repeat === 'none' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              One time
            </button>
            <button type="button" onClick={() => setRepeat('weekly')}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${repeat === 'weekly' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              Repeats weekly
            </button>
          </div>

          {repeat === 'none' ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Date</p>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={inputCls} />
            </div>
          ) : (
            <>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Repeats on</p>
                <div className="flex gap-1.5 flex-wrap">
                  {ALL_DAYS.map(d => (
                    <button key={d} type="button" onClick={() => toggleDay(d)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        form.recurrence_days.includes(d) ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:text-foreground'
                      }`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">From date</p>
                  <input type="date" value={form.recurrence_start_date}
                    onChange={e => setForm({ ...form, recurrence_start_date: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Until date</p>
                  <input type="date" value={form.recurrence_end_date}
                    onChange={e => setForm({ ...form, recurrence_end_date: e.target.value })} className={inputCls} />
                </div>
              </div>
            </>
          )}

          {/* Times (apply to each occurrence) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Start time</p>
              <input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} className={inputCls} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">End time</p>
              <input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} className={inputCls} />
            </div>
          </div>

          <textarea placeholder="Notes (optional)" value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })} className={`${inputCls} resize-none`} rows={2} />

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted">Cancel</button>
            <button type="submit" disabled={saving || !canSave}
              className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              {saving ? 'Adding…' : 'Add Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
