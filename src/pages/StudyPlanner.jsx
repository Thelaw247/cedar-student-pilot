import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { GraduationCap, Calendar, Clock, Check, X, Loader2, ChevronRight, Headphones } from 'lucide-react';

const priorityColors = {
  high: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
  medium: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  low: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
};

const statusIcons = {
  scheduled: Clock,
  completed: Check,
  skipped: X,
};

export default function StudyPlanner() {
  const [sessions, setSessions] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const semesters = await base44.entities.Semester.filter({ is_active: true });
      if (semesters.length > 0) {
        const cls = await base44.entities.Class.filter({ semester_id: semesters[0].id });
        setClasses(cls);
        const allAssignments = [];
        const allSessions = [];
        for (const c of cls) {
          const asgns = await base44.entities.Assignment.filter({ class_id: c.id });
          allAssignments.push(...asgns);
          const sess = await base44.entities.StudySession.filter({ class_id: c.id }, 'scheduled_date');
          allSessions.push(...sess);
        }
        setAssignments(allAssignments);
        setSessions(allSessions.sort((a, b) => (a.scheduled_date || '').localeCompare(b.scheduled_date || '')));
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleStatus = async (session) => {
    const newStatus = session.status === 'completed' ? 'scheduled' : 'completed';
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, status: newStatus } : s));
    try {
      await base44.entities.StudySession.update(session.id, { status: newStatus });
    } catch (e) { console.error(e); }
  };

  const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
  const assignmentMap = Object.fromEntries(assignments.map(a => [a.id, a]));

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin"></div></div>;

  const upcoming = sessions.filter(s => s.status === 'scheduled');
  const completed = sessions.filter(s => s.status === 'completed');

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-10 animate-fade-in">
      <div className="mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold">Study Planner</h1>
        <p className="text-muted-foreground text-sm mt-0.5">AI-generated study sessions across all your courses</p>
      </div>

      {/* Upcoming assignments */}
      {assignments.length > 0 && (
        <div className="mb-8">
          <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Upcoming Deadlines</h2>
          <div className="space-y-2">
            {assignments.sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')).map(a => {
              const cls = classMap[a.class_id];
              const daysUntil = a.due_date ? Math.ceil((new Date(a.due_date) - new Date()) / (1000 * 60 * 60 * 24)) : 0;
              return (
                <div key={a.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <div className="w-1 h-10 rounded-full" style={{ backgroundColor: cls?.color || '#3B82F6' }}></div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-foreground truncate">{a.title}</h3>
                    <p className="text-xs text-muted-foreground">{cls?.name} • Due {a.due_date}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-md ${daysUntil <= 3 ? 'bg-rose-500/10 text-rose-600' : 'bg-muted text-muted-foreground'}`}>
                    {daysUntil <= 0 ? 'Today' : `${daysUntil}d`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Study sessions */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wide">Study Sessions</h2>
        <span className="text-xs text-muted-foreground">{completed.length}/{sessions.length} done</span>
      </div>

      {upcoming.length === 0 && completed.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <GraduationCap className="w-8 h-8 text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">No study sessions yet. Add an exam or assignment to a class to generate an AI study plan.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...upcoming, ...completed].map(s => {
            const cls = classMap[s.class_id];
            const assignment = assignmentMap[s.assignment_id];
            const StatusIcon = statusIcons[s.status] || Clock;
            return (
              <div key={s.id} className={`rounded-xl border bg-card p-4 transition-all ${s.status === 'completed' ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3">
                  <button onClick={() => toggleStatus(s)}
                    className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${s.status === 'completed' ? 'bg-primary border-primary' : 'border-border hover:border-primary'}`}>
                    {s.status === 'completed' && <Check className="w-4 h-4 text-primary-foreground" strokeWidth={3} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-medium text-foreground">{assignment?.title || 'Study Session'}</h3>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase ${priorityColors[s.priority] || priorityColors.medium}`}>
                        {s.priority}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <Calendar className="w-3 h-3" /> {s.scheduled_date}
                      {s.scheduled_time && <span>• {s.scheduled_time}</span>}
                      {s.duration_minutes && <span>• {s.duration_minutes} min</span>}
                      {cls && <span>• {cls.name}</span>}
                    </div>
                  </div>
                  {s.status === 'scheduled' && (
                    <a href={`/focus/${s.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-primary/5 hover:border-primary/30 transition-colors flex-shrink-0">
                      <Headphones className="w-3.5 h-3.5" /> Focus
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}