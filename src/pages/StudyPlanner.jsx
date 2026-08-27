import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { GraduationCap, Calendar, Clock, Check, X, Headphones, Plus, CalendarClock, Pencil } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AddExamOrStudyModal from '@/components/AddExamOrStudyModal';
import RebookSessionModal from '@/components/RebookSessionModal';
import AssignmentEditModal from '@/components/AssignmentEditModal';
import PracticePanel from '@/components/PracticePanel';
import ReviewFromLectures from '@/components/ReviewFromLectures';
import DeleteXButton from '@/components/DeleteXButton';
import { sessionTitle, sessionDescription } from '@/lib/sessionTitle';

const priorityColors = {
  high: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
  medium: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  low: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
};

const statusIcons = { scheduled: Clock, completed: Check, skipped: X };

export default function StudyPlanner() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Deep-link support: /planner?tab=practice&classId=X&ids=a,b,c
  const initialTab = searchParams.get('tab') === 'practice' ? 'practice' : 'plan';
  const deepClassId = searchParams.get('classId') || '';
  const deepLectureIds = (searchParams.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean);

  const [tab, setTab] = useState(initialTab);
  const [sessions, setSessions] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [rebookSession, setRebookSession] = useState(null);
  // The assignment currently open in the edit modal (shared architecture with
  // the Classes → Assignments tab — same component, same edit flow).
  const [editAssignment, setEditAssignment] = useState(null);
  // Tracks which assignment+action is resolving, e.g. "abc123:completed".
  const [resolvingKey, setResolvingKey] = useState(null);

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

  // Resolve a past-due assignment and clear its still-scheduled study sessions
  // (handled server-side). Then reload so the deadline and its sessions update.
  const resolveAssignment = async (assignmentId, action) => {
    setResolvingKey(assignmentId + ':' + action);
    try {
      await base44.functions.invoke('resolveAssignment', { assignment_id: assignmentId, action });
      await loadData();
    } catch (e) {
      alert('Could not update the assignment. Please try again.');
    }
    setResolvingKey(null);
  };

  // Dismiss a single overdue session — marks it 'skipped' so it leaves the
  // upcoming list (and stops counting as "missed") while staying in history.
  const skipSession = async (session) => {
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, status: 'skipped' } : s));
    try {
      await base44.entities.StudySession.update(session.id, { status: 'skipped' });
    } catch (e) { console.error(e); }
  };

  // Permanently remove a single study session. Distinct from "Dismiss", which
  // keeps the row as history — this one is gone for good. Optimistic removal;
  // on failure we restore the row and let DeleteXButton show the error.
  const deleteSession = async (session) => {
    setSessions(prev => prev.filter(s => s.id !== session.id));
    try {
      await base44.entities.StudySession.delete(session.id);
    } catch (e) {
      setSessions(prev => [...prev, session].sort((a, b) => (a.scheduled_date || '').localeCompare(b.scheduled_date || '')));
      throw e;
    }
  };

  // Permanently remove an exam/assignment AND every session scheduled for it.
  // resolveAssignment's 'deleted' action clears the sessions server-side first,
  // so nothing orphaned is left behind in the planner or weekly view.
  const deleteAssignment = async (assignment) => {
    const linked = sessions.filter(s => s.assignment_id === assignment.id);
    setAssignments(prev => prev.filter(a => a.id !== assignment.id));
    setSessions(prev => prev.filter(s => s.assignment_id !== assignment.id));
    try {
      await base44.functions.invoke('resolveAssignment', { assignment_id: assignment.id, action: 'deleted' });
    } catch (e) {
      setAssignments(prev => [...prev, assignment]);
      setSessions(prev => [...prev, ...linked]);
      throw e;
    }
  };

  // How many sessions a deadline would take with it — shown in its confirm.
  const sessionCountFor = (assignmentId) => sessions.filter(s => s.assignment_id === assignmentId).length;

  const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
  const assignmentMap = Object.fromEntries(assignments.map(a => [a.id, a]));

  const upcoming = sessions.filter(s => s.status === 'scheduled');
  const completed = sessions.filter(s => s.status === 'completed');

  const todayStr = new Date().toISOString().split('T')[0];
  const statusOf = (a) => a.status || 'active';
  // "Upcoming Deadlines" shows only assignments that are still active — resolved
  // (completed/archived) ones drop off. Sort soonest-first.
  const deadlineAssignments = assignments
    .filter(a => statusOf(a) === 'active')
    .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-10 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold">Study</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Everything for studying — plan, review, and practice</p>
        </div>
        {tab === 'plan' && (
          <button onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex-shrink-0">
            <Plus className="w-4 h-4" /> Add
          </button>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-border mb-6">
        <button onClick={() => setTab('plan')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'plan' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
          Plan
        </button>
        <button onClick={() => setTab('practice')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'practice' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
          Practice
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin"></div></div>
      ) : tab === 'practice' ? (
        <PracticePanel initialClassId={deepClassId} initialLectureIds={deepLectureIds.length ? deepLectureIds : null} />
      ) : (
        <div>
          {/* Review from lectures */}
          <div className="mb-8">
            <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Review from Lectures</h2>
            <ReviewFromLectures initialClassId={deepClassId} initialLectureIds={deepLectureIds.length ? deepLectureIds : null} />
          </div>

          {/* Upcoming deadlines */}
          {deadlineAssignments.length > 0 && (
            <div className="mb-8">
              <h2 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Upcoming Deadlines</h2>
              <div className="space-y-2">
                {deadlineAssignments.map(a => {
                  const cls = classMap[a.class_id];
                  const daysUntil = a.due_date ? Math.ceil((new Date(a.due_date + 'T00:00:00').getTime() - new Date(todayStr + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)) : 0;
                  const pastDue = !!a.due_date && a.due_date < todayStr;
                  const busy = resolvingKey !== null;
                  return (
                    <div key={a.id} className={`relative rounded-xl border bg-card p-3 pr-10 ${pastDue ? 'border-amber-500/40' : 'border-border'}`}>
                      {/* Delete this deadline and every session tied to it. */}
                      <DeleteXButton
                        ariaLabel={`Delete ${a.title}`}
                        confirmText={`Permanently delete “${a.title}”${sessionCountFor(a.id) > 0 ? ` and its ${sessionCountFor(a.id)} study session${sessionCountFor(a.id) !== 1 ? 's' : ''}` : ''}. This can’t be undone.`}
                        onDelete={() => deleteAssignment(a)}
                      />
                      {/* Clicking the row lands you on this item inside the class's
                          Assignments tab (same deep-link pattern used elsewhere). */}
                      <div
                        className="flex items-center gap-3 cursor-pointer"
                        onClick={() => navigate(`/classes/${a.class_id}?tab=assignments&assignmentId=${a.id}`)}
                      >
                        <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: cls?.color || '#3B82F6' }}></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-medium text-foreground truncate">{a.title}</h3>
                            {a.type === 'project' && (
                              <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-purple-500/10 text-purple-600 uppercase flex-shrink-0">Project</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{cls?.name} • Due {a.due_date}</p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-md flex-shrink-0 ${pastDue ? 'bg-amber-500/10 text-amber-600' : daysUntil <= 3 ? 'bg-rose-500/10 text-rose-600' : 'bg-muted text-muted-foreground'}`}>
                          {pastDue ? 'Past due' : daysUntil <= 0 ? 'Today' : `${daysUntil}d`}
                        </span>
                        {/* Edit — opens the same AssignmentEditModal used in Classes,
                            without navigating away. */}
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditAssignment(a); }}
                          aria-label="Edit"
                          className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Past-due prompt — resolve and clear the sessions made for it */}
                      {pastDue && (
                        <div className="mt-3 pt-3 border-t border-amber-500/20">
                          <p className="text-[11px] text-muted-foreground mb-2">
                            This deadline has passed. Resolving it also clears the study sessions still scheduled for it.
                          </p>
                          <div className="flex gap-2">
                            <button onClick={() => resolveAssignment(a.id, 'completed')} disabled={busy}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-500 text-xs font-medium hover:bg-emerald-500/20 disabled:opacity-50">
                              {resolvingKey === a.id + ':completed' ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Check className="w-3.5 h-3.5" />} Mark done
                            </button>
                            <button onClick={() => resolveAssignment(a.id, 'archived')} disabled={busy}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground text-xs font-medium hover:bg-muted disabled:opacity-50">
                              {resolvingKey === a.id + ':archived' ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <X className="w-3.5 h-3.5" />} Dismiss
                            </button>
                          </div>
                        </div>
                      )}
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
              <p className="text-sm text-muted-foreground mb-3">No study sessions yet. Add an exam or assignment to generate an AI study plan, or add a study block.</p>
              <button onClick={() => setShowAdd(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
                Add exam or study block
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {[...upcoming, ...completed].map(s => {
                const cls = classMap[s.class_id];
                const assignment = assignmentMap[s.assignment_id];
                const overdue = s.status === 'scheduled' && s.scheduled_date && s.scheduled_date < todayStr;
                return (
                  <div key={s.id} className={`relative rounded-xl border bg-card p-4 pr-10 transition-all ${s.status === 'completed' ? 'opacity-60' : ''} ${overdue ? 'border-amber-500/40' : 'border-border'}`}>
                    {/* Delete this one session outright. "Dismiss" below only
                        marks it skipped — this removes it for good. */}
                    <DeleteXButton
                      ariaLabel={`Delete ${sessionTitle(s, assignment)}`}
                      confirmText={`Permanently delete “${sessionTitle(s, assignment)}”. This removes it from your planner and calendar.`}
                      onDelete={() => deleteSession(s)}
                    />
                    <div className="flex items-start gap-3">
                      <button onClick={() => toggleStatus(s)}
                        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${s.status === 'completed' ? 'bg-primary border-primary' : 'border-border hover:border-primary'}`}>
                        {s.status === 'completed' && <Check className="w-4 h-4 text-primary-foreground" strokeWidth={3} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Name comes from the session's own `title`, with a
                              computed fallback for rows created before that
                              field existed (see src/lib/sessionTitle.js). */}
                          <h3 className="text-base font-semibold text-foreground">
                            {sessionTitle(s, assignment)}
                          </h3>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border uppercase ${priorityColors[s.priority] || priorityColors.medium}`}>
                            {s.priority}
                          </span>
                          {s.session_type === 'project' ? (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 border border-purple-500/20">Project</span>
                          ) : sessionDescription(s) && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">Review</span>
                          )}
                          {overdue && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">Past due</span>
                          )}
                        </div>
                        {/* The description sits under the title — never as the title. */}
                        {sessionDescription(s) && <p className="text-sm text-muted-foreground mt-1.5">{sessionDescription(s)}</p>}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground mt-2">
                          <span className="inline-flex items-center gap-1.5 min-w-0"><GraduationCap className="w-3.5 h-3.5 flex-shrink-0" /> <span className="truncate">{cls?.name || '—'}</span></span>
                          <span className="inline-flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 flex-shrink-0" /> {s.scheduled_date}</span>
                          {s.scheduled_time && <span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 flex-shrink-0" /> {s.scheduled_time}</span>}
                          {s.duration_minutes && <span className="inline-flex items-center gap-1.5"><Headphones className="w-3.5 h-3.5 flex-shrink-0" /> {s.duration_minutes} min</span>}
                        </div>
                      </div>
                    </div>

                    {s.status === 'scheduled' && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/60">
                        <button onClick={() => setRebookSession(s)}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                          <CalendarClock className="w-3.5 h-3.5" /> Rebook
                        </button>
                        <Link to={`/focus/${s.id}`}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-primary/5 hover:border-primary/30 transition-colors">
                          <Headphones className="w-3.5 h-3.5" /> Focus
                        </Link>
                        {/* Edit — same modal as the deadline cards / Classes tab.
                            Only shown when this session belongs to an assignment
                            (some ad-hoc study blocks don't). */}
                        {assignment && (
                          <button onClick={() => setEditAssignment(assignment)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {overdue && (
                          <button onClick={() => skipSession(s)}
                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                            <X className="w-3.5 h-3.5" /> Dismiss
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showAdd && <AddExamOrStudyModal classes={classes} onClose={() => { setShowAdd(false); loadData(); }} />}
      {rebookSession && (
        <RebookSessionModal
          session={rebookSession}
          className={classMap[rebookSession.class_id]?.name}
          onClose={() => setRebookSession(null)}
          onRebooked={loadData}
        />
      )}
      {editAssignment && (
        <AssignmentEditModal
          assignment={editAssignment}
          onClose={() => setEditAssignment(null)}
          onUpdate={loadData}
        />
      )}
    </div>
  );
}
