import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Clock, GraduationCap, BookOpen, FileText, Mic, Calendar } from 'lucide-react';

/**
 * Universal Command Palette — ⌘K / Ctrl+K
 * Navigate anywhere, search, create events, start recording.
 *
 * The "Ask AI" entries were removed along with the AI Assistant page — they
 * pointed at /assistant, which no longer has a route.
 */
export default function CommandPalette({ classes, lectures, assignments, onStartRecording }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();

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
    if (q.includes('event') || q.includes('add')) actions.push({ label: 'Add Event', icon: Calendar, type: 'action', run: () => { navigate('/'); setOpen(false); } });

    const matchedClasses = (classes || []).filter(c => c.name?.toLowerCase().includes(q)).slice(0, 3)
      .map(c => ({ label: c.name, sub: c.instructor || 'Class', icon: GraduationCap, type: 'class', run: () => { navigate(`/classes/${c.id}`); setOpen(false); } }));
    const matchedLectures = (lectures || []).filter(l => l.ai_title?.toLowerCase().includes(q) || l.transcript?.toLowerCase().includes(q)).slice(0, 3)
      .map(l => ({ label: l.ai_title || `Lecture ${l.date}`, sub: l.date, icon: BookOpen, type: 'lecture', run: () => { navigate(`/lectures/${l.id}`); setOpen(false); } }));
    const matchedAssignments = (assignments || []).filter(a => a.title?.toLowerCase().includes(q)).slice(0, 3)
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
    { label: 'Go to Calendar', icon: Calendar, run: () => { navigate('/'); setOpen(false); } },
    { label: 'Study', icon: BookOpen, run: () => { navigate('/planner'); setOpen(false); } },
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
            placeholder="Search classes, lectures, notes, or ask AI..."
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline-block text-[10px] font-medium text-muted-foreground border border-border rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-2">
          {displayed.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">No results found</p>
              <button onClick={() => { onAskAI?.(); setOpen(false); }} className="mt-3 text-sm text-primary font-medium hover:underline">
                Ask AI instead →
              </button>
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
                  {item.type === 'action' && <Sparkles className="w-3 h-3 text-violet-400 flex-shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}