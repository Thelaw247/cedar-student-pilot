import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, Search, GraduationCap, ChevronRight } from 'lucide-react';

export default function Classes() {
  const [classes, setClasses] = useState([]);
  const [lectures, setLectures] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const semesters = await base44.entities.Semester.filter({ is_active: true });
      if (semesters.length > 0) {
        const cls = await base44.entities.Class.filter({ semester_id: semesters[0].id });
        setClasses(cls);
        const lecMap = {};
        for (const c of cls) {
          const lecs = await base44.entities.Lecture.filter({ class_id: c.id });
          lecMap[c.id] = lecs.length;
        }
        setLectures(lecMap);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = classes.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.instructor?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-10 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold">Classes</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{classes.length} course{classes.length !== 1 ? 's' : ''} this semester</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="Search classes or instructors..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <GraduationCap className="w-8 h-8 text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">{search ? 'No classes found.' : 'No classes yet. Add your first class or upload a timetable.'}</p>
          {!search && <Link to="/setup" className="text-sm text-primary font-medium mt-2 inline-block hover:underline">Set up semester</Link>}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(c => (
            <Link key={c.id} to={`/classes/${c.id}`}
              className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: (c.color || '#3B82F6') + '20', color: c.color || '#3B82F6' }}>
                <GraduationCap className="w-6 h-6" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground text-sm">{c.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {(c.days_of_week || []).join(', ')} • {c.start_time}–{c.end_time}
                  {c.instructor && ` • ${c.instructor}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{lectures[c.id] || 0} lectures</p>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground ml-auto mt-1 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {showAdd && <AddClassModal onClose={() => { setShowAdd(false); loadData(); }} />}
    </div>
  );
}

function AddClassModal({ onClose }) {
  const [form, setForm] = useState({ name: '', instructor: '', room: '', color: '#3B82F6', start_time: '09:00', end_time: '10:00', days_of_week: ['Mon'] });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    setSaving(true);
    try {
      const semesters = await base44.entities.Semester.filter({ is_active: true });
      if (semesters.length === 0) return;
      await base44.entities.Class.create({ ...form, semester_id: semesters[0].id });
      onClose();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 glass" onClick={onClose}>
      <div className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border p-6 animate-fade-in" onClick={e => e.stopPropagation()}>
        <h3 className="font-heading text-lg font-semibold mb-4">Add Class</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="text" placeholder="Class name" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="Instructor" value={form.instructor}
              onChange={e => setForm({ ...form, instructor: e.target.value })}
              className="px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            <input type="text" placeholder="Room" value={form.room}
              onChange={e => setForm({ ...form, room: e.target.value })}
              className="px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="time" value={form.start_time}
              onChange={e => setForm({ ...form, start_time: e.target.value })}
              className="px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            <input type="time" value={form.end_time}
              onChange={e => setForm({ ...form, end_time: e.target.value })}
              className="px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => {
              const active = form.days_of_week.includes(day);
              return (
                <button key={day} type="button" onClick={() => {
                  setForm({ ...form, days_of_week: active ? form.days_of_week.filter(d => d !== day) : [...form.days_of_week, day] });
                }} className={`px-2.5 py-1 rounded-md text-xs font-medium ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{day}</button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Color:</span>
            <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="w-8 h-8 rounded-lg cursor-pointer border border-border" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted">Cancel</button>
            <button type="submit" disabled={saving || !form.name} className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
              {saving ? 'Adding...' : 'Add Class'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}