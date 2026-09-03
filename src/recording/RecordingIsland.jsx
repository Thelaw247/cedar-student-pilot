import React, { useRef, useState, useEffect } from 'react';
import { Pause, Play, Square, Loader2, FileText, AlertTriangle, ChevronDown, Pencil, Paperclip, X } from 'lucide-react';
import { useRecording } from '@/recording/RecordingContext';
import { MATERIAL_ACCEPT } from '@/components/lecture/LectureMaterials';
import { formatClock } from '@/lib/time';

/**
 * "Attach the prof's slides" inside the island. Files wait in memory and
 * upload the moment the lecture is saved, before the analysis runs, so the
 * study page is verified against them from its first version.
 */
function StagedMaterials({ rec, compact = false }) {
  const inputRef = useRef(null);
  if (!rec.canAttachMaterials) return null;
  return (
    <div className={compact ? 'mb-3' : 'mt-3'}>
      <input ref={inputRef} type="file" accept={MATERIAL_ACCEPT} multiple className="hidden"
        onChange={(e) => { rec.addStagedMaterials(e.target.files); e.target.value = ''; }} />
      {rec.stagedMaterials.length > 0 && (
        <ul className="space-y-1 mb-2">
          {rec.stagedMaterials.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-[11px] text-white/80 bg-white/10 rounded-lg px-2.5 py-1.5">
              <FileText className="w-3 h-3 flex-shrink-0 text-white/60" />
              <span className="truncate flex-1">{f.name}</span>
              <button type="button" onClick={() => rec.removeStagedMaterial(i)} aria-label={`Remove ${f.name}`} className="text-white/50 hover:text-white"><X className="w-3 h-3" /></button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-white/70 hover:text-white transition-colors">
        <Paperclip className="w-3 h-3" />
        {rec.stagedMaterials.length ? 'Attach another file' : 'Attach the prof’s slides or handout (PDF)'}
      </button>
      {rec.stagedMaterials.length === 0 && (
        <p className="text-[10px] text-white/40 mt-1">Formulas and definitions get checked against them.</p>
      )}
    </div>
  );
}

/**
 * The floating handle on a live recording session (Design Blueprint §3).
 * Renders on every page while a session exists — recording, finishing,
 * saving, or processing — so the student can browse the app freely and
 * always see, in one glance, that the mic is running and for how long.
 *
 * Anatomy follows the Live Activities pattern: a compact pill (pulsing dot,
 * tabular timer, class name, pause/stop) that expands in place to the notes
 * sheet. It deliberately shares its dark surface across both themes: the
 * island is "live hardware", not a document, and staying visually constant
 * is what makes it read as the same object on every screen.
 */
export default function RecordingIsland() {
  const rec = useRecording();
  const [open, setOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Post-processing (3 Sep 2026 rework): a review session is now booked
  // automatically on the server the moment processing finishes (same day as
  // the lecture, next day if that's full) — see scheduleLectureReview in
  // server/routes/processLectureRecording.js. There is no client-side prompt
  // to show for it any more, so the island just closes the session the
  // instant that state arrives instead of opening a blocking modal.
  useEffect(() => {
    if (rec.reviewLectureId) rec.dismissReview();
  }, [rec.reviewLectureId, rec.dismissReview]);

  if (!rec.active || rec.reviewLectureId) return null;

  const shell = 'fixed z-40 left-4 right-4 bottom-[calc(84px+env(safe-area-inset-bottom))] lg:left-auto lg:right-6 lg:bottom-6 lg:w-[380px] rounded-3xl shadow-2 text-white overflow-hidden';
  const surface = { backgroundColor: '#14192A' };

  // --- Finishing the last upload ---
  if (rec.uploadingSegment) {
    return (
      <div className={shell} style={surface}>
        <div className="flex items-center gap-3 px-4 py-3">
          <Loader2 className="w-4 h-4 animate-spin text-white/80 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">Finishing upload…</p>
            <p className="text-[11px] text-white/60 truncate">Saving the last part of your recording</p>
          </div>
        </div>
      </div>
    );
  }

  // --- Processing on the server ---
  if (rec.processing) {
    return (
      <div className={shell} style={surface}>
        <div className="flex items-center gap-3 px-4 py-3">
          <Loader2 className="w-4 h-4 animate-spin text-white/80 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">Processing lecture…</p>
            <p className="text-[11px] text-white/60 truncate">{rec.cls?.name} · transcribing and summarizing</p>
          </div>
        </div>
      </div>
    );
  }

  // --- Stopped: ready to save (also the crash-recovery + error surface) ---
  if (rec.readyToSave) {
    const failure = rec.saveFailure;
    // A failure that will not clear by retrying now (provider rate limit,
    // credits, size cap) leads with "Process later" when the audio is already
    // durable server-side; "Try again" stays available but stops being the
    // default so a student is not steered into burning the quota twice.
    const retryIsSensible = !failure || failure.retryNow;
    const primaryClass = 'flex-[2] py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors';
    const secondaryClass = 'flex-1 py-2.5 rounded-xl border border-white/20 text-xs font-medium text-white/70 hover:bg-white/10 transition-colors';
    return (
      <div className={shell} style={surface}>
        <div className="px-4 py-3.5">
          {failure ? (
            <div className="flex items-start gap-2.5 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{failure.title}</p>
                <p className="text-[11px] text-white/60 mt-0.5">{failure.body}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-white/80" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">
                  {rec.recoveredOnBoot ? 'Unsaved recording found' : 'Recording complete'}
                </p>
                <p className="text-[11px] text-white/60 tabular-nums">
                  {formatClock(rec.seconds)} · {rec.cls?.name}
                  {rec.savedSegmentCount > 1 ? ` · ${rec.savedSegmentCount} segments` : ''}
                </p>
              </div>
            </div>
          )}
          {rec.recoveredOnBoot && !failure && (
            <p className="text-[11px] text-white/70 mb-3">
              This recording was interrupted — a refresh, a closed tab, or the browser reclaiming the page.
              The audio is safe on this device. Save it to finish.
            </p>
          )}
          {rec.recordingLimitReached && (
            <p className="text-[11px] text-amber-400/90 mb-3">The 6-hour limit was reached. Save this recording, then start a new one if class is continuing.</p>
          )}
          {!failure && <StagedMaterials rec={rec} compact />}
          {confirmDiscard ? (
            <div>
              <p className="text-[11px] text-white/70 mb-2">
                Delete this {formatClock(rec.seconds)} recording? It will be removed from this device
                {rec.savedSegmentCount > 0 ? ' and from your uploads' : ''}. This can't be undone.
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmDiscard(false)} className={secondaryClass}>
                  Keep it
                </button>
                <button type="button" onClick={() => { setConfirmDiscard(false); rec.discard(); }}
                  className="flex-[2] py-2.5 rounded-xl bg-red-500/80 text-white text-xs font-semibold hover:bg-red-500 transition-colors">
                  Delete recording
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmDiscard(true)} className={secondaryClass}>
                Discard
              </button>
              {failure && rec.canProcessLater && (
                <button type="button" onClick={rec.processLater}
                  className={retryIsSensible ? secondaryClass : primaryClass}>
                  Process later
                </button>
              )}
              <button type="button" onClick={rec.saveAndProcess}
                className={retryIsSensible || !rec.canProcessLater ? primaryClass : secondaryClass}>
                {failure ? 'Try again' : 'Save & Process'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Live: recording or paused ---
  return (
    <div className={shell} style={surface}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        {rec.paused
          ? <Pause className="w-3.5 h-3.5 text-white/60 flex-shrink-0" fill="currentColor" />
          : rec.micSilent
            ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" aria-label="Microphone is silent" />
            : <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />}
        <span className="text-sm font-bold tabular-nums flex-shrink-0">{formatClock(rec.seconds)}</span>
        <span className="text-xs text-white/60 truncate flex-1 min-w-0">{rec.cls?.name}</span>
        <span
          role="button"
          tabIndex={0}
          aria-label={rec.paused ? 'Resume recording' : 'Pause recording'}
          onClick={(e) => { e.stopPropagation(); rec.togglePause(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); rec.togglePause(); } }}
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center flex-shrink-0 transition-colors"
        >
          {rec.paused ? <Play className="w-3.5 h-3.5" fill="currentColor" /> : <Pause className="w-3.5 h-3.5" fill="currentColor" />}
        </span>
        <span
          role="button"
          tabIndex={0}
          aria-label="Stop recording"
          onClick={(e) => { e.stopPropagation(); rec.stop(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); rec.stop(); } }}
          className="w-8 h-8 rounded-full bg-red-500/25 hover:bg-red-500/40 text-red-300 flex items-center justify-center flex-shrink-0 transition-colors"
        >
          <Square className="w-3 h-3" fill="currentColor" />
        </span>
        <ChevronDown className={`w-4 h-4 text-white/50 flex-shrink-0 transition-transform duration-standard ease-standard ${open ? '' : 'rotate-180'}`} />
      </button>
      <div className={`grid transition-[grid-template-rows] duration-standard ease-standard ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden min-h-0">
          <div className="px-4 pb-4">
            {rec.savedSegmentCount > 0 && (
              <p className="text-[11px] text-white/50 mb-2">{rec.savedSegmentCount} segment{rec.savedSegmentCount === 1 ? '' : 's'} saved · crash-safe on this device</p>
            )}
            {rec.micSilent && (
              <p className="text-[11px] text-amber-400/90 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" /> The microphone stopped sending audio — the timer is paused until it comes back.
              </p>
            )}
            <label className="text-[11px] font-medium text-white/60 flex items-center gap-1.5 mb-1.5">
              <Pencil className="w-3 h-3" /> Your notes & cues
            </label>
            <textarea
              value={rec.liveNotes}
              onChange={(e) => rec.setLiveNotes(e.target.value)}
              placeholder="Jot down anything the prof emphasizes… saved with this lecture."
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
            <StagedMaterials rec={rec} />
          </div>
        </div>
      </div>
    </div>
  );
}
