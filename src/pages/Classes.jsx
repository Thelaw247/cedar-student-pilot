import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, Search, GraduationCap, ChevronRight, Pencil } from 'lucide-react';
import LectureSearch from '@/components/LectureSearch';
import WeeklyCalendar from '@/components/WeeklyCalendar';
import EditClassModal from '@/components/EditClassModal';
import { useUndo, UndoToast } from '@/hooks/useUndo';
import { getClassMeetings } from '@/lib/classSchedule';

function scheduleSummary(c) {
  const meetings = getClassMeetings(c);
  if (meetings.length === 0) return 'No schedule set';
  if (meetings.some(m => m.specific_date || m.start_date || m.end_date)) {
    return `${meetings.length} schedule rule${meetings.length !== 1 ? 's' : ''}`;
  }
  // If every meeting shares the same time, show "Mon, Wed · 9:00–10:00".
  const times = new Set(meetings.map(m => `${m.start_time}-${m.end_time}`));
  const days = [...new Set(meetings.map(m => m.day))].join(', ');
  if (times.size === 1) {
    const { start_time, end_time } = meetings[0];
    return `${days} · ${start_time || '?'}–${end_time || '?'}`;
  }
  // Otherwise the times differ per day — summarize as "varies by day".
  return `${days} · varies by day`;
}

export default function Classes() {
  const [classes, setClasses] = useState([]);
  const [lectures, setLectures] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editClass, setEditClass] = useState(null);
  const [activeSemester, setActiveSemester] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast, showUndo, handleUndo, dismiss } = useUndo();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const semesters = await base44.entities.Semester.filter({ is_active: true });
      if (semesters.length > 0) {
        setActiveSemester(semesters[0]);
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

  // Deep link: arriving with ?add=1 (from the Weekly "Add event → class" route
  // or the global Add Class button) opens the add form directly.
  useEffect(() => {
    if (searchParams.get('add') === '1') {
      setShowAdd(true);
      searchParams.delete('add');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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

  const filtered = classes.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.course_code?.toLowerCase().includes(search.toLowerCase()) ||
    c.instructor?.toLowerCase().includes(search.toLowerCase())
  );
  const searching = search.trim().length > 0;

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
          <Plus className="w-4 h-4" /> Add Class
        </button>
      </div>

      {/* Weekly schedule grid (moved here from the Today area) */}
      {classes.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Weekly schedule</h2>
          <WeeklyCalendar classes={classes} onEditClass={(c) => setEditClass(c)} />
        </div>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="Search classes, instructors, and lectures…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
      </div>

      {searching && (
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2">Classes</p>
      )}

      {filtered.length === 0 ? (
        searching ? (
          <p className="text-sm text-muted-foreground py-2 px-1">No classes match.</p>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <GraduationCap className="w-8 h-8 text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">No classes yet. Add your first class or upload a timetable.</p>
            <Link to="/setup" className="text-sm text-primary font-medium mt-2 inline-block hover:underline">Set up semester</Link>
          </div>
        )
      ) : (
        <div className="grid gap-3">
          {filtered.map(c => (
            <div key={c.id} className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:shadow-md transition-all">
              <Link to={`/classes/${c.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: (c.color || '#3B82F6') + '20', color: c.color || '#3B82F6' }}>
                  <GraduationCap className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground text-sm">{c.course_code ? `${c.course_code} · ` : ''}{c.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {scheduleSummary(c)}
                    {c.instructor && ` • ${c.instructor}`}
                  </p>
                </div>
              </Link>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-muted-foreground">{lectures[c.id] || 0} lectures</p>
                </div>
                <button onClick={() => setEditClass(c)} aria-label="Edit class"
                  className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <Link to={`/classes/${c.id}`} className="text-muted-foreground group-hover:text-foreground transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lecture content matches for the same query (searches transcripts,
          summaries, and concepts) — one search box covers everything. */}
      <LectureSearch query={search} />

      {/* Add / edit use the shared modal (with same-time vs per-day scheduling) */}
      {showAdd && activeSemester && (
        <EditClassModal semesterId={activeSemester.id} onClose={() => { setShowAdd(false); loadData(); }} />
      )}
      {editClass && activeSemester && (
        <EditClassModal classData={editClass} semesterId={activeSemester.id} onDeleteClass={handleDeleteClass} onClose={() => { setEditClass(null); loadData(); }} />
      )}

      <UndoToast toast={toast} onUndo={handleUndo} onDismiss={dismiss} />
    </div>
  );
}
