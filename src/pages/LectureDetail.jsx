import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { fetchWithCache } from '@/hooks/useEntityData';
import { cacheGet, cacheSet, invalidateEntity } from '@/lib/cache';
import { enqueueOperation } from '@/lib/syncQueue';
import { ChevronLeft, FileText, Clock, AlertCircle, Loader2, Tag, BookOpen, ListChecks, Lightbulb, Sparkles, Headphones, CloudOff, Zap, Trash2, AlertTriangle } from 'lucide-react';
import TranscriptActions from '@/components/TranscriptActions';
import InLectureQuiz from '@/components/InLectureQuiz';
import AutosaveIndicator from '@/components/AutosaveIndicator';

export default function LectureDetail() {
  const { lectureId } = useParams();
  const navigate = useNavigate();
  const [lecture, setLecture] = useState(null);
  const [cls, setCls] = useState(null);
  const [note, setNote] = useState('');
  const [noteId, setNoteId] = useState(null);
  const [loading, setLoading] = useState(true);
  // Autosave bookkeeping: the last value we know is persisted, so loading the
  // note doesn't trigger a pointless write, and a debounce timer.
  const lastSavedNoteRef = useRef('');
  const noteTimerRef = useRef(null);
  const [noteStatus, setNoteStatus] = useState('idle');
  const [showQuiz, setShowQuiz] = useState(false);
  // On-demand transcript cleanup — a paid pass, so it is never automatic.
  const [cleaning, setCleaning] = useState(false);
  const [cleanError, setCleanError] = useState(null);
  // Delete flow — two-step inline confirm, consistent with the pattern used
  // elsewhere in the app for destructive actions.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Try cache first for instant load, then fetch fresh
      const cachedLec = cacheGet('Lecture', 'get', [lectureId]);
      if (cachedLec) setLecture(cachedLec);

      const lec = navigator.onLine
        ? await base44.entities.Lecture.get(lectureId)
        : cachedLec;
      if (lec) {
        setLecture(lec);
        cacheSet('Lecture', 'get', [lectureId], lec);
      }
      if (lec?.class_id) {
        const c = await fetchWithCache('Class', 'get', [lec.class_id]);
        setCls(c);
      }
      const notes = await fetchWithCache('Note', 'filter', [{ lecture_id: lectureId }]);
      if (notes.length > 0) {
        setNote(notes[0].content || '');
        setNoteId(notes[0].id);
        lastSavedNoteRef.current = notes[0].content || '';
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [lectureId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Refetch when sync completes after reconnection
  useEffect(() => {
    const handler = () => loadData();
    window.addEventListener('cedar-data-changed', handler);
    return () => window.removeEventListener('cedar-data-changed', handler);
  }, [loadData]);

  const saveNote = useCallback(async () => {
    setNoteStatus('saving');
    try {
      if (!navigator.onLine) {
        // Queue the note save for later sync
        if (noteId) {
          enqueueOperation({ entity: 'Note', operation: 'update', args: [noteId, { content: note }] });
        } else {
          enqueueOperation({ entity: 'Note', operation: 'create', args: [{ lecture_id: lectureId, class_id: lecture?.class_id, content: note }] });
        }
        // Optimistically update local cache
        invalidateEntity('Note');
        lastSavedNoteRef.current = note;
        setNoteStatus('saved');
        return;
      }
      if (noteId) {
        await base44.entities.Note.update(noteId, { content: note });
        invalidateEntity('Note');
      } else {
        const n = await base44.entities.Note.create({ lecture_id: lectureId, class_id: lecture?.class_id, content: note });
        setNoteId(n.id);
        invalidateEntity('Note');
      }
      lastSavedNoteRef.current = note;
      setNoteStatus('saved');
      setTimeout(() => setNoteStatus('idle'), 2000);
    } catch (e) {
      // If network fails mid-save, queue for retry
      if (e?.message?.includes('network') || e?.message?.includes('fetch') || !navigator.onLine) {
        enqueueOperation({ entity: 'Note', operation: noteId ? 'update' : 'create', args: noteId ? [noteId, { content: note }] : [{ lecture_id: lectureId, class_id: lecture?.class_id, content: note }] });
        invalidateEntity('Note');
        lastSavedNoteRef.current = note;
        setNoteStatus('saved');
      } else {
        setNoteStatus('error');
      }
      console.error(e);
    }
  }, [note, noteId, lectureId, lecture?.class_id]);

  // Autosave notes ~800ms after typing stops. Replaces the old "Save Notes"
  // button. The first write creates the Note record; later ones update it.
  // Skips the initial load and any no-op change so we don't write on mount.
  useEffect(() => {
    if (loading) return;
    if (note === lastSavedNoteRef.current) return;
    // Don't create an empty Note record just because the box was focused.
    if (!noteId && !note.trim()) return;
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    setNoteStatus('saving');
    noteTimerRef.current = setTimeout(() => { saveNote(); }, 800);
    return () => { if (noteTimerRef.current) clearTimeout(noteTimerRef.current); };
  }, [note, loading, noteId, saveNote]);

  // Run the paid cleanup pass on this lecture's transcript. The backend is
  // idempotent — a lecture that is already cleaned returns early and is not
  // charged — so a double-tap can't double-spend.
  const cleanTranscript = async () => {
    setCleaning(true);
    setCleanError(null);
    try {
      const res = await base44.functions.invoke('cleanLectureTranscript', { lecture_id: lectureId });
      if (res?.data?.error) throw new Error(res.data.error);
      invalidateEntity('Lecture');
      await loadData();
    } catch (e) {
      console.error(e);
      setCleanError(e?.response?.data?.error || e?.message || 'Could not clean the transcript. Nothing was changed.');
    }
    setCleaning(false);
  };

  // Cleanup preserves the original in transcript_raw, so this is a pure field
  // swap — no LLM calls, nothing to pay for.
  const restoreRawTranscript = async () => {
    if (!lecture?.transcript_raw) return;
    setCleaning(true);
    setCleanError(null);
    try {
      await base44.entities.Lecture.update(lectureId, {
        transcript: lecture.transcript_raw,
        transcript_cleaned: false,
      });
      invalidateEntity('Lecture');
      await loadData();
    } catch (e) {
      console.error(e);
      setCleanError('Could not restore the original transcript.');
    }
    setCleaning(false);
  };

  const deleteLecture = async () => {
    setDeleting(true);
    try {
      await base44.entities.Lecture.delete(lectureId);
      navigate(cls ? `/classes/${cls.id}?tab=lectures` : '/classes');
    } catch (e) {
      alert('Could not delete this lecture. Please try again.');
      setDeleting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin"></div></div>;
  if (!lecture) return <div className="p-6 text-center text-muted-foreground">Lecture not found.</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-10 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <Link to={cls ? `/classes/${cls.id}` : '/classes'} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> {cls?.name || 'Classes'}
        </Link>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {lecture?.ai_summary && (
            <button onClick={() => setShowQuiz(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
              <Zap className="w-3.5 h-3.5" /> Quick Quiz
            </button>
          )}
          <Link to={`/lecture-review?ids=${lectureId}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-primary/5 hover:border-primary/30 transition-colors">
            <ListChecks className="w-3.5 h-3.5" /> Review
          </Link>
          <Link to={`/planner?tab=practice&classId=${lecture?.class_id || ''}&ids=${lectureId}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-primary/5 hover:border-primary/30 transition-colors">
            <BookOpen className="w-3.5 h-3.5" /> Practice
          </Link>
          <Link to={`/focus?lectureId=${lectureId}&classId=${lecture?.class_id || ''}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-primary/5 hover:border-primary/30 transition-colors">
            <Headphones className="w-3.5 h-3.5" /> Focus
          </Link>
          <button onClick={() => setConfirmingDelete(true)} aria-label="Delete lecture"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-destructive/30 text-destructive text-xs font-medium hover:bg-destructive/10 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmingDelete && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 mb-6">
          <div className="flex items-start gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">This permanently deletes this lecture, its transcript, and its AI-generated notes. This can’t be undone.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setConfirmingDelete(false)} disabled={deleting}
              className="flex-1 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50">
              Cancel
            </button>
            <button onClick={deleteLecture} disabled={deleting}
              className="flex-1 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 flex items-center justify-center gap-2">
              {deleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</> : <><Trash2 className="w-4 h-4" /> Delete permanently</>}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <FileText className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="font-heading text-xl font-bold">{lecture.ai_title || `Lecture — ${lecture.date}`}</h1>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{lecture.date}</span>
            {lecture.duration_seconds > 0 && <span>• {Math.floor(lecture.duration_seconds / 60)} min</span>}
            {lecture.is_ai_estimated && <span className="flex items-center gap-1 text-amber-600"><AlertCircle className="w-3 h-3" /> AI Estimated</span>}
            {lecture.status === 'processing' && <span className="text-amber-600">• AI Processing...</span>}
          </div>
        </div>
      </div>

      {/* AI Estimated banner */}
      {lecture.is_ai_estimated && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 mb-6 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-500">This lecture was not recorded. The summary below is AI-generated based on previous lectures and course context. It may not reflect what was actually covered in class.</p>
        </div>
      )}

      {/* Audio player */}
      {lecture.recording_url && !lecture.is_missed && (
        <div className="rounded-xl border border-border bg-card p-4 mb-6">
          <audio controls className="w-full" src={lecture.recording_url}></audio>
        </div>
      )}

      {/* AI Summary */}
      {lecture.ai_summary && (
        <Section icon={Sparkles} title="AI Summary">
          <p className="text-sm text-foreground leading-relaxed">{lecture.ai_summary}</p>
        </Section>
      )}

      {/* Key Concepts */}
      {lecture.ai_concepts && lecture.ai_concepts.length > 0 && (
        <Section icon={Lightbulb} title="Key Concepts">
          <div className="flex flex-wrap gap-2">
            {lecture.ai_concepts.map((c, i) => (
              <span key={i} className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">{c}</span>
            ))}
          </div>
        </Section>
      )}

      {/* Vocabulary & Definitions */}
      {lecture.ai_definitions && lecture.ai_definitions.length > 0 && (
        <Section icon={BookOpen} title="Definitions">
          <div className="space-y-2">
            {lecture.ai_definitions.map((d, i) => (
              <div key={i} className="text-sm">
                <span className="font-medium text-foreground">{d.term}</span>
                <span className="text-muted-foreground"> — {d.definition}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Formulas */}
      {lecture.ai_formulas && lecture.ai_formulas.length > 0 && (
        <Section icon={Tag} title="Formulas">
          <div className="space-y-1.5">
            {lecture.ai_formulas.map((f, i) => (
              <div key={i} className="px-3 py-2 rounded-lg bg-muted font-mono text-sm">{f}</div>
            ))}
          </div>
        </Section>
      )}

      {/* Action Items */}
      {lecture.ai_action_items && lecture.ai_action_items.length > 0 && (
        <Section icon={ListChecks} title="Action Items">
          <ul className="space-y-1.5">
            {lecture.ai_action_items.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />{a}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Exam Mentions */}
      {lecture.ai_exam_mentions && lecture.ai_exam_mentions.length > 0 && (
        <Section icon={AlertCircle} title="Exam Announcements">
          <ul className="space-y-1.5">
            {lecture.ai_exam_mentions.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-500">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{m}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Transcript */}
      {lecture.transcript && (
        <Section icon={FileText} title="Transcript" actions={<TranscriptActions lecture={lecture} />}>
          {/* Recordings are stored as raw speech-to-text. Cleanup is a paid,
              on-demand pass rather than something every lecture pays for — most
              recordings are perfectly readable without it. */}
          <div className="flex items-center justify-between gap-3 mb-3">
            {lecture.transcript_cleaned ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
                <Sparkles className="w-3 h-3" /> Cleaned up
              </span>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Raw transcript. Clean it up if this recording came out noisy.
              </p>
            )}

            {!lecture.transcript_cleaned && (
              <button
                onClick={cleanTranscript}
                disabled={cleaning}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 flex-shrink-0 transition-colors"
              >
                {cleaning
                  ? <><Loader2 className="w-3 h-3 animate-spin" /> Cleaning…</>
                  : <><Sparkles className="w-3 h-3" /> Clean up transcript</>}
              </button>
            )}
          </div>

          {cleanError && (
            <p className="text-[11px] text-destructive mb-2">{cleanError}</p>
          )}

          <div className="max-h-64 overflow-y-auto pr-2">
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{lecture.transcript}</p>
          </div>

          {lecture.transcript_cleaned && lecture.transcript_raw && (
            <button
              onClick={restoreRawTranscript}
              disabled={cleaning}
              className="mt-2 text-[11px] text-muted-foreground hover:text-foreground underline disabled:opacity-50"
            >
              Restore the original
            </button>
          )}
        </Section>
      )}

      {/* Notes */}
      <Section icon={FileText} title="My Notes">
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Add your own notes here..."
          className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
          rows={5}
        />
        <div className="mt-2 flex items-center gap-2">
          <AutosaveIndicator status={noteStatus} />
          {!navigator.onLine && <CloudOff className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </Section>
      {/* In-lecture focus quiz */}
      {showQuiz && lecture && (
        <InLectureQuiz
          lecture={lecture}
          cls={cls}
          onClose={() => { setShowQuiz(false); loadData(); }}
        />
      )}
    </div>
  );
}

function Section({ icon: Icon, title, children, actions }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 mb-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" strokeWidth={2} />
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}
