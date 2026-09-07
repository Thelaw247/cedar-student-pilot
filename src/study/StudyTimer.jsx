import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, Square, Music, Loader2, Check, Brain, X } from 'lucide-react';
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
 *   strip  above the study tabs — a progress ring, the time, the controls
 *   full   the project session screen — the big ring it has always had
 *
 * Session completion lives here rather than on either page: the save prompt,
 * the review offer, the project end. It moved with the engine so there is
 * exactly one place a finished session is handled, whichever screen it was
 * started from.
 *
 * THE TIME IS NOT INSIDE THE SMALL RING. It was, and 25:00 at a legible size
 * does not fit a 44px circle — the digits touched the stroke on both sides.
 * The ring is a progress indicator, which is a job it can do at any size; the
 * clock is a number, and a number needs room. The big ring on the project
 * screen keeps its centred time, because there the space is real.
 */

/** The lengths a sitting can be set to, before it starts and while it runs. */
const GOAL_CHOICES = [15, 25, 30, 45, 60, 90, 120];
const STUDY_CHOICES = [15, 20, 25, 30, 45, 50];
const BREAK_CHOICES = [3, 5, 10, 15];

/**
 * One labelled setting.
 *
 * Defined at module scope on purpose. StudyTimer subscribes to the tick, so it
 * re-renders every second; a component declared inside its body would be a new
 * type on every one of those renders, and React would unmount and remount the
 * <select> — closing the dropdown the moment a student opened it.
 */
function Field({ label, value, choices, onChange, suffix = 'm', note = null }) {
  return (
    <label className="flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground whitespace-nowrap">{label}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="px-2 py-1 rounded-lg border border-input bg-card text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40">
        {choices.map((m) => <option key={m} value={m}>{m}{suffix}</option>)}
      </select>
      {note && <span className="text-[10px] text-muted-foreground">{note}</span>}
    </label>
  );
}

export default function StudyTimer({ variant = 'strip', className = '' }) {
  const s = useStudySession();
  const t = useStudyTick();
  const navigate = useNavigate();
  const [error, setError] = React.useState(null);
  const [showReview, setShowReview] = React.useState(false);
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);

  const onStop = async () => {
    setError(null);
    setConfirmDiscard(false); // answering the other question closes this one
    const res = await s.stop();
    if (!res.ok) setError(res.error);
  };

  const canStop = s.phase === 'studying' || s.phase === 'paused' || s.phase === 'break' || s.phase === 'complete';
  // Cancelling a minute you never sat needs no ceremony; cancelling forty does.
  const askBeforeDiscard = t.studySeconds >= 60;
  const onDiscard = () => {
    if (askBeforeDiscard && !confirmDiscard) { setConfirmDiscard(true); return; }
    setConfirmDiscard(false);
    setError(null);
    s.discard();
  };

  /** Progress only — see the note above about why nothing is written inside. */
  const ring = (size, withTime) => (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r="90" fill="none" stroke="hsl(var(--muted))" strokeWidth={withTime ? 6 : 10} />
        <circle cx="100" cy="100" r="90" fill="none" stroke={s.ringColor} strokeWidth={withTime ? 6 : 10}
          strokeLinecap="round" strokeDasharray={2 * Math.PI * 90}
          strokeDashoffset={2 * Math.PI * 90 * (1 - t.ringProgress)}
          style={{ transition: 'stroke-dashoffset 1s linear' }} />
      </svg>
      {withTime && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="font-heading text-4xl font-bold tabular-nums text-foreground">{t.displayTime}</p>
          <p className="text-xs text-muted-foreground mt-1">{s.phaseLabel}</p>
        </div>
      )}
    </div>
  );

  const controls = (
    <div className="flex items-center gap-2 flex-shrink-0">
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
        <>
          <button type="button" onClick={onStop} disabled={s.saving}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {s.saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" fill="currentColor" />}
            Stop &amp; save
          </button>
          {/* The way out that does not become a row in Analytics. Stop & save
              was the only exit, so a mistaken tap on Start had to be recorded
              as a session the student never sat. */}
          <button type="button" onClick={onDiscard} disabled={s.saving}
            aria-label="Cancel this session without saving"
            title="Cancel without saving"
            className="w-9 h-9 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30 flex items-center justify-center transition-colors disabled:opacity-50">
            <X className="w-4 h-4" />
          </button>
        </>
      )}
      <button type="button" onClick={() => s.setShowMusic(!s.showMusic)} aria-label="Music"
        className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${s.showMusic ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
        <Music className="w-4 h-4" />
      </button>
    </div>
  );

  /**
   * Every setting, at every phase.
   *
   * These used to appear only once the clock was running, so the one moment a
   * student wants to say "give me twenty-five minutes on this" — before
   * starting — was the one moment they could not. The values are the same
   * either way; changing them mid-session already worked.
   */
  const settings = (
    <div className="flex items-center gap-x-3 gap-y-2 flex-wrap">
      <div className="flex gap-1 bg-muted rounded-lg p-0.5">
        {['pomodoro', 'simple'].map((m) => (
          <button key={m} type="button" onClick={() => s.setMode(m)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${s.mode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {m === 'pomodoro' ? 'Pomodoro' : 'Simple'}
          </button>
        ))}
      </div>
      <Field
        label="Session" value={s.goalMinutes} choices={GOAL_CHOICES} onChange={s.setGoalMinutes}
        note={s.goalFromSession ? 'from your booked session' : null}
      />
      {s.mode === 'pomodoro' && (
        <>
          <Field label="Study" value={s.studyMinutes} choices={STUDY_CHOICES} onChange={s.setStudyMinutes} />
          <Field label="Break" value={s.breakMinutes} choices={BREAK_CHOICES} onChange={s.setBreakMinutes} />
        </>
      )}
    </div>
  );

  const discardConfirm = confirmDiscard && (
    <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-2 flex-wrap">
      <p className="text-xs text-muted-foreground flex-1 min-w-[12rem]">
        Discard {Math.floor(t.studySeconds / 60)} minute{Math.floor(t.studySeconds / 60) === 1 ? '' : 's'}? It will not be saved to Analytics.
      </p>
      <button type="button" onClick={() => setConfirmDiscard(false)}
        className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted">
        Keep going
      </button>
      <button type="button" onClick={onDiscard}
        className="px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive border border-destructive/30 text-xs font-medium hover:bg-destructive/20">
        Discard
      </button>
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

      {/* Saved. One question — do you want the review? — and the answer "no"
          leaves you exactly where you were.
          It used to offer "Skip — go to Analytics", so finishing a session
          took you off the page you were studying on, every single time, to a
          dashboard nobody asked for. Analytics is a tab; it can wait. */}
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
                <Brain className="w-4 h-4" /> Review what I studied
              </button>
              <button onClick={() => s.reset()}
                className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground">
                No thanks
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
          onClose={() => { setShowReview(false); s.reset(); }}
        />
      )}

      {/* A project session ends on its own question: does it need more time?
          Its screen has nothing left to show once it is answered. */}
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
            <span className="font-medium tabular-nums">{Math.floor(t.studySeconds / 60)} min studied</span>
            <span className="tabular-nums">{s.goalMinutes} min goal</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${t.goalProgress * 100}%` }} />
          </div>
          {s.cycles > 0 && <p className="text-[10px] text-muted-foreground mt-1 text-center tabular-nums">{s.cycles} cycle{s.cycles !== 1 ? 's' : ''} completed</p>}
        </div>
        <div className="mb-6">{ring(256, true)}</div>
        <div className="mb-4">{controls}</div>
        {settings}
        {confirmDiscard && <div className="w-full max-w-sm">{discardConfirm}</div>}
        {error && <p className="text-sm text-destructive mt-3">{error}</p>}
        {overlays}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-border bg-card p-3 ${className}`}>
      <div className="flex items-center gap-3">
        {ring(36, false)}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <p className="font-heading text-2xl font-bold tabular-nums text-foreground leading-none">{t.displayTime}</p>
            <p className="text-xs text-muted-foreground truncate">{s.phase === 'idle' ? 'Study timer' : s.phaseLabel}</p>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
            {Math.floor(t.studySeconds / 60)} of {s.goalMinutes} min
            {s.cycles > 0 && ` · ${s.cycles} cycle${s.cycles === 1 ? '' : 's'}`}
            {s.openedLectureIds.length > 0 && ` · ${s.openedLectureIds.length} opened`}
          </p>
        </div>
        {controls}
      </div>

      <div className="mt-3 pt-3 border-t border-border/60">{settings}</div>
      {discardConfirm}
      {error && <p className="text-sm text-destructive mt-2">{error}</p>}
      {overlays}
    </div>
  );
}
