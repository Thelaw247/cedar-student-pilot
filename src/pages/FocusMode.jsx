import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { X, Music, Play, Pause, Square, Brain, Check, BarChart3, Loader2, Clock } from 'lucide-react';
import MusicPlayer from '@/components/MusicPlayer';
// AI Study Chat is WITHDRAWN pending a per-message price and a working
// implementation. The component is left on disk — re-add the import plus the
// toggle button and render block below to bring it back.
// import AIStudyChat from '@/components/AIStudyChat';
import SessionReview from '@/components/SessionReview';
import FocusSessionWizard from '@/components/FocusSessionWizard';
import HandbookReader from '@/components/HandbookReader';
import ManualStudyGuide from '@/components/ManualStudyGuide';
import ProjectSessionEndModal from '@/components/ProjectSessionEndModal';

const STUDY_MODES = {
  deep: { goal: 90, study: 25, break: 5 },
  sprint: { goal: 45, study: 15, break: 3 },
  review: { goal: 30, study: 20, break: 5 },
};

export default function FocusMode() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const lectureIdParam = searchParams.get('lectureId');
  const classIdParam = searchParams.get('classId');

  const [mode, setMode] = useState('pomodoro');
  const [phase, setPhase] = useState('idle');
  const [studySeconds, setStudySeconds] = useState(0);
  const [intervalSecondsLeft, setIntervalSecondsLeft] = useState(0);
  const [pomodoroPhase, setPomodoroPhase] = useState('study');
  const [cycles, setCycles] = useState(0);
  const [studyMinutes, setStudyMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [showMusic, setShowMusic] = useState(false);
  const [session, setSession] = useState(null);
  const [cls, setCls] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [aiInteractions, setAiInteractions] = useState([]);
  const [showReview, setShowReview] = useState(false);
  const [savedRecordId, setSavedRecordId] = useState(null);
  const [studyMode, setStudyMode] = useState('deep');
  const [showPreReview, setShowPreReview] = useState(false);
  const [selectedLectureIds, setSelectedLectureIds] = useState([]);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardClassId, setWizardClassId] = useState(null); // class chosen inside the wizard when none preloaded
  const [studyType, setStudyType] = useState(null); // 'in_app' | 'manual'
  const [showHandbook, setShowHandbook] = useState(false);
  const [showManualGuide, setShowManualGuide] = useState(false);
  const [examAssignmentId, setExamAssignmentId] = useState(null);
  const [quizResult, setQuizResult] = useState(null);
  const [lecturesCovered, setLecturesCovered] = useState(0);
  const [totalLectures, setTotalLectures] = useState(0);
  const [isProjectSession, setIsProjectSession] = useState(false);
  const [projectAssignment, setProjectAssignment] = useState(null);

  // Refs for timer tick (avoid stale closures)
  const phaseRef = useRef('idle');
  const studySecondsRef = useRef(0);
  const intervalLeftRef = useRef(0);
  const modeRef = useRef('pomodoro');
  const awaitingConfirmRef = useRef(false);
  const studyMinutesRef = useRef(25);
  const breakMinutesRef = useRef(5);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { studySecondsRef.current = studySeconds; }, [studySeconds]);
  useEffect(() => { intervalLeftRef.current = intervalSecondsLeft; }, [intervalSecondsLeft]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { awaitingConfirmRef.current = awaitingConfirm; }, [awaitingConfirm]);
  useEffect(() => { studyMinutesRef.current = studyMinutes; }, [studyMinutes]);
  useEffect(() => { breakMinutesRef.current = breakMinutes; }, [breakMinutes]);

  const GOAL_MINUTES = STUDY_MODES[studyMode].goal;
  const goalSeconds = GOAL_MINUTES * 60;
  const goalProgress = Math.min(studySeconds / goalSeconds, 1);

  // Load session or lecture context
  useEffect(() => {
    if (sessionId) {
      base44.entities.StudySession.get(sessionId).then(s => {
        setSession(s);
        if (s.class_id) base44.entities.Class.get(s.class_id).then(setCls);
        if (s.session_type === 'project') {
          setIsProjectSession(true);
          if (s.assignment_id) {
            base44.entities.Assignment.get(s.assignment_id).then(setProjectAssignment).catch(() => {});
          }
        }
      }).catch(() => {});
    } else if (classIdParam) {
      base44.entities.Class.get(classIdParam).then(setCls).catch(() => {});
    }
    if (lectureIdParam) {
      setSelectedLectureIds([lectureIdParam]);
      setStudyMode('review');
      // Opened from a lecture — jump straight into the guided setup, pre-seeded
      // with this lecture and a review goal.
      setTimeout(() => setShowWizard(true), 300);
    }
  }, [sessionId, classIdParam, lectureIdParam]);

  const speak = useCallback((text) => {
    window.dispatchEvent(new CustomEvent('cedar-speak', { detail: { text } }));
  }, []);

  const askVoice = useCallback((question) => {
    return new Promise((resolve) => {
      window.dispatchEvent(new CustomEvent('cedar-voice-prompt', {
        detail: { question, onResponse: (response) => resolve(response) },
      }));
      setTimeout(() => resolve('timeout'), 15000);
    });
  }, []);

  // Timer tick
  useEffect(() => {
    if (phase !== 'studying' && phase !== 'break') return;

    const interval = setInterval(() => {
      if (awaitingConfirmRef.current) return;

      if (phaseRef.current === 'studying') {
        const newStudySeconds = studySecondsRef.current + 1;
        studySecondsRef.current = newStudySeconds;
        setStudySeconds(newStudySeconds);

        // Check goal completion
        if (newStudySeconds >= goalSeconds) {
          setPhase('complete');
          speak(`Congratulations! You have completed ${GOAL_MINUTES} minutes of study time. Great work today.`);
          return;
        }

        // Check pomodoro interval end
        if (modeRef.current === 'pomodoro') {
          const newIntervalLeft = intervalLeftRef.current - 1;
          intervalLeftRef.current = newIntervalLeft;
          setIntervalSecondsLeft(newIntervalLeft);

          if (newIntervalLeft <= 0) {
            awaitingConfirmRef.current = true;
            setAwaitingConfirm(true);
            setPhase('ended');
          }
        }
      } else if (phaseRef.current === 'break' && modeRef.current === 'pomodoro') {
        const newIntervalLeft = intervalLeftRef.current - 1;
        intervalLeftRef.current = newIntervalLeft;
        setIntervalSecondsLeft(newIntervalLeft);

        if (newIntervalLeft <= 0) {
          setPomodoroPhase('study');
          setPhase('studying');
          const secs = studyMinutesRef.current * 60;
          intervalLeftRef.current = secs;
          setIntervalSecondsLeft(secs);
          setCycles(c => c + 1);
          speak('Break is over. Starting your next study interval.');
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, goalSeconds, speak]);

  // Handle awaiting confirmation (pomodoro interval end)
  useEffect(() => {
    if (!awaitingConfirm || phase !== 'ended') return;

    let cancelled = false;
    (async () => {
      speak(`You just completed a ${studyMinutes} minute study interval. Do you want to take a break or keep going?`);
      const response = await askVoice('break or keep going');
      if (cancelled) return;

      setAwaitingConfirm(false);
      awaitingConfirmRef.current = false;

      if (response.includes('break')) {
        setPomodoroPhase('break');
        setPhase('break');
        const secs = breakMinutes * 60;
        intervalLeftRef.current = secs;
        setIntervalSecondsLeft(secs);
        speak(`Taking a ${breakMinutes} minute break. Enjoy.`);
      } else {
        setPomodoroPhase('study');
        setPhase('studying');
        const secs = studyMinutes * 60;
        intervalLeftRef.current = secs;
        setIntervalSecondsLeft(secs);
        setCycles(c => c + 1);
        speak('Alright, keeping going. You have got this.');
      }
    })();

    return () => { cancelled = true; };
  }, [awaitingConfirm, phase, studyMinutes, breakMinutes, speak, askVoice]);

  const handleWizardComplete = ({ classId: gClassId, studyMode: gMode, studyType: gType, lectureIds, examAssignmentId: exId }) => {
    const preset = STUDY_MODES[gMode] || STUDY_MODES.deep;
    // Ensure downstream surfaces (handbook / manual guide) have a class to work
    // with when the wizard picked one that wasn't preloaded.
    if (gClassId && !cls) {
      setWizardClassId(gClassId);
      base44.entities.Class.get(gClassId).then(setCls).catch(() => {});
    }
    setStudyMode(gMode);
    setStudyMinutes(preset.study);
    setBreakMinutes(preset.break);
    studyMinutesRef.current = preset.study;
    breakMinutesRef.current = preset.break;
    setStudyType(gType);
    setSelectedLectureIds(lectureIds || []);
    setExamAssignmentId(exId || null);
    setShowWizard(false);

    if (gType === 'in_app') setShowHandbook(true);
    else setShowManualGuide(true);

    // Kick off the timer with the freshly derived interval length.
    if (mode === 'pomodoro') {
      setPomodoroPhase('study');
      const secs = preset.study * 60;
      intervalLeftRef.current = secs;
      setIntervalSecondsLeft(secs);
    }
    setPhase('studying');
    speak(mode === 'pomodoro' ? `Starting a ${preset.study} minute study interval.` : 'Starting your study session.');
  };

  const startStudying = () => {
    if (mode === 'pomodoro') {
      setPomodoroPhase('study');
      const secs = studyMinutes * 60;
      intervalLeftRef.current = secs;
      setIntervalSecondsLeft(secs);
    }
    setPhase('studying');
    speak(mode === 'pomodoro' ? `Starting a ${studyMinutes} minute study interval.` : 'Starting your study session.');
  };

  const pause = () => {
    setPhase('paused');
    speak('Timer paused.');
  };

  const resume = () => {
    setPhase('studying');
  };

  // Switch mode — preserves accumulated study time
  const handleModeChange = (newMode) => {
    if (mode === newMode) return;

    // If on break in pomodoro and switching to simple, resume studying
    if (phase === 'break') {
      setPhase('studying');
    }

    // If switching to pomodoro while studying/paused, start a fresh interval
    if (newMode === 'pomodoro' && (phase === 'studying' || phase === 'paused')) {
      setPomodoroPhase('study');
      const secs = studyMinutes * 60;
      intervalLeftRef.current = secs;
      setIntervalSecondsLeft(secs);
    }

    setMode(newMode);
  };

  // Stop & save to analytics — offers review
  const handleStop = async () => {
    if (studySeconds < 1) {
      navigate(session ? '/planner' : '/');
      return;
    }
    setSaving(true);
    try {
      const record = await base44.entities.StudyRecord.create({
        duration_seconds: studySeconds,
        date: new Date().toISOString().split('T')[0],
        class_id: session?.class_id || null,
        mode,
        cycles_completed: cycles,
        goal_minutes: GOAL_MINUTES,
        study_type: studyType || 'manual',
        study_mode: studyMode,
        lectures_covered: lecturesCovered,
        total_lectures: totalLectures,
        quiz_score: quizResult?.pct,
        quiz_questions_count: quizResult?.total,
        topics_reviewed: selectedLectureIds.length > 0 ? selectedLectureIds : undefined,
      });
      setSavedRecordId(record.id);
      if (session && session.status === 'scheduled') {
        await base44.entities.StudySession.update(session.id, { status: 'completed' });
      }
      if (isProjectSession) {
        setPhase('project_end');
      } else {
        setPhase('review_prompt');
      }
    } catch (e) {
      setSaving(false);
      alert('Could not save your session. Please try again.');
    }
    setSaving(false);
  };

  // Cancel without saving
  const handleCancel = () => {
    navigate(session ? '/planner' : '/');
  };

  // Voice commands
  useEffect(() => {
    const handler = (e) => {
      const { action } = e.detail;
      if (action === 'start' && phaseRef.current === 'idle') startStudying();
      else if (action === 'pause' && phaseRef.current === 'studying') pause();
      else if (action === 'resume' && phaseRef.current === 'paused') resume();
      else if (action === 'break' && phaseRef.current === 'studying' && modeRef.current === 'pomodoro') {
        const secs = breakMinutesRef.current * 60;
        setPomodoroPhase('break');
        setPhase('break');
        intervalLeftRef.current = secs;
        setIntervalSecondsLeft(secs);
        speak('Taking a break now.');
      }
      else if (action === 'end') handleStop();
    };
    window.addEventListener('cedar-pomodoro', handler);
    return () => window.removeEventListener('cedar-pomodoro', handler);
  });

  const formatTime = (s) => {
    const m = Math.floor(Math.max(0, s) / 60);
    const sec = Math.max(0, s) % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // Timer ring calculations
  const intervalTotal = (pomodoroPhase === 'break' ? breakMinutes : studyMinutes) * 60;
  const intervalProgress = intervalTotal > 0 ? 1 - Math.max(0, intervalSecondsLeft) / intervalTotal : 0;
  const ringProgress = mode === 'pomodoro' ? intervalProgress : goalProgress;
  const ringColor = phase === 'break' ? '#10B981' : phase === 'complete' ? '#F59E0B' : 'hsl(var(--primary))';
  const displayTime = mode === 'pomodoro' ? formatTime(intervalSecondsLeft) : formatTime(studySeconds);

  const phaseLabels = {
    idle: 'Ready to Study',
    studying: mode === 'pomodoro' ? (pomodoroPhase === 'break' ? 'On Break' : 'Studying') : 'Studying',
    paused: 'Paused',
    break: 'On Break',
    ended: 'Interval Complete',
    complete: 'Goal Complete!',
  };

  const showModeToggle = phase === 'studying' || phase === 'paused';
  const showControls = phase !== 'ended';

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 animate-fade-in relative">
      <button onClick={handleCancel}
        className="absolute top-6 left-6 w-10 h-10 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors z-10">
        <X className="w-5 h-5" />
      </button>

      <div className="absolute top-6 right-6 z-10">
        <button onClick={() => setShowMusic(!showMusic)}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${showMusic ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}>
          <Music className="w-4 h-4" /> Music
        </button>
      </div>

      {cls && <p className="text-sm text-muted-foreground mb-1">{cls.name}</p>}
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-6">
        {session ? 'Study Session' : 'Focus Session'}
      </p>

      {/* The deep/sprint/review selection now lives in the guided wizard,
          launched from the Start button below. */}

      {/* Project step info — shown for project sessions */}
      {phase === 'idle' && isProjectSession && projectAssignment && (() => {
        const stepIdx = session?.roadmap_step_index;
        const step = (stepIdx !== undefined && stepIdx !== null && stepIdx >= 0 && projectAssignment.roadmap?.[stepIdx]) || null;
        if (!step) return (
          <div className="text-center mb-6">
            <p className="text-sm text-muted-foreground">Additional project work session</p>
          </div>
        );
        return (
          <div className="text-center mb-6 max-w-sm">
            <p className="text-[10px] text-primary font-semibold uppercase tracking-widest mb-1">
              Step {(stepIdx || 0) + 1} of {projectAssignment.roadmap?.length || 0}
            </p>
            <h3 className="font-heading text-lg font-semibold mb-1">{step.title}</h3>
            <p className="text-sm text-muted-foreground mb-2">{step.description}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Clock className="w-3 h-3" /> Est. {step.estimated_minutes || 60} min
            </p>
          </div>
        );
      })()}

      {/* Mode toggle */}
      {showModeToggle && (
        <div className="flex gap-1 mb-8 bg-muted rounded-lg p-1">
          <button onClick={() => handleModeChange('pomodoro')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'pomodoro' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
            Pomodoro
          </button>
          <button onClick={() => handleModeChange('simple')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'simple' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
            Simple Timer
          </button>
        </div>
      )}

      {/* Goal progress bar */}
      <div className="w-full max-w-xs mb-8">
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span className="font-medium">{Math.floor(studySeconds / 60)} min studied</span>
          <span>{GOAL_MINUTES} min goal</span>
        </div>
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-1000"
            style={{ width: `${goalProgress * 100}%` }} />
        </div>
        {cycles > 0 && (
          <p className="text-[10px] text-muted-foreground mt-1 text-center">{cycles} cycle{cycles !== 1 ? 's' : ''} completed</p>
        )}
      </div>

      {/* Timer ring */}
      <div className="relative w-64 h-64 mb-6">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="90" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
          <circle cx="100" cy="100" r="90" fill="none" stroke={ringColor} strokeWidth="6"
            strokeLinecap="round" strokeDasharray={2 * Math.PI * 90}
            strokeDashoffset={2 * Math.PI * 90 * (1 - ringProgress)}
            style={{ transition: 'stroke-dashoffset 1s linear' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="font-heading text-4xl font-bold tabular-nums text-foreground">{displayTime}</p>
          <p className="text-xs text-muted-foreground mt-1">{phaseLabels[phase] || ''}</p>
        </div>
      </div>

      {/* Timer controls */}
      {showControls && (
        <div className="flex items-center gap-3 mb-4">
          {phase === 'idle' && isProjectSession && (
            <button onClick={startStudying}
              className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 shadow-lg transition-colors">
              <Play className="w-6 h-6 ml-0.5" fill="currentColor" />
            </button>
          )}
          {phase === 'studying' && (
            <button onClick={pause}
              className="w-14 h-14 rounded-full bg-card border-2 border-primary text-primary flex items-center justify-center hover:bg-primary/10 transition-colors">
              <Pause className="w-6 h-6" fill="currentColor" />
            </button>
          )}
          {phase === 'paused' && (
            <button onClick={resume}
              className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 shadow-lg transition-colors">
              <Play className="w-6 h-6 ml-0.5" fill="currentColor" />
            </button>
          )}
          {(phase === 'studying' || phase === 'paused' || phase === 'break' || phase === 'complete') && (
            <button onClick={handleStop} disabled={saving}
              className="w-14 h-14 rounded-full bg-destructive/10 text-destructive border-2 border-destructive/30 flex items-center justify-center hover:bg-destructive/20 transition-colors disabled:opacity-50">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Square className="w-5 h-5" fill="currentColor" />}
            </button>
          )}
        </div>
      )}

      {/* Stop & Save text button */}
      {(phase !== 'idle' || studySeconds > 0) && phase !== 'ended' && (
        <button onClick={handleStop} disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 text-destructive border border-destructive/30 text-sm font-medium hover:bg-destructive/20 disabled:opacity-50 mb-4">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
          Stop & Save to Analytics
        </button>
      )}

      {/* Start working — project session */}
      {phase === 'idle' && isProjectSession && (
        <button onClick={startStudying}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors mb-4">
          <Play className="w-4 h-4" fill="currentColor" /> Start Working
        </button>
      )}

      {/* Start a focus session — opens the guided wizard which asks a couple of
          plain questions and sets everything up. */}
      {phase === 'idle' && !isProjectSession && (
        <button
          onClick={() => setShowWizard(true)}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors mb-4"
        >
          <Brain className="w-4 h-4" /> Start Focus Session
        </button>
      )}

      {/* Interval settings - available while a pomodoro session is running */}
      {(phase === 'studying' || phase === 'paused') && mode === 'pomodoro' && (
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">Study</span>
            <select value={studyMinutes} onChange={e => setStudyMinutes(Number(e.target.value))}
              className="px-2 py-1 rounded-lg border border-input bg-card text-sm">
              {[15, 20, 25, 30, 45, 50].map(m => <option key={m} value={m}>{m}m</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">Break</span>
            <select value={breakMinutes} onChange={e => setBreakMinutes(Number(e.target.value))}
              className="px-2 py-1 rounded-lg border border-input bg-card text-sm">
              {[3, 5, 10, 15].map(m => <option key={m} value={m}>{m}m</option>)}
            </select>
          </label>
        </div>
      )}

      {/* Complete state */}
      {phase === 'complete' && (
        <p className="text-sm text-muted-foreground text-center max-w-xs mb-4">
          🎉 You reached your {GOAL_MINUTES}-minute study goal! Tap stop to save your session.
        </p>
      )}

      {/* Awaiting confirm modal */}
      {awaitingConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 glass">
          <div className="bg-card rounded-2xl border border-border p-8 max-w-sm text-center animate-fade-in mx-4">
            <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7 text-amber-600" />
            </div>
            <h3 className="font-heading text-lg font-semibold mb-2">Study Interval Complete</h3>
            <p className="text-sm text-muted-foreground mb-6">Say "break" to take a break, or "keep going" to continue studying.</p>
            <div className="flex gap-2">
              <button onClick={() => {
                setAwaitingConfirm(false);
                awaitingConfirmRef.current = false;
                setPomodoroPhase('break');
                setPhase('break');
                const secs = breakMinutes * 60;
                intervalLeftRef.current = secs;
                setIntervalSecondsLeft(secs);
                speak(`Taking a ${breakMinutes} minute break.`);
              }} className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 text-sm font-medium hover:bg-emerald-500/20">
                Take Break
              </button>
              <button onClick={() => {
                setAwaitingConfirm(false);
                awaitingConfirmRef.current = false;
                setPomodoroPhase('study');
                setPhase('studying');
                const secs = studyMinutes * 60;
                intervalLeftRef.current = secs;
                setIntervalSecondsLeft(secs);
                setCycles(c => c + 1);
                speak('Keeping going. You have got this.');
              }} className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
                Keep Going
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Study Chat toggle — WITHDRAWN. AIStudyChat called
          Core.InvokeLLM directly from the browser, which bypassed every
          credit gate and billed the shared Base44 integration pool with no
          usage logging. Restore only once the chat is metered server-side.
      {phase !== 'idle' && phase !== 'review_prompt' && (
        <button onClick={() => setShowChat(!showChat)}
          className={`fixed bottom-4 right-4 z-30 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-colors ${
            showChat ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'
          }`}>
          <MessageCircle className="w-5 h-5" />
          {aiInteractions.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
              {aiInteractions.length}
            </span>
          )}
        </button>
      )}
      */}

      {/* AI Study Chat — WITHDRAWN, see note on the toggle above.
      {showChat && phase !== 'review_prompt' && (
        <AIStudyChat
          classId={session?.class_id}
          className={cls?.name}
          onInteractionsChange={setAiInteractions}
        />
      )}
      */}

      {/* Music player */}
      {showMusic && <MusicPlayer onClose={() => setShowMusic(false)} />}

      {/* Review prompt after stopping */}
      {phase === 'review_prompt' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 glass">
          <div className="bg-card rounded-2xl border border-border p-8 max-w-sm text-center animate-fade-in mx-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="font-heading text-lg font-semibold mb-2">Session Saved!</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {Math.floor(studySeconds / 60)} minutes studied. Would you like to do a quick review to test your knowledge?
            </p>
            <div className="space-y-2">
              <button onClick={() => setShowReview(true)}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 flex items-center justify-center gap-2">
                <Brain className="w-4 h-4" /> Start Review Session
              </button>
              <button onClick={() => navigate('/analytics')}
                className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground">
                Skip — Go to Analytics
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-session lecture review */}
      {showPreReview && (
        <SessionReview
          classId={session?.class_id || cls?.id}
          className={cls?.name}
          onClose={() => setShowPreReview(false)}
        />
      )}

      {/* Guided focus-session setup */}
      {showWizard && (
        <FocusSessionWizard
          initialClassId={session?.class_id || cls?.id || classIdParam || null}
          initialLectureIds={selectedLectureIds}
          onComplete={handleWizardComplete}
          onCancel={() => setShowWizard(false)}
        />
      )}

      {/* Handbook reader (in-app study) */}
      {showHandbook && (session?.class_id || cls?.id || wizardClassId) && (
        <HandbookReader
          classId={session?.class_id || cls?.id || wizardClassId}
          lectureIds={selectedLectureIds.length > 0 ? selectedLectureIds : undefined}
          assignmentId={studyMode === 'sprint' ? examAssignmentId : undefined}
          studyMode={studyMode}
          onClose={() => setShowHandbook(false)}
          onQuizComplete={(result) => {
            setQuizResult(result);
            setLecturesCovered(result.lecturesCovered || 0);
            setTotalLectures(result.totalLectures || 0);
          }}
        />
      )}

      {/* Manual study guide (paper study) */}
      {showManualGuide && (session?.class_id || cls?.id || wizardClassId) && (
        <ManualStudyGuide
          classId={session?.class_id || cls?.id || wizardClassId}
          studyMode={studyMode}
          lectureIds={selectedLectureIds.length > 0 ? selectedLectureIds : undefined}
          assignmentId={studyMode === 'sprint' ? examAssignmentId : undefined}
          onClose={() => setShowManualGuide(false)}
          onLoad={(count) => setTotalLectures(count)}
        />
      )}

      {/* Project session end — ask if more time needed */}
      {phase === 'project_end' && (
        <ProjectSessionEndModal
          assignmentId={session?.assignment_id}
          onClose={() => navigate('/planner')}
        />
      )}

      {/* Full review flow */}
      {showReview && (
        <SessionReview
          classId={session?.class_id || cls?.id}
          className={cls?.name}
          lectureIds={selectedLectureIds.length > 0 ? selectedLectureIds : undefined}
          studyRecordId={savedRecordId}
          aiInteractions={aiInteractions}
          onClose={() => navigate('/analytics')}
        />
      )}
    </div>
  );
}
