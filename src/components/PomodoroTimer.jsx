import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Coffee, Brain, Check } from 'lucide-react';

const DEFAULT_STUDY_MIN = 25;
const DEFAULT_BREAK_MIN = 5;

export default function PomodoroTimer({ onSessionEnd }) {
  const [studyMinutes, setStudyMinutes] = useState(DEFAULT_STUDY_MIN);
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK_MIN);
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_STUDY_MIN * 60);
  const [phase, setPhase] = useState('idle'); // idle, studying, break, ended
  const [cycles, setCycles] = useState(0);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const intervalRef = useRef(null);

  const speak = useCallback((text) => {
    window.dispatchEvent(new CustomEvent('cedar-speak', { detail: { text } }));
  }, []);

  const askVoice = useCallback((question) => {
    return new Promise((resolve) => {
      window.dispatchEvent(new CustomEvent('cedar-voice-prompt', {
        detail: {
          question,
          onResponse: (response) => resolve(response),
        },
      }));
      // Fallback timeout — default to "keep going" after 15 seconds
      setTimeout(() => resolve('timeout'), 15000);
    });
  }, []);

  useEffect(() => {
    if (phase === 'studying' || phase === 'break') {
      intervalRef.current = setInterval(() => {
        setSecondsLeft(s => s - 1);
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [phase]);

  // Handle reaching zero
  useEffect(() => {
    if (secondsLeft > 0 || awaitingConfirm) return;

    if (phase === 'studying') {
      setPhase('ended');
      setAwaitingConfirm(true);
      (async () => {
        speak(`You just reached the end of your ${studyMinutes} minute study interval. Do you want to take a break or keep going?`);
        const response = await askVoice('break or keep going');
        setAwaitingConfirm(false);

        if (response.includes('break')) {
          setPhase('break');
          setSecondsLeft(breakMinutes * 60);
          speak(`Taking a ${breakMinutes} minute break. Enjoy.`);
        } else {
          // Keep going — restart study interval
          setPhase('studying');
          setSecondsLeft(studyMinutes * 60);
          setCycles(c => c + 1);
          speak('Alright, keeping going. You have got this.');
        }
      })();
    } else if (phase === 'break') {
      setPhase('studying');
      setSecondsLeft(studyMinutes * 60);
      setCycles(c => c + 1);
      speak('Break is over. Ready to study? Starting your next interval.');
    }
  }, [secondsLeft, phase, awaitingConfirm, studyMinutes, breakMinutes, cycles, speak, askVoice]);

  // Listen for voice commands
  useEffect(() => {
    const handler = (e) => {
      const { action } = e.detail;
      if (action === 'start' && phase === 'idle') {
        startStudying();
      } else if (action === 'pause' && phase === 'studying') {
        setPhase('paused');
        speak('Timer paused.');
      } else if (action === 'resume' && phase === 'paused') {
        setPhase('studying');
      } else if (action === 'break' && phase === 'studying') {
        setSecondsLeft(0);
      } else if (action === 'end') {
        handleEnd();
      }
    };
    window.addEventListener('cedar-pomodoro', handler);
    return () => window.removeEventListener('cedar-pomodoro', handler);
  });

  const startStudying = () => {
    setPhase('studying');
    setSecondsLeft(studyMinutes * 60);
    speak(`Starting a ${studyMinutes} minute study interval.`);
  };

  const handleEnd = () => {
    setPhase('idle');
    setSecondsLeft(studyMinutes * 60);
    setCycles(0);
    onSessionEnd?.();
  };

  const formatTime = (s) => {
    const m = Math.floor(Math.max(0, s) / 60);
    const sec = Math.max(0, s) % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const totalSeconds = (phase === 'break' ? breakMinutes : studyMinutes) * 60;
  const progress = totalSeconds > 0 ? 1 - secondsLeft / totalSeconds : 0;

  const phaseConfig = {
    idle: { label: 'Ready to Study', icon: Brain, color: 'hsl(var(--primary))' },
    studying: { label: 'Studying', icon: Brain, color: 'hsl(var(--primary))' },
    paused: { label: 'Paused', icon: Pause, color: 'hsl(var(--muted-foreground))' },
    break: { label: 'On Break', icon: Coffee, color: '#10B981' },
    ended: { label: 'Interval Complete', icon: Check, color: '#F59E0B' },
  };

  const cfg = phaseConfig[phase] || phaseConfig.idle;
  const Icon = cfg.icon;

  return (
    <div className="flex flex-col items-center">
      {/* Phase badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card mb-4">
        <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
        <span className="text-xs font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
        {cycles > 0 && <span className="text-[10px] text-muted-foreground">• {cycles} cycles</span>}
      </div>

      {/* Timer ring */}
      <div className="relative w-64 h-64 mb-6">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="90" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
          <circle cx="100" cy="100" r="90" fill="none" stroke={cfg.color} strokeWidth="6"
            strokeLinecap="round" strokeDasharray={2 * Math.PI * 90}
            strokeDashoffset={2 * Math.PI * 90 * (1 - progress)}
            style={{ transition: 'stroke-dashoffset 1s linear' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="font-heading text-4xl font-bold tabular-nums text-foreground">{formatTime(secondsLeft)}</p>
          <p className="text-xs text-muted-foreground mt-1">{phase === 'break' ? 'Break time' : 'Study time'}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-6">
        {phase === 'idle' && (
          <button onClick={startStudying}
            className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 shadow-lg transition-colors">
            <Play className="w-6 h-6 ml-0.5" fill="currentColor" />
          </button>
        )}
        {phase === 'studying' && (
          <button onClick={() => setPhase('paused')}
            className="w-14 h-14 rounded-full bg-card border-2 border-primary text-primary flex items-center justify-center hover:bg-primary/10 transition-colors">
            <Pause className="w-6 h-6" fill="currentColor" />
          </button>
        )}
        {phase === 'paused' && (
          <button onClick={() => setPhase('studying')}
            className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 shadow-lg transition-colors">
            <Play className="w-6 h-6 ml-0.5" fill="currentColor" />
          </button>
        )}
        {phase !== 'idle' && (
          <button onClick={handleEnd}
            className="w-14 h-14 rounded-full bg-destructive/10 text-destructive border-2 border-destructive/30 flex items-center justify-center hover:bg-destructive/20 transition-colors">
            <Check className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Interval settings — only when idle */}
      {phase === 'idle' && (
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">Study</span>
            <select value={studyMinutes} onChange={e => { setStudyMinutes(Number(e.target.value)); setSecondsLeft(Number(e.target.value) * 60); }}
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

      {awaitingConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 glass">
          <div className="bg-card rounded-2xl border border-border p-8 max-w-sm text-center animate-fade-in">
            <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7 text-amber-600" />
            </div>
            <h3 className="font-heading text-lg font-semibold mb-2">Study Interval Complete</h3>
            <p className="text-sm text-muted-foreground mb-6">Say "break" to take a break, or "keep going" to continue studying.</p>
            <div className="flex gap-2">
              <button onClick={() => {
                setAwaitingConfirm(false);
                setPhase('break');
                setSecondsLeft(breakMinutes * 60);
                speak(`Taking a ${breakMinutes} minute break.`);
              }} className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 text-sm font-medium hover:bg-emerald-500/20">
                Take Break
              </button>
              <button onClick={() => {
                setAwaitingConfirm(false);
                setPhase('studying');
                setSecondsLeft(studyMinutes * 60);
                setCycles(c => c + 1);
                speak('Keeping going. You have got this.');
              }} className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
                Keep Going
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}