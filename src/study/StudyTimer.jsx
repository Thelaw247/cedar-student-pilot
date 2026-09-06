import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, Square, Music, Loader2, Check, Brain, BarChart3 } from 'lucide-react';
import MusicPlayer from '@/components/MusicPlayer';
import SessionReview from '@/components/SessionReview';
import ProjectSessionEndModal from '@/components/ProjectSessionEndModal';
import { useStudySession, useStudyTick } from '@/study/StudySessionContext';

/**
 * The clock, and everything that happens when it stops.
 *
 * One component in two shapes, because the state behind them is one state and
 * a second copy is a second set of controls to keep in step:
 *
 *   strip  above the study tabs — a small ring, the time, the controls
 *   full   the project session screen — the big ring it has always had
 *
 * Session completion lives here rather than on either page: the save prompt,
 * the review offer, the project end. It moved with the engine so there is
 * exactly one place a finished session is handled, whichever screen it was
 * started from.
 */
export default function StudyTimer({ variant = 'strip', className = '' }) {
  const s = useStudySession();
  const t = useStudyTick();
  const navigate = useNavigate();
  const [error, setError] = React.useState(null);
  const [showReview, setShowReview] = React.useState(false);

  const onStop = async () => {
    setError(null);
    const res = await s.stop();
    if (!res.ok) setError(res.error);
  };

  const canStop = s.phase === 'studying' || s.phase === 'paused' || s.phase === 'break' || s.phase === 'complete';

  const ring = (size) => (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="90" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
        <circle cx="100" cy="100" r="90" fill="none" stroke={s.ringColor} strokeWidth="8"
          strokeLinecap="round" strokeDasharray={2 * Math.PI * 90}
          strokeDashoffset={2 * Math.PI * 90 * (1 - t.ringProgress)}
          style={{ transition: 'stroke-dashoffset 1s linear' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className={`font-heading font-bold tabular-nums text-foreground ${size > 120 ? 'text-4xl' : 'text-sm'}`}>{t.displayTime}</p>
        {size > 120 && <p className="text-xs text-muted-foreground mt-1">{s.phaseLabel}</p>}
      </div>
    </div>
  );

  const controls = (
    <div className="flex items-center gap-2">
      {s.phase === 'idle' && (
        <button type="button" onClick={s.start}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
          <Play className="w-3.5 h-3.5" fill="currentColor" /> Start
        </button>
      )}
      {s.phase === 'studying' && (
        <button type="button" onClick={s.pause} aria-label="Pause"
          className="w-9 h-9 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors">
          <Pause className="w-4 h-4" fill="currentColor" />
        </button>
      )}
      {s.phase === 'paused' && (
        <button type="button" onClick={s.resume} aria-label="Resume"
          className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors">
          <Play className="w-4 h-4" fill="currentColor" />
        </button>
      )}
      {canStop && (
        <button type="button" onClick={onStop} disabled={s.saving}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-destructive/10 text-destructive border border-destructive/30 text-xs font-medium hover:bg-destructive/20 disabled:opacity-50 transition-colors">
          {s.saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" fill="currentColor" />}
          Stop &amp; save
        </button>
      )}
      {s.running && (
        <button type="button" onClick={() => s.setShowMusic(!s.showMusic)} aria-label="Music"
          className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${s.showMusic ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
          <Music className="w-4 h-4" />
        </button>
      )}
    </div>
  );

  const intervalSettings = (s.phase === 'studying' || s.phase === 'paused') && s.mode === 'pomodoro' && (
    <div className="flex items-center gap-3 text-xs">
      <label className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Study</span>
        <select value={s.studyMinutes} onChange={(e) => s.setStudyMinutes(Number(e.target.value))}
          className="px-2 py-1 rounded-lg border border-input bg-card text-xs">
          {[15, 20, 25, 30, 45, 50].map((m) => <option key={m} value={m}>{m}m</option>)}
        </select>
      </label>
      <label className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Break</span>
        <select value={s.breakMinutes} onChange={(e) => s.setBreakMinutes(Number(e.target.value))}
          className="px-2 py-1 rounded-lg border border-input bg-card text-xs">
          {[3, 5, 10, 15].map((m) => <option key={m} value={m}>{m}m</option>)}
        </select>
      </label>
    </div>
  );

  const modeToggle = (s.phase === 'studying' || s.phase === 'paused') && (
    <div className="flex gap-1 bg-muted rounded-lg p-0.5">
      {['pomodoro', 'simple'].map((m) => (
        <button key={m} type="button" onClick={() => s.setMode(m)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${s.mode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
          {m === 'pomodoro' ? 'Pomodoro' : 'Simple'}
        </button>
      ))}
    </div>
  );

  const overlays = (
    <>
      {s.showMusic && <MusicPlayer onClose={() => s.setShowMusic(false)} />}

      {/* Interval end. The voice prompt asks the same two questions; this is
          the same answer for anyone not talking to their laptop. */}
      {s.awaitingConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 glass">
          <div className="bg-card rounded-2xl border border-border p-8 max-w-sm text-center animate-fade-in mx-4 max-h-[90dvh] overflow-y-auto">
            <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7 text-amber-600" />
            </div>
            <h3 className="font-heading text-lg font-semibold mb-2">Study interval complete</h3>
            <p className="text-sm text-muted-foreground mb-6">Say &ldquo;break&rdquo; to take a break, or &ldquo;keep going&rdquo; to continue studying.</p>
            <div className="flex gap-2">
              <button onClick={s.takeBreak}
                className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 text-sm font-medium hover:bg-emerald-500/20">
                Take break
              </button>
              <button onClick={s.keepGoing}
                className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
                Keep going
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saved — offer the review. Unchanged in substance from Focus Mode. */}
      {s.phase === 'review_prompt' && !showReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 glass">
          <div className="bg-card rounded-2xl border border-border p-8 max-w-sm text-center animate-fade-in mx-4 max-h-[90dvh] overflow-y-auto">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="font-heading text-lg font-semibold mb-2">Session saved</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {Math.floor(t.studySeconds / 60)} minutes studied
              {s.openedLectureIds.length > 0 && ` · ${s.openedLectureIds.length} lecture${s.openedLectureIds.length === 1 ? '' : 's'} marked reviewed`}.
              {' '}Want a quick review to test what stuck?
            </p>
            <div className="space-y-2">
              <button onClick={() => setShowReview(true)}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 flex items-center justify-center gap-2">
                <Brain className="w-4 h-4" /> Start review
              </button>
              <button onClick={() => { s.reset(); navigate('/analytics'); }}
                className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1.5">
                <BarChart3 className="w-4 h-4" /> Skip &mdash; go to Analytics
              </button>
            </div>
          </div>
        </div>
      )}

      {showReview && (
        <SessionReview
          classId={s.classId}
          className={s.cls?.name}
          lectureIds={s.lectureIds.length > 0 ? s.lectureIds : undefined}
          studyRecordId={s.savedRecordId}
          onClose={() => { setShowReview(false); s.reset(); navigate('/analytics'); }}
        />
      )}

      {/* A project session ends on its own question: does it need more time? */}
      {s.phase === 'project_end' && (
        <ProjectSessionEndModal
          assignmentId={s.session?.assignment_id}
          onClose={() => { s.reset(); navigate('/study'); }}
        />
      )}
    </>
  );

  if (variant === 'full') {
    return (
      <div className={`flex flex-col items-center ${className}`}>
        <div className="w-full max-w-xs mb-6">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span className="font-medium">{Math.floor(t.studySeconds / 60)} min studied</span>
            <span>{s.goalMinutes} min goal</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${t.goalProgress * 100}%` }} />
          </div>
          {s.cycles > 0 && <p className="text-[10px] text-muted-foreground mt-1 text-center">{s.cycles} cycle{s.cycles !== 1 ? 's' : ''} completed</p>}
        </div>
        <div className="mb-6">{ring(256)}</div>
        {modeToggle && <div className="mb-4">{modeToggle}</div>}
        <div className="mb-3">{controls}</div>
        {intervalSettings}
        {error && <p className="text-sm text-destructive mt-3">{error}</p>}
        {overlays}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-border bg-card p-3 ${className}`}>
      <div className="flex items-center gap-3 flex-wrap">
        {ring(44)}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {s.phase === 'idle' ? 'Study timer' : s.phaseLabel}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {s.phase === 'idle'
              ? `${s.goalMinutes} min goal${s.session ? ' · from your booked session' : ''}`
              : `${Math.floor(t.studySeconds / 60)} of ${s.goalMinutes} min${s.openedLectureIds.length > 0 ? ` · ${s.openedLectureIds.length} opened` : ''}`}
          </p>
        </div>
        {controls}
      </div>
      {(modeToggle || intervalSettings) && (
        <div className="flex items-center gap-3 flex-wrap mt-3 pt-3 border-t border-border/60">
          {modeToggle}
          {intervalSettings}
        </div>
      )}
      {error && <p className="text-sm text-destructive mt-2">{error}</p>}
      {overlays}
    </div>
  );
}
