import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Trash2, X } from 'lucide-react';

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#EC4899', '#14B8A6'];

export default function EditClassModal({ classData, semesterId, onDeleteClass, onClose }) {
  const isEdit = !!classData;
  const [form, setForm] = useState({
    name: '',
    instructor: '',
    room: '',
    days_of_week: [],
    start_time: '',
    end_time: '',
    class_start_date: '',
    class_end_date: '',
    color: '#3B82F6',
    ...classData,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (classData) {
      setForm({
        name: '',
        instructor: '',
        room: '',
        days_of_week: [],
        start_time: '',
        end_time: '',
        class_start_date: '',
        class_end_date: '',
        color: '#3B82F6',
        ...classData,
      });
    }
  }, [classData]);

  const toggleDay = (day) => {
    setForm(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter(d => d !== day)
        : [...prev.days_of_week, day],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    setSaving(true);
    try {
      const payload = { ...form, semester_id: semesterId };
      if (isEdit) {
        await base44.entities.Class.update(classData.id, payload);
      } else {
        await base44.entities.Class.create(payload);
      }
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 glass" onClick={onClose}>
      <div className="bg-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-border p-6 animate-fade-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-lg font-semibold">{isEdit ? 'Edit Class' : 'Add Class'}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="text" placeholder="Class name" value={form.name || ''}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" autoFocus />

          <input type="text" placeholder="Professor / Instructor" value={form.instructor || ''}
            onChange={e => setForm({ ...form, instructor: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />

          <input type="text" placeholder="Room / Location" value={form.room || ''}
            onChange={e => setForm({ ...form, room: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />

          {/* Days of week */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Days</p>
            <div className="flex gap-1.5 flex-wrap">
              {ALL_DAYS.map(d => (
                <button key={d} type="button" onClick={() => toggleDay(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    (form.days_of_week || []).includes(d)
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border text-muted-foreground hover:text-foreground'
                  }`}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Times */}
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

          {/* Actions */}
          <div className="flex gap-2 pt-3">
            {isEdit && (
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="inline-flex items-center justify-center px-3 py-2.5 rounded-lg border border-destructive/30 text-destructive text-sm font-medium hover:bg-destructive/10 disabled:opacity-50">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            )}
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted">Cancel</button>
            <button type="submit" disabled={saving || !form.name} className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : isEdit ? 'Save Changes' : 'Add Class'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}