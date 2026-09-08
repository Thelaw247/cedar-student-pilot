import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, ChevronLeft } from 'lucide-react';
import { useFeatureGate } from '@/components/monetization/useFeatureGate';
import ScheduleSkippedNotice from '@/components/monetization/ScheduleSkippedNotice';
import DeadlineCoverage, { coverageSummary } from '@/components/DeadlineCoverage';
import { defaultCoverageScope, deadlineTypeLabel, resolveAssignmentLectures } from '@/lib/assignmentScope';
import { saveDeadline, bookSessionsFor, bookingErrorMessage } from '@/lib/saveDeadline';

/**
 * DeadlineForm — adding an exam, quiz, assignment or project. One copy.
 *
 * There were two, near enough character for character: the exam form behind
 * the home screen's "Add to Plan" and the add form on a class page. They
 * drifted, as two copies do — ClassDetail's went months without checking the
 * study-schedule gate at all — and a third caller was about to appear
 * (confirming a deadline Praelecta heard in a lecture), which would have made
 * three.
 *
 * Two steps for an exam or a quiz, one for anything else. What an exam covers
 * is DERIVED — the student never typed it — and it decides what every study
 * session and handbook after it is built from, so it is shown and confirmed
 * before the row is written. An assignment covers nothing by default, and
 * there is nothing to confirm about nothing; it gets a one-line summary that
 * opens the same control.
 *
 * Props:
 *   classes     offer a class picker (home screen). Omit when classId is fixed.
 *   classId     the class this belongs to, when the caller already knows.
 *   lectures        preloaded, if the caller has them (a class page does)
 *   priorAssignments  same — the class's other deadlines, for 'since_last'
 *   initial     { title, due_date, type } to start from, e.g. a detection
 *   cancelLabel what the left button says
 *   onCancel()  the left button
 *   onSaved(assignment)  the row now exists. Fires immediately, BEFORE the
 *               plan notice, so a caller recording the outcome (the detection
 *               card) cannot miss it if the student closes the modal.
 *   onDone()    the flow is finished — close.
 */
export default function DeadlineForm({
  classes = null,
  classId = '',
  lectures: presetLectures = null,
  priorAssignments: presetAssignments = null,
  initial = null,
  cancelLabel = 'Cancel',
  onCancel,
  onSaved = null,
  onDone,
}) {
  const startType = initial?.type || (classes ? 'exam' : 'assignment');
  const [step, setStep] = useState('fields');
  const [form, setForm] = useState({
    title: initial?.title || '',
    due_date: initial?.due_date || '',
    type: startType,
    class_id: classId || '',
    coverage_scope: defaultCoverageScope(startType),
    lecture_ids: [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // The deadline itself is free for everyone; the plan of sessions around it
  // ships with Scholar (the server re-enforces). Below that plan both forms
  // used to skip the booking and close, so the deadline appeared with no
  // sessions and no explanation.
  const [scheduleSkipped, setScheduleSkipped] = useState(false);
  const [savedAssignment, setSavedAssignment] = useState(null);
  const scheduleGate = useFeatureGate('study_schedule');
  const [lectures, setLectures] = useState(presetLectures || []);
  const [priorAssignments, setPriorAssignments] = useState(presetAssignments || []);
  const [showCoverage, setShowCoverage] = useState(false);

  const confirmsCoverage = form.type === 'exam' || form.type === 'quiz';

  // Loaded for whichever class is chosen, not only when specific lectures
  // were asked for: the control shows what the scope resolves to, and it
  // cannot do that without the lectures it would resolve over. A caller that
  // already has them (a class page) passes them in and nothing is fetched.
  useEffect(() => {
    if (presetLectures) return;
    let cancelled = false;
    const id = form.class_id;
    if (!id) { setLectures([]); setPriorAssignments([]); return; }
    (async () => {
      const [lecs, asgns] = await Promise.all([
        base44.entities.Lecture.filter({ class_id: id }, 'date').catch(() => []),
        base44.entities.Assignment.filter({ class_id: id }).catch(() => []),
      ]);
      if (cancelled) return;
      setLectures(lecs);
      setPriorAssignments(asgns);
    })();
    return () => { cancelled = true; };
  }, [form.class_id, presetLectures]);

  const setCoverage = ({ scope, lectureIds }) => setForm((f) => ({ ...f, coverage_scope: scope, lecture_ids: lectureIds }));

  const covered = resolveAssignmentLectures(
    { id: '__draft__', due_date: form.due_date, coverage_scope: form.coverage_scope, lecture_ids: form.lecture_ids },
    lectures, priorAssignments,
  );

  const save = async () => {
    setSaving(true);
    setError(null);

    // A booking that failed leaves the deadline saved and this form on screen
    // with its button still live. Pressing it again used to create a SECOND
    // assignment — nothing in the database stops two deadlines with the same
    // title and date — each with its own column of study sessions. The row
    // exists; only the booking is owed.
    if (savedAssignment) {
      try {
        await bookSessionsFor(savedAssignment.id);
        onDone();
        return;
      } catch (err) {
        console.error(err);
        setError(bookingErrorMessage(err));
      }
      setSaving(false);
      return;
    }

    try {
      const { assignment, outcome, error: bookingError } = await saveDeadline({
        fields: {
          title: form.title,
          due_date: form.due_date,
          type: form.type,
          class_id: form.class_id,
          coverage_scope: form.coverage_scope,
          // Only 'custom' reads this list; storing it under a derived scope
          // would be a second, frozen answer to the same question.
          lecture_ids: form.coverage_scope === 'custom' ? form.lecture_ids : [],
        },
        scheduleAllowed: scheduleGate.allowed,
      });
      setSavedAssignment(assignment);
      onSaved?.(assignment);
      if (outcome === 'locked') { setScheduleSkipped(true); setSaving(false); return; }
      if (outcome === 'failed') { setError(bookingError); setSaving(false); return; }
      onDone();
      return;
    } catch (err) {
      // The create itself failed, so nothing was written — say that, rather
      // than the "saved, but the sessions..." sentence both copies used to
      // show for either failure.
      console.error(err);
      setError(err?.response?.data?.message || err?.response?.data?.error
        || 'That could not be saved. Check your connection and try again.');
    }
    setSaving(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title || !form.due_date || !form.class_id) return;
    if (confirmsCoverage) { setStep('coverage'); return; }
    save();
  };

  if (scheduleSkipped) {
    return <ScheduleSkippedNotice typeLabel={deadlineTypeLabel(form.type)} assignmentId={savedAssignment?.id} onClose={onDone} />;
  }

  if (step === 'coverage') {
    return (
      <>
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => setStep('fields')} className="text-muted-foreground hover:text-foreground"><ChevronLeft className="w-5 h-5" /></button>
          <h3 className="font-heading text-lg font-semibold">Does this look right?</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4 pl-8">
          These are the lectures &ldquo;{form.title}&rdquo; will be studied from.
        </p>
        <DeadlineCoverage
          type={form.type} lectures={lectures} dueDate={form.due_date}
          scope={form.coverage_scope} lectureIds={form.lecture_ids}
          priorAssignments={priorAssignments} onChange={setCoverage}
        />
        {error && <p className="text-xs text-destructive mt-3">{error}</p>}
        <div className="flex gap-2 pt-4">
          <button type="button" onClick={() => setStep('fields')} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted">Back</button>
          <button type="button" onClick={save} disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
              : savedAssignment ? 'Try booking again'
                : `Add ${deadlineTypeLabel(form.type)}`}
          </button>
        </div>
      </>
    );
  }

  const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40';

  return (
    <>
      <h3 className="font-heading text-lg font-semibold mb-4">Add {deadlineTypeLabel(form.type)}</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input type="text" placeholder="Title (e.g. Midterm Exam)" value={form.title}
          onChange={e => setForm({ ...form, title: e.target.value })} className={inputCls} autoFocus />
        {/* A different class means different lectures, so a scope picked
            against the old one goes back to the type's default. Keeping
            'custom' here left the row saved as "specific lectures" with an
            empty list — which the resolver reads as "nobody picked yet". */}
        {classes && (
          <select value={form.class_id} onChange={e => setForm({
            ...form, class_id: e.target.value,
            coverage_scope: defaultCoverageScope(form.type), lecture_ids: [],
          })} className={inputCls}>
            <option value="">Select a class...</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <input type="date" value={form.due_date}
          onChange={e => setForm({ ...form, due_date: e.target.value })} className={inputCls} />
        <select value={form.type} onChange={e => {
          // The type decides what the thing is, so its coverage returns to
          // that type's default instead of carrying an exam's scope onto a
          // problem set.
          const type = e.target.value;
          setForm({ ...form, type, coverage_scope: defaultCoverageScope(type), lecture_ids: [] });
          setShowCoverage(false);
        }} className={inputCls}>
          <option value="exam">Exam</option>
          <option value="quiz">Quiz</option>
          <option value="assignment">Assignment</option>
          <option value="project">Project</option>
        </select>
        {/* An assignment or a project covers no lectures unless the student
            says otherwise, so this is one line until they open it. Exams
            confirm theirs on the next step instead. */}
        {!confirmsCoverage && (
          showCoverage ? (
            <DeadlineCoverage
              type={form.type} lectures={lectures} dueDate={form.due_date}
              scope={form.coverage_scope} lectureIds={form.lecture_ids}
              priorAssignments={priorAssignments} onChange={setCoverage}
              className="rounded-lg border border-border p-3"
            />
          ) : (
            <button type="button" onClick={() => setShowCoverage(true)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted">
              <span>Covers: {coverageSummary(form.coverage_scope, form.type, covered.length)}</span>
              <span className="text-xs font-medium text-primary">Change</span>
            </button>
          )
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted">{cancelLabel}</button>
          {/* The label says what this button will actually do. "Add & Plan
              Study" on a plan that cannot plan is a promise the next screen
              breaks. */}
          <button type="submit" disabled={saving || !form.title || !form.due_date || !form.class_id}
            className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
              : savedAssignment ? 'Try booking again'
                : confirmsCoverage ? 'Next: what it covers'
                  : scheduleGate.allowed ? 'Add & Plan Study' : `Add ${deadlineTypeLabel(form.type)}`}
          </button>
        </div>
      </form>
    </>
  );
}

/** The modal shell both add surfaces put this form in. */
export function DeadlineModal({ onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 glass" onClick={onClose}>
      <div className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border p-6 animate-fade-in max-h-[90dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
