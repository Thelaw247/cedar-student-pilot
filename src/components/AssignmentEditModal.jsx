import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Loader2, CalendarClock, Check } from 'lucide-react';
import { useAutosave } from '@/hooks/useAutosave';
import AutosaveIndicator from '@/components/AutosaveIndicator';
import DeleteXButton from '@/components/DeleteXButton';
import { defaultSessionTitle } from '@/lib/sessionTitle';

/**
 * AssignmentEditModal — edit an assignment's title/due date, edit and delete
 * the StudySession rows scheduled for it (project roadmap work sessions, or
 * the auto-generated study sessions for an exam/assignment), and delete the
 * assignment outright. Sessions are the actual schedulable unit in this app
 * (Assignment.roadmap is just the static step template a project was created
 * from), so editing/deleting sessions here is what changes what shows up in
 * the planner and weekly view.
 *
 * This is the single edit surface for assignments/exams/projects, reached from
 * both the Classes → Assignments tab and the Study planner.
 *
 * Everything autosaves. There are no Save buttons: edits are written ~700ms
 * after you stop typing, and any still-pending write is flushed when the modal
 * closes. The parent is only told to reload on close, so a page-level refetch
 * doesn't fire on every keystroke.
 */
export default function AssignmentEditModal({ assignment, onClose, onUpdate }) {
  const [title, setTitle] = useState(assignment.title || '');
  const [dueDate, setDueDate] = useState(assignment.due_date || '');
  const [rubric, setRubric] = useState(assignment.rubric || []);
  const [newRubricItem, setNewRubricItem] = useState('');

  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  // Per-session local edit buffers, keyed by session id.
  const [edits, setEdits] = useState({});
  const [deletingAssignment, setDeletingAssignment] = useState(false);

  // Did anything actually change? Drives whether we bother reloading on close.
  const dirtyRef = useRef(false);

  const assignmentSaver = useAutosave({ entity: 'Assignment' });
  const sessionSaver = useAutosave({ entity: 'StudySession' });

  // One combined status so the header shows a single, calm indicator.
  const status = [assignmentSaver.status, sessionSaver.status].includes('error')
    ? 'error'
    : [assignmentSaver.status, sessionSaver.status].includes('saving')
      ? 'saving'
      : [assignmentSaver.status, sessionSaver.status].includes('saved')
        ? 'saved'
        : 'idle';

  const isProject = assignment.type === 'project';
  const typeLabel = isProject ? 'project' : assignment.type === 'exam' ? 'exam' : assignment.type === 'quiz' ? 'quiz' : 'assignment';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sess = await base44.entities.StudySession.filter({ assignment_id: assignment.id }, 'scheduled_date');
        if (!cancelled) {
          setSessions(sess);
          const initial = {};
          sess.forEach((s, i) => {
            initial[s.id] = {
              // Seed the box with the session's real title, or a sensible
              // computed name when the row predates the `title` field. Older
              // rows left this blank, or showed their description here.
              title: s.title || defaultSessionTitle(s, assignment, i),
              scheduled_date: s.scheduled_date || '',
              scheduled_time: s.scheduled_time || '',
              notes: s.notes || '',
            };
          });
          setEdits(initial);
        }
      } catch (e) { console.error(e); }
      if (!cancelled) setLoadingSessions(false);
    })();
    return () => { cancelled = true; };
    // Intentionally keyed on the id alone: re-running on a new `assignment`
    // object identity would wipe in-progress edits.
  }, [assignment.id]);

  // ---- Assignment header (autosaved) --------------------------------------

  const onTitleChange = (value) => {
    setTitle(value);
    if (!value.trim()) return; // don't persist an empty title
    dirtyRef.current = true;
    assignmentSaver.save(assignment.id, { title: value.trim() });
  };

  const onDueDateChange = (value) => {
    setDueDate(value);
    if (!value) return;
    dirtyRef.current = true;
    assignmentSaver.save(assignment.id, { due_date: value });
  };

  // ---- Rubric / grading criteria (autosaved) -------------------------------
  // Kept on the assignment itself (not a session) so it travels with it and
  // shows the same regardless of which study session the student opens.

  const addRubricItem = () => {
    const text = newRubricItem.trim();
    if (!text) return;
    const updated = [...rubric, { text, done: false }];
    setRubric(updated);
    setNewRubricItem('');
    dirtyRef.current = true;
    assignmentSaver.save(assignment.id, { rubric: updated });
  };

  const removeRubricItem = (index) => {
    const updated = rubric.filter((_, i) => i !== index);
    setRubric(updated);
    dirtyRef.current = true;
    assignmentSaver.save(assignment.id, { rubric: updated });
  };

  // ---- Sessions (autosaved) -----------------------------------------------

  const updateEdit = (sessionId, field, value) => {
    setEdits(prev => ({ ...prev, [sessionId]: { ...prev[sessionId], [field]: value } }));
    // A session must keep a date; ignore the keystroke that empties it.
    if (field === 'scheduled_date' && !value) return;
    dirtyRef.current = true;
    sessionSaver.save(sessionId, { [field]: value });
    // Keep the local list in sync so the planner reflects it on close.
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, [field]: value } : s));
  };

  // ---- Deletes -------------------------------------------------------------

  const deleteSession = async (sessionId) => {
    // Drop any queued autosave for this row first — writing to a deleted
    // record would fail and surface a spurious error.
    sessionSaver.discard(sessionId);
    await base44.entities.StudySession.delete(sessionId);
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    setEdits(prev => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
    dirtyRef.current = true;
  };

  const deleteAssignment = async () => {
    setDeletingAssignment(true);
    try {
      // Same backend function used for archive/complete/reactivate — its
      // 'deleted' action removes every linked session first, then the
      // assignment itself, so nothing orphaned is left in the planner.
      await base44.functions.invoke('resolveAssignment', { assignment_id: assignment.id, action: 'deleted' });
      onUpdate?.();
      onClose();
    } catch (e) {
      setDeletingAssignment(false);
      throw e; // DeleteXButton surfaces the failure inline
    }
  };

  // ---- Close ---------------------------------------------------------------

  const handleClose = useCallback(async () => {
    // Write anything still debounced before the modal goes away.
    await Promise.all([assignmentSaver.flush(), sessionSaver.flush()]);
    if (dirtyRef.current) onUpdate?.();
    onClose();
  }, [assignmentSaver, sessionSaver, onUpdate, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 glass" onClick={handleClose}>
      <div className="bg-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-border p-6 animate-fade-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1 gap-3">
          <h3 className="font-heading text-lg font-semibold">Edit {isProject ? 'Project' : 'Assignment'}</h3>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Delete the whole thing — takes every linked session with it. */}
            <DeleteXButton
              className="relative"
              ariaLabel={`Delete this ${typeLabel}`}
              confirmLabel={deletingAssignment ? 'Deleting…' : 'Delete'}
              confirmText={`Permanently delete this ${typeLabel}${sessions.length > 0 ? ` and its ${sessions.length} scheduled session${sessions.length !== 1 ? 's' : ''}` : ''}. This can’t be undone.`}
              onDelete={deleteAssignment}
            />
            <button onClick={handleClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <AutosaveIndicator status={status} className="mb-4 block" />

        {/* Title + due date */}
        <div className="space-y-3 mb-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Title</p>
            <input type="text" value={title} onChange={e => onTitleChange(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Due date</p>
            <input type="date" value={dueDate} onChange={e => onDueDateChange(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
        </div>

        {/* Rubric / guidelines — travels with the assignment, shown as a
            checklist inside any study session booked for it (Focus Mode). */}
        <div className="mt-5 pt-4 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Rubric / guidelines
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            Add the grading criteria or requirements for this {typeLabel}. They'll show as a checklist whenever you study for it.
          </p>
          {rubric.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {rubric.map((item, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                  <span className="flex-1 text-sm text-foreground">{item.text}</span>
                  <button onClick={() => removeRubricItem(i)} aria-label="Remove" className="text-muted-foreground hover:text-destructive flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input type="text" value={newRubricItem} onChange={e => setNewRubricItem(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRubricItem(); } }}
              placeholder="e.g. Cite at least 3 sources"
              className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            <button onClick={addRubricItem} disabled={!newRubricItem.trim()}
              className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              Add
            </button>
          </div>
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
                const e = edits[s.id] || { title: '', scheduled_date: '', scheduled_time: '', notes: '' };
                return (
                  <div key={s.id} className="relative rounded-lg border border-border p-3 pr-10">
                    {/* Delete just this session. */}
                    <DeleteXButton
                      ariaLabel={`Delete ${isProject ? 'step' : 'session'} ${i + 1}`}
                      confirmText={`Delete “${e.title || `${isProject ? 'Step' : 'Session'} ${i + 1}`}”? This removes it from your planner and calendar.`}
                      onDelete={() => deleteSession(s.id)}
                    />

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

                    {/* Title — the session's own name, NOT its description. */}
                    <input type="text" value={e.title} onChange={ev => updateEdit(s.id, 'title', ev.target.value)}
                      placeholder="Session title"
                      className="w-full px-2.5 py-2 rounded-lg border border-input bg-background text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-primary/40" />

                    {/* Notes — the longer "what to do in this session" text. */}
                    <input type="text" value={e.notes} onChange={ev => updateEdit(s.id, 'notes', ev.target.value)}
                      placeholder="Notes (optional)"
                      className="w-full px-2.5 py-2 rounded-lg border border-input bg-background text-xs text-muted-foreground mb-2 focus:outline-none focus:ring-2 focus:ring-primary/40" />

                    <div className="flex gap-2">
                      <input type="date" value={e.scheduled_date} onChange={ev => updateEdit(s.id, 'scheduled_date', ev.target.value)}
                        className="flex-1 px-2.5 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                      <input type="time" value={e.scheduled_time} onChange={ev => updateEdit(s.id, 'scheduled_time', ev.target.value)}
                        className="flex-1 px-2.5 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
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
