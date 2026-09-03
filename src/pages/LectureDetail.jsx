import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { fetchWithCache } from '@/hooks/useEntityData';
import { cacheGet, cacheSet, invalidateEntity } from '@/lib/cache';
import { enqueueOperation } from '@/lib/syncQueue';
import { ChevronLeft, FileText, Clock, AlertCircle, Loader2, BookOpen, ListChecks, Sparkles, Headphones, CloudOff, Zap, Trash2, AlertTriangle } from 'lucide-react';
import TranscriptActions from '@/components/TranscriptActions';
import LectureJumpNav from '@/components/lecture/LectureJumpNav';
import TranscriptViewer, { TranscriptCleanup } from '@/components/lecture/TranscriptViewer';
import LectureTodos from '@/components/lecture/LectureTodos';
import LectureMaterials from '@/components/lecture/LectureMaterials';
import {
  OverviewSection, OutlineSection, ConceptsSection, FormulasSection, DefinitionsSection,
  ExamplesSection, ExamRadarSection, InsightsSection,
} from '@/components/lecture/StudySections';
import { enrichmentOf } from '@/components/lecture/lectureStudy';
import InLectureQuiz from '@/components/InLectureQuiz';
import AutosaveIndicator from '@/components/AutosaveIndicator';
import { useBalance } from '@/hooks/useBalance';
import Widget from '@/components/ui/Widget';
import { useUpgrade } from '@/components/monetization/UpgradeContext';
import { useFeatureGate } from '@/components/monetization/useFeatureGate';
import { Lock } from 'lucide-react';
import { LECTURE_COMPLETE } from '@/lib/lectureStatus';
import { classifySaveError, describeSaveError } from '@/lib/saveErrors';

export default function LectureDetail() {
  const { lectureId } = useParams();
  const navigate = useNavigate();
  const [lecture, setLecture] = useState(null);
  const [recordingPlaybackUrl, setRecordingPlaybackUrl] = useState(null);
  const [recordingPlaybackError, setRecordingPlaybackError] = useState(null);
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
  // What the last cleanup pass actually changed, so a subtle result is still
  // visible. Null until a run completes in this session.
  const [cleanResult, setCleanResult] = useState(null);
  // Delete flow — two-step inline confirm, consistent with the pattern used
  // elsewhere in the app for destructive actions.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Post-value upsell (MON-04 §3, trigger #4): shown to Free users on a
  // completed lecture — the moment belief peaks — dismissible per lecture,
  // never blocking, never repeated once dismissed.
  const { tier } = useBalance();
  const { openUpgrade } = useUpgrade();
  const quizGate = useFeatureGate('lecture_review');
  const cleanGate = useFeatureGate('clean_transcript');
  const [upsellDismissed, setUpsellDismissed] = useState(() => {
    try { return !!localStorage.getItem(`cedar-lec-upsell-${lectureId}`); } catch { return true; }
  });
  const dismissUpsell = () => {
    try { localStorage.setItem(`cedar-lec-upsell-${lectureId}`, '1'); } catch { /* cosmetic */ }
    setUpsellDismissed(true);
  };
  const [deleting, setDeleting] = useState(false);
  // Re-submitting a recording whose processing failed or never started.
  const [retrying, setRetrying] = useState(false);
  // "Show in transcript" from any study item: { quote, offset, nonce }. The
  // nonce makes tapping the same anchor twice scroll again.
  const [jump, setJump] = useState(null);
  const jumpTo = useCallback((anchor) => setJump({ ...anchor, nonce: Date.now() }), []);
  const [materialsCount, setMaterialsCount] = useState(0);

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

  useEffect(() => {
    let cancelled = false;
    const recordingRef = lecture?.recording_url;
    setRecordingPlaybackError(null);
    if (!recordingRef) {
      setRecordingPlaybackUrl(null);
      return () => { cancelled = true; };
    }
    if (!String(recordingRef).startsWith('r2://')) {
      setRecordingPlaybackUrl(recordingRef);
      return () => { cancelled = true; };
    }
    setRecordingPlaybackUrl(null);
    base44.files.getDownloadUrl(recordingRef)
      .then((url) => { if (!cancelled) setRecordingPlaybackUrl(url); })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setRecordingPlaybackError('The recording could not be loaded. Please try again.');
      });
    return () => { cancelled = true; };
  }, [lecture?.recording_url]);

  // Refetch when sync completes after reconnection
  useEffect(() => {
    const handler = () => loadData();
    window.addEventListener('cedar-data-changed', handler);
    return () => window.removeEventListener('cedar-data-changed', handler);
  }, [loadData]);

  // Lecture processing is asynchronous — the server answers 202 and works in
  // the background. While this page shows "AI Processing...", poll quietly
  // (without the loading spinner) so the analysis appears the moment it
  // lands instead of waiting for a manual refresh.
  //
  // The study page (ai_enrichment) lands a little after the base analysis —
  // the server marks the lecture complete first so the summary shows at
  // once, then runs the second pass. Keep polling briefly after 'complete'
  // until enriched_at appears, so the concept cards and formulas fill in
  // without a refresh. Give up after a few minutes: an older lecture, or one
  // whose pass failed, just shows the base page (and the materials widget
  // offers a re-run).
  const awaitingEnrichment = lecture?.status === LECTURE_COMPLETE && !!lecture?.ai_title && !lecture?.enriched_at
    && (Date.now() - new Date(lecture?.updated_at || 0).getTime()) < 5 * 60 * 1000;
  useEffect(() => {
    if (lecture?.status !== 'processing' && !awaitingEnrichment) return undefined;
    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const fresh = await base44.entities.Lecture.get(lectureId);
        if (cancelled || !fresh) return;
        const changed = fresh.status !== lecture?.status || fresh.enriched_at !== lecture?.enriched_at;
        if (changed) {
          cacheSet('Lecture', 'get', [lectureId], fresh);
          setLecture(fresh);
        }
      } catch { /* transient — keep polling */ }
    }, 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [lecture?.status, lecture?.enriched_at, awaitingEnrichment, lectureId]);

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
    setCleanResult(null);
    try {
      const res = await base44.functions.invoke('cleanLectureTranscript', { lecture_id: lectureId });
      if (res?.data?.error) throw new Error(res.data.error);
      // Cleanup is punctuation, spelling and paragraphing — on a recording
      // that was already fairly clean the diff can be a few hundred characters
      // in twenty thousand, which reads as "nothing happened" unless we say
      // what changed. The server reports both lengths; show them.
      const { calls, chars_before: before, chars_after: after } = res?.data || {};
      if (Number.isFinite(before) && Number.isFinite(after)) {
        setCleanResult({ calls, before, after, delta: Math.abs(after - before) });
      }
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
    setCleanResult(null);
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

  // A lecture handed back as 'pending' after a processing failure (or one
  // whose processing never started) can be re-submitted from here. The server
  // answers 202 and works in the background; flipping the local status to
  // 'processing' hands off to the polling effect above, which shows the
  // analysis the moment it lands.
  const retryProcessing = async () => {
    setRetrying(true);
    try {
      await base44.functions.invoke('processLectureRecording', { lecture_id: lectureId });
      const fresh = { ...lecture, status: 'processing' };
      cacheSet('Lecture', 'get', [lectureId], fresh);
      setLecture(fresh);
    } catch (e) {
      console.error(e);
      // Same classification as the recording island, so a provider rate
      // limit reads as "wait", not as a bug to hammer.
      const copy = describeSaveError(classifySaveError(e));
      alert(`${copy.title}\n\n${copy.body}`);
    }
    setRetrying(false);
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-32 bg-muted rounded" />
          <div className="h-14 bg-muted rounded-xl" />
          <div className="h-32 bg-muted rounded-xl" />
          <div className="h-24 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }
  if (!lecture) return <div className="p-6 text-center text-muted-foreground">Lecture not found.</div>;

  const enrichment = enrichmentOf(lecture);
  const jumpItems = [
    { id: 'sec-overview', label: 'Overview', count: lecture.ai_summary || enrichment ? null : 0 },
    { id: 'sec-outline', label: 'Outline', count: enrichment?.outline?.length || 0 },
    { id: 'sec-concepts', label: 'Concepts', count: enrichment?.concepts?.length || lecture.ai_concepts?.length || 0 },
    { id: 'sec-formulas', label: 'Formulas', count: enrichment?.formulas?.length || lecture.ai_formulas?.length || 0 },
    { id: 'sec-definitions', label: 'Definitions', count: enrichment?.definitions?.length || lecture.ai_definitions?.length || 0 },
    { id: 'sec-examples', label: 'Examples', count: enrichment?.examples?.length || 0 },
    { id: 'sec-exam', label: 'Exam', count: enrichment?.exam_radar?.length || lecture.ai_exam_mentions?.length || 0 },
    { id: 'sec-todos', label: 'To-do', count: null },
    { id: 'sec-materials', label: 'Materials', count: lecture.is_ai_estimated ? 0 : null },
    { id: 'sec-transcript', label: 'Transcript', count: lecture.transcript ? null : 0 },
    { id: 'sec-notes', label: 'Notes', count: null },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-10 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <Link to={cls ? `/classes/${cls.id}` : '/classes'} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> {cls?.name || 'Classes'}
        </Link>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {lecture?.ai_summary && (
            quizGate.allowed ? (
              <button onClick={() => setShowQuiz(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                <Zap className="w-3.5 h-3.5" /> Quick Quiz
              </button>
            ) : (
              <button onClick={quizGate.lock} title={`Quick quizzes ship with ${quizGate.requiredTierName}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-muted-foreground text-xs font-medium hover:text-foreground transition-colors">
                <Lock className="w-3.5 h-3.5" /> Quick Quiz
              </button>
            )
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

      {/* Post-value upsell — Free tier, completed lecture, dismissible */}
      {tier === 'free' && lecture.status === LECTURE_COMPLETE && lecture.ai_title && !upsellDismissed && (
        <div className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-4 mb-6 flex items-start gap-3">
          <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">This lecture is fully covered — transcript, summary and key concepts.</p>
            <p className="text-xs text-muted-foreground mt-0.5">Students on the Student plan cover about 20 lectures like this every month.</p>
            <div className="flex gap-2 mt-2.5">
              <button
                type="button"
                onClick={() => openUpgrade({ source: 'recording' })}
                className="px-3 py-1.5 rounded-button bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors duration-micro"
              >
                See plans
              </button>
              <button type="button" onClick={dismissUpsell} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Estimated banner */}
      {lecture.is_ai_estimated && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 mb-6 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-500">This lecture was not recorded. The summary below is AI-generated based on previous lectures and course context. It may not reflect what was actually covered in class.</p>
        </div>
      )}

      {/* Recording saved but never analyzed — offer to (re)start processing */}
      {lecture.status === 'pending' && lecture.recording_url && !lecture.ai_title && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 mb-6">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-500">This recording hasn't been processed yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                {lecture.processing_error
                  ? `Last attempt: ${lecture.processing_error}`
                  : 'The audio is safely stored. Start processing to get the transcript, summary, and flashcards.'}
              </p>
              <button onClick={retryProcessing} disabled={retrying}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50">
                {retrying ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Starting…</> : <><Sparkles className="w-3.5 h-3.5" /> Process recording</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audio player */}
      {lecture.recording_url && !lecture.is_missed && (
        <div className="rounded-xl border border-border bg-card p-4 mb-6">
          {recordingPlaybackUrl ? (
            <audio controls className="w-full" src={recordingPlaybackUrl}></audio>
          ) : recordingPlaybackError ? (
            <p className="text-sm text-destructive">{recordingPlaybackError}</p>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading recording…
            </div>
          )}
        </div>
      )}

      {/* Processing: show the shape of what's coming, with honest timing */}
      {lecture.status === 'processing' && !lecture.ai_summary && (
        <div className="rounded-xl border border-border bg-card p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <p className="text-sm font-semibold text-foreground">Transcribing and summarizing…</p>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3">Usually under a minute for a typical lecture — this page updates by itself.</p>
          <div className="animate-pulse space-y-2">
            <div className="h-3 bg-muted rounded w-full" />
            <div className="h-3 bg-muted rounded w-11/12" />
            <div className="h-3 bg-muted rounded w-4/5" />
          </div>
        </div>
      )}

      {/* Second pass still running — say so instead of showing a thin page */}
      {awaitingEnrichment && (
        <div className="rounded-xl border border-primary/25 bg-primary/[0.04] px-4 py-3 mb-4 flex items-center gap-2.5">
          <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
          <p className="text-[13px] text-foreground">Building the full study page — outline, concept cards, formulas, examples and to-dos are on their way.</p>
        </div>
      )}

      {/* The jump nav below is also the at-a-glance summary now — it used
          to sit under a separate static stat strip showing the same
          concepts/formulas/definitions/exam counts a second time. Removed
          3 Sep 2026: same numbers, and this one is actually clickable. */}
      <LectureJumpNav items={jumpItems} />

      {(lecture.ai_summary || enrichment) && <OverviewSection lecture={lecture} enrichment={enrichment} />}
      <OutlineSection outline={enrichment?.outline} onJump={jumpTo} />
      <ConceptsSection concepts={enrichment?.concepts} legacyConcepts={lecture.ai_concepts} onJump={jumpTo} />
      <FormulasSection formulas={enrichment?.formulas} legacyFormulas={lecture.ai_formulas} hasMaterials={materialsCount > 0} onJump={jumpTo} />
      <DefinitionsSection definitions={enrichment?.definitions} legacyDefinitions={lecture.ai_definitions} onJump={jumpTo} />
      <ExamplesSection examples={enrichment?.examples} onJump={jumpTo} />
      <ExamRadarSection radar={enrichment?.exam_radar} legacyMentions={lecture.ai_exam_mentions} onJump={jumpTo} />
      <InsightsSection misconceptions={enrichment?.misconceptions} questions={enrichment?.questions} />

      {(lecture.status === LECTURE_COMPLETE || lecture.transcript) && (
        <LectureTodos lecture={lecture} legacyActionItems={lecture.ai_action_items} />
      )}

      {!lecture.is_ai_estimated && (
        <LectureMaterials
          lecture={lecture}
          onEnriched={() => { invalidateEntity('Lecture'); loadData(); }}
          onCountChange={setMaterialsCount}
        />
      )}

      {/* Transcript */}
      {lecture.transcript && (
        <TranscriptViewer
          lecture={lecture}
          jump={jump}
          actions={<TranscriptActions lecture={lecture} />}
          cleanup={(
            <TranscriptCleanup
              lecture={lecture}
              cleanGate={cleanGate}
              cleaning={cleaning}
              cleanError={cleanError}
              cleanResult={cleanResult}
              onClean={cleanTranscript}
              onRestore={restoreRawTranscript}
            />
          )}
        />
      )}

      {/* Notes */}
      <Section icon={FileText} title="My Notes" id="sec-notes">
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

/**
 * Lecture sections ride the widget grammar (Design Blueprint, Lecture fixes):
 * summary and study content open by default, the transcript starts collapsed
 * (it's reference material) with its size in the meta line, and every choice
 * is remembered per user across lectures via storageKey.
 */
function Section({ icon, title, children, actions = null, storageKey = undefined, defaultOpen = true, meta = undefined, id = undefined }) {
  return (
    <Widget
      id={id}
      icon={icon}
      title={title}
      meta={meta}
      action={actions ? <span onClick={(e) => e.stopPropagation()}>{actions}</span> : undefined}
      collapsible={!!storageKey}
      defaultOpen={defaultOpen}
      storageKey={storageKey}
      className="mb-4 scroll-mt-24"
      padded
    >
      <div className="pt-1">{children}</div>
    </Widget>
  );
}
