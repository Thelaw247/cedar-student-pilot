import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { CalendarDays, CalendarRange, BookOpen } from 'lucide-react';

/**
 * ReviewFromLectures — entry points for reviewing lecture content: today's
 * lectures, the past week, or a specific lecture (in the professor's teaching
 * order). Extracted so it can live in the Study tab's Plan section.
 */
export default function ReviewFromLectures() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [lectures, setLectures] = useState([]);
  const [showPicker, setShowPicker] = useState(false);

  const load = useCallback(async () => {
    try {
      const semesters = await base44.entities.Semester.filter({ is_active: true });
      if (semesters.length > 0) {
        const cls = await base44.entities.Class.filter({ semester_id: semesters[0].id });
        setClasses(cls);
        if (cls.length > 0) {
          setSelectedClass(cls[0].id);
          const lecs = await base44.entities.Lecture.filter({ class_id: cls[0].id }, 'date');
          setLectures(lecs);
        }
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onPickClass = async (id) => {
    setSelectedClass(id);
    if (id) {
      const lecs = await base44.entities.Lecture.filter({ class_id: id }, 'date');
      setLectures(lecs);
    } else {
      setLectures([]);
    }
  };

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">Review questions follow the exact teaching flow — from what the professor covered first to last.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link to="/lecture-review/today"
          className="rounded-xl border border-border bg-card p-4 hover:shadow-2 hover:-translate-y-0.5 transition-all duration-micro group">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
            <CalendarDays className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-sm font-medium text-foreground">Review Today's Lectures</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Go through every lecture from today in teaching order</p>
        </Link>
        <Link to="/lecture-review/week"
          className="rounded-xl border border-border bg-card p-4 hover:shadow-2 hover:-translate-y-0.5 transition-all duration-micro group">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3">
            <CalendarRange className="w-5 h-5 text-purple-600" />
          </div>
          <h3 className="text-sm font-medium text-foreground">Review This Week</h3>
          <p className="text-xs text-muted-foreground mt-0.5">All lectures from the past 7 days in chronological flow</p>
        </Link>
        <button
          onClick={() => {
            if (!selectedClass) { alert('Select a class first.'); return; }
            if (lectures.length === 0) { alert('No lectures available for this class.'); return; }
            setShowPicker(!showPicker);
          }}
          className="text-left rounded-xl border border-border bg-card p-4 hover:shadow-2 hover:-translate-y-0.5 transition-all duration-micro group w-full">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3">
            <BookOpen className="w-5 h-5 text-emerald-600" />
          </div>
          <h3 className="text-sm font-medium text-foreground">Review by Lecture</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Pick a specific lecture to review</p>
        </button>
      </div>

      {/* Class selector for "by lecture" */}
      {classes.length > 1 && (
        <div className="mt-3">
          <select value={selectedClass} onChange={e => onPickClass(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {showPicker && lectures.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 mt-3 animate-fade-in">
          <h3 className="text-sm font-medium text-foreground mb-3">Select a lecture to review:</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {lectures.map(l => (
              <button key={l.id}
                onClick={() => navigate(`/lecture-review/lecture/${l.id}`)}
                className="w-full text-left px-3 py-2.5 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/50 transition-colors">
                <p className="text-sm font-medium text-foreground truncate">{l.ai_title || `Lecture — ${l.date}`}</p>
                <p className="text-xs text-muted-foreground">{l.date}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
