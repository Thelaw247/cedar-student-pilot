import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Clock, GraduationCap, BookOpen, FileText, Mic, Calendar, ListChecks } from 'lucide-react';
import { fetchWithCache } from '@/hooks/useEntityData';
import { useTodaySchedule } from '@/hooks/useTodaySchedule';
import { searchPalette, classNameFor } from '@/lib/paletteSearch';

/**
 * Universal Command Palette — ⌘K / Ctrl+K
 * Navigate anywhere, search, create events, start recording.
 *
 * The "Ask AI" entries were removed along with the AI Assistant page — they
 * pointed at /assistant, which no longer has a route.
 *
 * This component loads its own data. It used to take classes/lectures/
 * assignments as props, but Layout — the only thing that renders it — has no
 * data of its own and passed none, so every prop sat at its [] default and the
 * palette could never match anything a student typed. Searching a real class
 * name returned "No results found". Props still win when given (tests, and any
 * future surface that already holds the data); otherwise the palette fetches
 * on first open, so a student who never presses ⌘K pays nothing for it.
 */
export default function CommandPalette({ classes: classesProp = null, lectures: lecturesProp = null, assignments: assignmentsProp = null, onStartRecording = null }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [loaded, setLoaded] = useState({ lectures: [], assignments: [] });
  const navigate = useNavigate();

  // Every class in the active semester, already fetched and cached for the
  // record picker — reused here rather than fetched a second time.
  const { classes: semesterClasses } = useTodaySchedule();

  const classes = classesProp ?? semesterClasses;
  const lectures = lecturesProp ?? loaded.lectures;
  const assignments = assignmentsProp ?? loaded.assignments;

  // Lectures and assignments are only needed once the palette is actually
  // opened, and only if the caller did not supply them.
  useEffect(() => {
    if (!open) return undefined;
    if (lecturesProp && assignmentsProp) return undefined;
    let cancelled = false;
    (async () => {
      const [lec, asg] = await Promise.all([
        lecturesProp ? Promise.resolve(lecturesProp) : fetchWithCache('Lecture', 'list', ['-date', 200]),
        assignmentsProp ? Promise.resolve(assignmentsProp) : fetchWithCache('Assignment', 'list', ['-due_date', 200]),
      ]);
      if (!cancelled) setLoaded({ lectures: lec || [], assignments: asg || [] });
    })();
    return () => { cancelled = true; };
  }, [open, lecturesProp, assignmentsProp]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!open) { setQuery(''); setActiveIndex(0); }
  }, [open]);

  const results = useMemo(() => {
    if (!query.trim()) return { actions: [], items: [] };
    const q = query.toLowerCase();

    const actions = [];
    if (q.includes('record') || q.includes('lecture')) actions.push({ label: 'Start Recording', icon: Mic, type: 'action', run: () => { onStartRecording?.(); setOpen(false); } });
    if (q.includes('event') || q.includes('add')) actions.push({ label: 'Add Event', icon: Calendar, type: 'action', run: () => { navigate('/today'); setOpen(false); } });

    const found = searchPalette(query, { classes, lectures, assignments });

    const matchedClasses = found.classes
      .map(c => ({ label: c.name, sub: c.course_code || c.instructor || 'Class', icon: GraduationCap, type: 'class', run: () => { navigate(`/classes/${c.id}`); setOpen(false); } }));
    const matchedLectures = found.lectures
      .map(l => ({ label: l.ai_title || `Lecture ${l.date}`, sub: [classNameFor(classes, l.class_id), l.date].filter(Boolean).join(' · '), icon: BookOpen, type: 'lecture', run: () => { navigate(`/lectures/${l.id}`); setOpen(false); } }));
    const matchedAssignments = found.assignments
      .map(a => ({ label: a.title, sub: `Due ${a.due_date}`, icon: FileText, type: 'assignment', run: () => { navigate(`/classes/${a.class_id}`); setOpen(false); } }));

    return { actions, items: [...matchedClasses, ...matchedLectures, ...matchedAssignments] };
  }, [query, classes, lectures, assignments, navigate, onStartRecording]);

  const allResults = [...results.actions, ...results.items];

  useEffect(() => {
    const handler = (e) => {
      if (!open) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, allResults.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' && allResults[activeIndex]) { e.preventDefault(); allResults[activeIndex].run(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, allResults, activeIndex]);

  const defaultActions = [
    { label: 'Start Recording', icon: Mic, run: () => { onStartRecording?.(); setOpen(false); } },
    { label: 'Go to Calendar', icon: Calendar, run: () => { navigate('/today'); setOpen(false); } },
    { label: 'Study', icon: BookOpen, run: () => { navigate('/planner'); setOpen(false); } },
    { label: 'To-do', icon: ListChecks, run: () => { navigate('/todos'); setOpen(false); } },
    { label: 'Analytics', icon: Clock, run: () => { navigate('/analytics'); setOpen(false); } },
  ];

  const displayed = query.trim() ? allResults : defaultActions;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] px-4 bg-black/30 glass" onClick={() => setOpen(false)}>
      <div className="w-full max-w-xl bg-card rounded-modal border border-border shadow-3 overflow-hidden animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIndex(0); }}
            placeholder="Search classes, lectures, notes..."
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline-block text-[10px] font-medium text-muted-foreground border border-border rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-2">
          {displayed.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">No results found</p>
              <p className="mt-1 text-xs text-muted-foreground">Searches your classes, recordings and assignments.</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {!query.trim() && <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Quick Actions</p>}
              {displayed.map((item, i) => (
                <button
                  key={i}
                  onClick={item.run}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${activeIndex === i ? 'bg-primary/5' : ''}`}
                >
                  <item.icon className={`w-4 h-4 flex-shrink-0 ${activeIndex === i ? 'text-primary' : 'text-muted-foreground'}`} strokeWidth={1.5} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{item.label}</p>
                    {item.sub && <p className="text-xs text-muted-foreground truncate">{item.sub}</p>}
                  </div>
                  {item.type === 'action' && <span className="w-3 h-3 flex-shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
