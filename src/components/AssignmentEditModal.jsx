import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Loader2, Save, CalendarClock, Check, AlertCircle } from 'lucide-react';

/**
 * AssignmentEditModal — edit an assignment's title/due date, and edit the
 * StudySession rows scheduled for it (project roadmap work sessions, or the
 * regular auto-generated study sessions for an exam/assignment). Sessions are
 * the actual schedulable unit in this app (Assignment.roadmap is just the
 * static step template a project was created from), so editing sessions here
 * is what changes what actually shows up in the planner and weekly view.
 */
export default function AssignmentEditModal({ assignment, onClose, onUpdate }) {
  const [title, setTitle] = useState(assignment.title || '');
  const [dueDate, setDueDate] = useState(assignment.due_date || '');
  const [savingHeader, setSavingHeader] = useState(false);
  const [headerSaved, setHeaderSaved] = useState(false);

  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  // Per-session local edit buffers, keyed by session id.
  const [edits, setEdits] = useState({});
  const [savingSessionId, setSavingSessionId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sess = await base44.entities.StudySession.filter({ assignment_id: assignment.id }, 'scheduled_date');
        if (!cancelled) {
          setSessions(sess);
          const initial = {};
          for (const s of sess) {
            initial[s.id] = { scheduled_date: s.scheduled_date || '', scheduled_time: s.scheduled_time || '', notes: s.notes || '' };
          }
          setEdits(initial);
        }
      } catch (e) { console.error(e); }
      if (!cancelled) setLoadingSessions(false);
    })();
    return () => { cancelled = true; };
  }, [assignment.id]);

  const saveHeader = async () => {
    if (!title.trim() || !dueDate) return;
    setSavingHeader(true);
    try {
      await base44.entities.Assignment.update(assignment.id, { title: title.trim(), due_date: dueDate });
      setHeaderSaved(true);
      onUpdate?.();
      setTimeout(() => setHeaderSaved(false), 2000);
    } catch (e) {
      alert('Could not save. Please try again.');
    }
    setSavingHeader(false);
  };

  const updateEdit = (sessionId, field, value) => {
    setEdits(prev => ({ ...prev, [sessionId]: { ...prev[sessionId], [field]: value } }));
  };

  const saveSession = async (sessionId) => {
    const e = edits[sessionId];
    if (!e || !e.scheduled_date) return;
    setSavingSessionId(sessionId);
    try {
      await base44.entities.StudySession.update(sessionId, {
        scheduled_date: e.scheduled_date,
        scheduled_time: e.scheduled_time || '',
        notes: e.notes || '',
      });
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, ...e } : s));
      onUpdate?.();
    } catch (err) {
      alert('Could not save that session. Please try again.');
    }
    setSavingSessionId(null);
  };

  const isProject = assignment.type === 'project';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 glass" onClick={onClose}>
      <div className="bg-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-border p-6 animate-fade-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-lg font-semibold">Edit {isProject ? 'Project' : 'Assignment'}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        {/* Title + due date */}
        <div className="space-y-3 mb-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Title</p>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Due date</p>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <button onClick={saveHeader} disabled={savingHeader || !title.trim() || !dueDate}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
            {savingHeader ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : headerSaved ? <><Check className="w-4 h-4" /> Saved</> : <><Save className="w-4 h-4" /> Save changes</>}
          </button>
        </div>

        {/* Work sessions */}
        <div className="mt-5 pt-4 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {isProject ? 'Roadmap work sessions' : 'Study sessions'}
          </p>

          {loadingSessions ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : sessions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-center">
              <CalendarClock className="w-5 h-5 text-muted-foreground mx-auto mb-1.5" strokeWidth={1.5} />
              <p className="text-xs text-muted-foreground">No sessions scheduled for this {isProject ? 'project' : 'assignment'} yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((s, i) => {
                const e = edits[s.id] || { scheduled_date: '', scheduled_time: '', notes: '' };
                const dirty = e.scheduled_date !== (s.scheduled_date || '') || e.scheduled_time !== (s.scheduled_time || '') || e.notes !== (s.notes || '');
                return (
                  <div key={s.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-semibold text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                        {isProject ? `Step ${i + 1}` : `Session ${i + 1}`}
                      </span>
                      {s.status === 'completed' && (
                        <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1"><Check className="w-2.5 h-2.5" /> Completed</span>
                      )}
                      {s.status === 'skipped' && (
                        <span className="text-[10px] font-semibold text-muted-foreground">Skipped</span>
                      )}
                    </div>
                    <input type="text" value={e.notes} onChange={ev => updateEdit(s.id, 'notes', ev.target.value)}
                      placeholder="Session title"
                      className="w-full px-2.5 py-2 rounded-lg border border-input bg-background text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-primary/40" />
                    <div className="flex gap-2">
                      <input type="date" value={e.scheduled_date} onChange={ev => updateEdit(s.id, 'scheduled_date', ev.target.value)}
                        className="flex-1 px-2.5 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                      <input type="time" value={e.scheduled_time} onChange={ev => updateEdit(s.id, 'scheduled_time', ev.target.value)}
                        className="flex-1 px-2.5 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                      <button onClick={() => saveSession(s.id)} disabled={!dirty || !e.scheduled_date || savingSessionId === s.id}
                        className="px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center flex-shrink-0">
                        {savingSessionId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
