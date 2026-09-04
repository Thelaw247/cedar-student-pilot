import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, X, FileText, BookOpen, ChevronLeft } from 'lucide-react';
import { getSetting } from '@/lib/settings';
import { useFeatureGate } from '@/components/monetization/useFeatureGate';
import ScheduleSkippedNotice from '@/components/monetization/ScheduleSkippedNotice';

export default function AddExamOrStudyModal({ classes, onClose }) {
  const [mode, setMode] = useState(null);

  if (!mode) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 glass" onClick={onClose}>
        <div className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border p-6 animate-fade-in max-h-[90dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-lg font-semibold">Add to Plan</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-2">
            <button onClick={() => setMode('exam')} className="w-full flex items-center gap-3 rounded-xl border border-border p-4 hover:bg-muted transition-colors text-left">
              <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Add Exam / Assignment</p>
                <p className="text-xs text-muted-foreground">Creates a deadline and generates an AI study plan</p>
              </div>
            </button>
            <button onClick={() => setMode('study')} className="w-full flex items-center gap-3 rounded-xl border border-border p-4 hover:bg-muted transition-colors text-left">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Add Study Block</p>
                <p className="text-xs text-muted-foreground">Schedule a single study session</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'exam') {
    return <ExamForm classes={classes} onBack={() => setMode(null)} onClose={onClose} />;
  }
  return <StudyForm classes={classes} onBack={() => setMode(null)} onClose={onClose} />;
}

function ExamForm({ classes, onBack, onClose }) {
  const [form, setForm] = useState({ title: '', due_date: '', type: 'exam', class_id: '', coverage_scope: 'cumulative' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // The deadline itself is free for everyone; the auto-generated AI study
  // plan around it ships with Scholar (server re-enforces). Below that plan
  // this used to skip the booking and close, so the exam appeared with no
  // sessions and no explanation.
  const [scheduleSkipped, setScheduleSkipped] = useState(false);
  const scheduleGate = useFeatureGate('study_schedule');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.due_date || !form.class_id) return;
    setSaving(true);
    setError(null);
    try {
      const assignment = await base44.entities.Assignment.create({ ...form });
      if (!getSetting('autoGenerateSchedules')) { onClose(); return; }
      if (!scheduleGate.allowed) { setScheduleSkipped(true); setSaving(false); return; }
      await base44.functions.invoke('generateStudySchedule', { assignment_id: assignment.id });
      onClose();
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || err?.response?.data?.error
        || 'Saved, but the study sessions could not be booked. Try again from the exam.');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 glass" onClick={onClose}>
      <div className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border p-6 animate-fade-in max-h-[90dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {scheduleSkipped ? <ScheduleSkippedNotice typeLabel={form.type} onClose={onClose} /> : <>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground"><ChevronLeft className="w-5 h-5" /></button>
          <h3 className="font-heading text-lg font-semibold">Add Exam</h3>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="text" placeholder="Title (e.g. Midterm Exam)" value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" autoFocus />
          <select value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
            <option value="">Select a class...</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="date" value={form.due_date}
            onChange={e => setForm({ ...form, due_date: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
            <option value="exam">Exam</option>
            <option value="quiz">Quiz</option>
            <option value="assignment">Assignment</option>
            <option value="project">Project</option>
          </select>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onBack} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted">Back</button>
            {/* The label says what this button will actually do. */}
            <button type="submit" disabled={saving || !form.title || !form.due_date || !form.class_id} className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Planning...</> : scheduleGate.allowed ? 'Add & Plan' : 'Add exam'}
            </button>
          </div>
        </form>
        </>}
      </div>
    </div>
  );
}

function StudyForm({ classes, onBack, onClose }) {
  const [form, setForm] = useState({
    class_id: '',
    title: '',
    scheduled_date: new Date().toLocaleDateString('en-CA'),
    scheduled_time: '19:00',
    duration_minutes: 60,
    priority: 'medium',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.class_id || !form.scheduled_date) return;
    setSaving(true);
    setError(null);
    try {
      // Fall back to the class name so the block is never nameless in the
      // planner or calendar (see src/lib/sessionTitle.js).
      const fallback = classes.find(c => c.id === form.class_id)?.name;
      await base44.entities.StudySession.create({
        ...form,
        title: form.title.trim() || (fallback ? `${fallback} study block` : 'Study block'),
        status: 'scheduled',
      });
      onClose();
    } catch (err) {
      // A block the student typed in themselves vanishing without a word is
      // the same silence this change exists to remove.
      console.error(err);
      setError(err?.message || 'Could not save this study block. Try again.');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 glass" onClick={onClose}>
      <div className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border p-6 animate-fade-in max-h-[90dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground"><ChevronLeft className="w-5 h-5" /></button>
          <h3 className="font-heading text-lg font-semibold">Add Study Block</h3>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <select value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
            <option value="">Select a class...</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="text" placeholder="Session title (optional)" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          <input type="date" value={form.scheduled_date} onChange={e => setForm({ ...form, scheduled_date: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          <div className="grid grid-cols-2 gap-3">
            <input type="time" value={form.scheduled_time} onChange={e => setForm({ ...form, scheduled_time: e.target.value })}
              className="px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            <select value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })}
              className="px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              {[30, 45, 60, 90, 120].map(m => <option key={m} value={m}>{m} min</option>)}
            </select>
          </div>
          <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
            <option value="low">Low Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="high">High Priority</option>
          </select>
          <input type="text" placeholder="Notes (optional)" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onBack} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted">Back</button>
            <button type="submit" disabled={saving || !form.class_id} className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding...</> : 'Add Block'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}