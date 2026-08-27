import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Trash2, X, AlertTriangle } from 'lucide-react';
import AutosaveIndicator from '@/components/AutosaveIndicator';

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#EC4899', '#14B8A6'];

const dayIndex = (d) => ALL_DAYS.indexOf(d);
const sortByDay = (arr) => [...arr].sort((a, b) => dayIndex(a.day) - dayIndex(b.day));

// Decide which mode a class opens in: per-day when it has a meetings[] list,
// otherwise the simpler same-time-each-day mode.
function initialMode(classData) {
  const meetings = classData?.meetings || [];
  const duplicateDays = new Set(meetings.map(m => m.day)).size < meetings.length;
  if (meetings.some(m => m.specific_date || m.start_date || m.end_date || m.component || m.section) || duplicateDays) return 'rules';
  return classData?.meetings && classData.meetings.length > 0 ? 'perday' : 'same';
}

export default function EditClassModal({ classData = null, semesterId, onDeleteClass = null, onClose }) {
  const isEdit = !!classData;

  const buildForm = (data) => ({
    name: '',
    course_code: '',
    instructor: '',
    room: '',
    days_of_week: [],
    start_time: '',
    end_time: '',
    class_start_date: '',
    class_end_date: '',
    color: '#3B82F6',
    meetings: [],
    ...data,
  });

  const [form, setForm] = useState(buildForm(classData));
  const [scheduleMode, setScheduleMode] = useState(initialMode(classData));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Autosave state — edit mode only. Creating a class still needs an explicit
  // submit, since there's no record to write to until it exists.
  const [autosaveStatus, setAutosaveStatus] = useState('idle');
  const autosaveTimerRef = useRef(null);
  const skipFirstAutosaveRef = useRef(true);
  // Two-step confirm — clicking the trash icon shows this panel instead of
  // deleting immediately.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (classData) {
      setForm(buildForm(classData));
      setScheduleMode(initialMode(classData));
    }
  }, [classData]);

  // ---- Same-time mode: simple day multi-select ----
  const toggleDaySame = (day) => {
    setForm(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter(d => d !== day)
        : [...prev.days_of_week, day],
    }));
  };

  // ---- Per-day mode: each selected day carries its own times ----
  const meetingDays = (form.meetings || []).map(m => m.day);

  const toggleDayPerDay = (day) => {
    setForm(prev => {
      const exists = (prev.meetings || []).some(m => m.day === day);
      if (exists) {
        return { ...prev, meetings: prev.meetings.filter(m => m.day !== day) };
      }
      // Seed a new day with the last-used times as a convenient default.
      const seedStart = prev.start_time || '09:00';
      const seedEnd = prev.end_time || '10:00';
      return { ...prev, meetings: [...(prev.meetings || []), { day, start_time: seedStart, end_time: seedEnd }] };
    });
  };

  const updateMeetingTime = (day, field, value) => {
    setForm(prev => ({
      ...prev,
      meetings: prev.meetings.map(m => m.day === day ? { ...m, [field]: value } : m),
    }));
  };

  const updateRule = (index, field, value) => {
    setForm(prev => ({
      ...prev,
      meetings: prev.meetings.map((meeting, i) => i === index ? { ...meeting, [field]: value } : meeting),
    }));
  };

  const addRule = () => setForm(prev => ({
    ...prev,
    meetings: [...(prev.meetings || []), {
      day: 'Mon', component: '', start_time: '09:00', end_time: '10:00',
      start_date: prev.class_start_date || '', end_date: prev.class_end_date || '',
    }],
  }));

  const removeRule = (index) => setForm(prev => ({
    ...prev,
    meetings: prev.meetings.filter((_, i) => i !== index),
  }));

  // Switching modes carries the schedule across so nothing is lost.
  const switchMode = (mode) => {
    if (mode === scheduleMode) return;
    if (mode === 'rules') {
      setScheduleMode('rules');
      return;
    }
    if (mode === 'perday') {
      // Seed per-day rows from the currently selected days + shared time.
      setForm(prev => {
        if ((prev.meetings || []).length > 0) return prev;
        const s = prev.start_time || '09:00';
        const e = prev.end_time || '10:00';
        const seeded = (prev.days_of_week || []).map(day => ({ day, start_time: s, end_time: e }));
        return { ...prev, meetings: seeded };
      });
    } else {
      // Collapse per-day rows back to a single shared time (uses the earliest).
      setForm(prev => {
        const sorted = [...(prev.meetings || [])].sort((a, b) => (a.start_time || '99').localeCompare(b.start_time || '99'));
        const first = sorted[0];
        return {
          ...prev,
          days_of_week: (prev.meetings || []).map(m => m.day),
          start_time: prev.start_time || first?.start_time || '',
          end_time: prev.end_time || first?.end_time || '',
        };
      });
    }
    setScheduleMode(mode);
  };

  // Shape the form into the record we persist. Shared by autosave (edit) and
  // the explicit submit (create) so both write exactly the same thing.
  const buildPayload = useCallback(() => {
    let payload;
    {
      if (scheduleMode === 'perday' || scheduleMode === 'rules') {
        const meetings = sortByDay((form.meetings || []).filter(m => m.day));
        const earliest = [...meetings].sort((a, b) => (a.start_time || '99').localeCompare(b.start_time || '99'))[0];
        const dates = meetings.flatMap(m => [m.start_date, m.end_date, m.specific_date]).filter(Boolean).sort();
        payload = {
          ...form,
          semester_id: semesterId,
          meetings,
          // Mirror to legacy fields so day-based filters and summary displays
          // keep working; the meetings[] list is the source of truth for times.
          days_of_week: meetings.map(m => m.day),
          start_time: earliest?.start_time || '',
          end_time: earliest?.end_time || '',
          class_start_date: dates[0] || form.class_start_date || '',
          class_end_date: dates.at(-1) || form.class_end_date || '',
        };
      } else {
        payload = {
          ...form,
          semester_id: semesterId,
          // Clear any per-day data so the reading layer uses the shared time.
          meetings: [],
        };
      }
    }
    return payload;
  }, [form, scheduleMode, semesterId]);

  // Autosave an existing class ~700ms after the last change. Skips the first
  // run (which is just the form being populated from props) and any state
  // where the class has no name, since name is required.
  useEffect(() => {
    if (!isEdit) return;
    if (skipFirstAutosaveRef.current) { skipFirstAutosaveRef.current = false; return; }
    if (!form.name) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    setAutosaveStatus('saving');
    autosaveTimerRef.current = setTimeout(async () => {
      try {
        await base44.entities.Class.update(classData.id, buildPayload());
        setAutosaveStatus('saved');
        setTimeout(() => setAutosaveStatus('idle'), 2000);
      } catch (e) {
        console.error(e);
        setAutosaveStatus('error');
      }
    }, 700);
    return () => { if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current); };
  }, [form, scheduleMode, isEdit, classData?.id, buildPayload]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    // In edit mode everything is already autosaved; this just closes.
    if (isEdit) { onClose(); return; }
    setSaving(true);
    try {
      await base44.entities.Class.create(buildPayload());
      onClose();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!isEdit) return;
    setDeleting(true);
    try {
      if (onDeleteClass) {
        await onDeleteClass(classData);
      } else {
        await base44.entities.Class.delete(classData.id);
      }
      onClose();
    } catch (e) { console.error(e); }
    setDeleting(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/30 glass" onClick={onClose}>
      <div className="bg-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-border p-6 animate-fade-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-lg font-semibold">{isEdit ? 'Edit Class' : 'Add Class'}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        {/* Delete confirmation replaces the form when active */}
        {confirmingDelete ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                This permanently deletes <span className="font-medium text-foreground">{classData?.name}</span>. This can’t be undone.
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmingDelete(false)} disabled={deleting}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {deleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</> : <><Trash2 className="w-4 h-4" /> Delete permanently</>}
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="text" placeholder="Course code" value={form.course_code || ''}
            onChange={e => setForm({ ...form, course_code: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          <input type="text" placeholder="Class name" value={form.name || ''}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" autoFocus />

          <input type="text" placeholder="Professor / Instructor" value={form.instructor || ''}
            onChange={e => setForm({ ...form, instructor: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />

          <input type="text" placeholder="Room / Location" value={form.room || ''}
            onChange={e => setForm({ ...form, room: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />

          {/* Schedule mode toggle */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Schedule</p>
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              <button type="button" onClick={() => switchMode('same')}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${scheduleMode === 'same' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                Same time each day
              </button>
              <button type="button" onClick={() => switchMode('perday')}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${scheduleMode === 'perday' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                Different times per day
              </button>
              <button type="button" onClick={() => switchMode('rules')}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${scheduleMode === 'rules' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                Flexible dates
              </button>
            </div>
          </div>

          {/* Days */}
          {scheduleMode !== 'rules' && <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Days</p>
            <div className="flex gap-1.5 flex-wrap">
              {ALL_DAYS.map(d => {
                const active = scheduleMode === 'perday' ? meetingDays.includes(d) : (form.days_of_week || []).includes(d);
                return (
                  <button key={d} type="button" onClick={() => scheduleMode === 'perday' ? toggleDayPerDay(d) : toggleDaySame(d)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      active ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:text-foreground'
                    }`}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>}

          {/* Times — shared (same mode) */}
          {scheduleMode === 'same' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Start time</p>
                <input type="time" value={form.start_time || ''}
                  onChange={e => setForm({ ...form, start_time: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">End time</p>
                <input type="time" value={form.end_time || ''}
                  onChange={e => setForm({ ...form, end_time: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
            </div>
          )}

          {/* Times — per day (perday mode) */}
          {scheduleMode === 'perday' && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Times for each day</p>
              {meetingDays.length === 0 ? (
                <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-border p-3">
                  Select the days above, then set each day&rsquo;s time here.
                </p>
              ) : (
                <div className="space-y-2">
                  {sortByDay(form.meetings || []).map(m => (
                    <div key={m.day} className="flex items-center gap-2">
                      <span className="w-10 text-xs font-medium text-foreground flex-shrink-0">{m.day}</span>
                      <input type="time" value={m.start_time || ''}
                        onChange={e => updateMeetingTime(m.day, 'start_time', e.target.value)}
                        className="flex-1 px-2.5 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                      <span className="text-xs text-muted-foreground">to</span>
                      <input type="time" value={m.end_time || ''}
                        onChange={e => updateMeetingTime(m.day, 'end_time', e.target.value)}
                        className="flex-1 px-2.5 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {scheduleMode === 'rules' && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Schedule rules</p>
              {(form.meetings || []).map((meeting, index) => {
                const specific = Boolean(meeting.specific_date);
                return (
                  <div key={index} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" placeholder="Component" value={meeting.component || ''}
                        onChange={e => updateRule(index, 'component', e.target.value)}
                        className="px-2.5 py-2 rounded-lg border border-input bg-background text-xs" />
                      <select value={meeting.day || 'Mon'} onChange={e => updateRule(index, 'day', e.target.value)}
                        className="px-2.5 py-2 rounded-lg border border-input bg-background text-xs">
                        {ALL_DAYS.map(day => <option key={day} value={day}>{day}</option>)}
                      </select>
                      <input type="time" value={meeting.start_time || ''} onChange={e => updateRule(index, 'start_time', e.target.value)}
                        className="px-2.5 py-2 rounded-lg border border-input bg-background text-xs" />
                      <input type="time" value={meeting.end_time || ''} onChange={e => updateRule(index, 'end_time', e.target.value)}
                        className="px-2.5 py-2 rounded-lg border border-input bg-background text-xs" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {specific ? (
                        <input type="date" value={meeting.specific_date || ''} onChange={e => updateRule(index, 'specific_date', e.target.value)}
                          className="col-span-2 px-2.5 py-2 rounded-lg border border-input bg-background text-xs" />
                      ) : (
                        <>
                          <input type="date" value={meeting.start_date || ''} onChange={e => updateRule(index, 'start_date', e.target.value)}
                            className="px-2.5 py-2 rounded-lg border border-input bg-background text-xs" />
                          <input type="date" value={meeting.end_date || ''} onChange={e => updateRule(index, 'end_date', e.target.value)}
                            className="px-2.5 py-2 rounded-lg border border-input bg-background text-xs" />
                        </>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <button type="button" onClick={() => updateRule(index, 'specific_date', specific ? '' : (meeting.start_date || form.class_start_date || ''))}
                        className="text-[10px] text-primary hover:underline">{specific ? 'Use recurring range' : 'Use specific date'}</button>
                      <button type="button" onClick={() => removeRule(index)} className="text-[10px] text-destructive hover:underline">Remove</button>
                    </div>
                  </div>
                );
              })}
              <button type="button" onClick={addRule} className="text-xs text-primary font-medium hover:underline">+ Add schedule rule</button>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Start date</p>
              <input type="date" value={form.class_start_date || ''}
                onChange={e => setForm({ ...form, class_start_date: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">End date</p>
              <input type="date" value={form.class_end_date || ''}
                onChange={e => setForm({ ...form, class_end_date: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
          </div>

          {/* Color */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Color</p>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                  className={`w-7 h-7 rounded-lg transition-all ${form.color === c ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground' : ''}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {/* Actions. Editing autosaves, so there's nothing to confirm — just
              a status line and a way out. Creating still needs a submit. */}
          {isEdit && <AutosaveIndicator status={autosaveStatus} className="block pt-3" />}
          <div className="flex gap-2 pt-3">
            {isEdit && (
              <button type="button" onClick={() => setConfirmingDelete(true)}
                className="inline-flex items-center justify-center px-3 py-2.5 rounded-lg border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            {isEdit ? (
              <button type="button" onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
                Done
              </button>
            ) : (
              <>
                <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted">Cancel</button>
                <button type="submit" disabled={saving || !form.name} className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Add Class'}
                </button>
              </>
            )}
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
