import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Play, Pause, Square, Music, X, Brain, Volume2 } from 'lucide-react';

const tracks = [
  { title: 'Bach — Cello Suite No. 1', composer: 'Bach', videoId: '1prweTlAqV4' },
  { title: 'Chopin — Nocturne Op. 9 No. 2', composer: 'Chopin', videoId: 't28PhBSqsZo' },
  { title: 'Debussy — Clair de Lune', composer: 'Debussy', videoId: 'ZIsQP4wOJ9c' },
  { title: 'Mozart — Piano Concerto No. 21', composer: 'Mozart', videoId: 'tDQt5q9N7Cs' },
  { title: 'Beethoven — Moonlight Sonata', composer: 'Beethoven', videoId: '4Tr0otuiQuU' },
];

export default function FocusMode() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [session, setSession] = useState(null);
  const [cls, setCls] = useState(null);
  const [targetMinutes, setTargetMinutes] = useState(25);
  const [activeTrack, setActiveTrack] = useState(0);
  const [showMusic, setShowMusic] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (sessionId) {
      base44.entities.StudySession.get(sessionId).then(s => {
        setSession(s);
        if (s.duration_minutes) setTargetMinutes(s.duration_minutes);
        if (s.class_id) base44.entities.Class.get(s.class_id).then(setCls);
      }).catch(() => {});
    }
  }, [sessionId]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const targetSeconds = targetMinutes * 60;
  const progress = Math.min(seconds / targetSeconds, 1);
  const remaining = Math.max(0, targetSeconds - seconds);

  const formatTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const endSession = async () => {
    if (session && session.status === 'scheduled') {
      try {
        await base44.entities.StudySession.update(session.id, { status: 'completed' });
      } catch (e) { console.error(e); }
    }
    navigate(session ? '/planner' : '/');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 animate-fade-in relative">
      <button onClick={() => navigate(session ? '/planner' : '/')}
        className="absolute top-6 left-6 w-10 h-10 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
        <X className="w-5 h-5" />
      </button>

      <div className="absolute top-6 right-6">
        <button onClick={() => setShowMusic(!showMusic)}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${showMusic ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground'}`}>
          <Music className="w-4 h-4" /> Music
        </button>
      </div>

      {cls && (
        <p className="text-sm text-muted-foreground mb-2">{cls.name}</p>
      )}
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-8">
        {session ? 'Study Session' : 'Focus Session'}
      </p>

      {/* Timer ring */}
      <div className="relative w-72 h-72 mb-8">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="90" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
          <circle cx="100" cy="100" r="90" fill="none" stroke="hsl(var(--primary))" strokeWidth="6"
            strokeLinecap="round" strokeDasharray={2 * Math.PI * 90}
            strokeDashoffset={2 * Math.PI * 90 * (1 - progress)}
            style={{ transition: 'stroke-dashoffset 1s linear' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="font-heading text-5xl font-bold tabular-nums text-foreground">
            {formatTime(running || seconds > 0 ? seconds : targetSeconds)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {seconds >= targetSeconds ? 'Complete!' : `${Math.floor(remaining / 60)}m ${remaining % 60}s left`}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-8">
        {!running ? (
          <button onClick={() => setRunning(true)}
            className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors shadow-lg">
            <Play className="w-7 h-7 ml-1" fill="currentColor" />
          </button>
        ) : (
          <button onClick={() => setRunning(false)}
            className="w-16 h-16 rounded-full bg-card border-2 border-primary text-primary flex items-center justify-center hover:bg-primary/10 transition-colors">
            <Pause className="w-7 h-7" fill="currentColor" />
          </button>
        )}
        <button onClick={endSession}
          className="w-16 h-16 rounded-full bg-destructive/10 text-destructive border-2 border-destructive/30 flex items-center justify-center hover:bg-destructive/20 transition-colors">
          <Square className="w-6 h-6" fill="currentColor" />
        </button>
      </div>

      {/* Duration presets */}
      {seconds === 0 && !running && (
        <div className="flex gap-2">
          {[15, 25, 45, 60].map(m => (
            <button key={m} onClick={() => { setTargetMinutes(m); setSeconds(0); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${targetMinutes === m ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}>
              {m}m
            </button>
          ))}
        </div>
      )}

      {/* Music player */}
      {showMusic && (
        <div className="fixed bottom-6 right-6 w-80 max-w-[calc(100vw-3rem)] rounded-2xl border border-border bg-card p-4 shadow-xl animate-fade-in z-50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">Classical Music</h3>
            </div>
            <button onClick={() => setShowMusic(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-1.5 flex-wrap mb-3">
            {tracks.map((t, i) => (
              <button key={i} onClick={() => setActiveTrack(i)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${activeTrack === i ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {t.composer}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mb-2">{tracks[activeTrack].title}</p>
          <iframe
            key={tracks[activeTrack].videoId}
            className="w-full rounded-lg"
            height="80"
            src={`https://www.youtube.com/embed/${tracks[activeTrack].videoId}?autoplay=1&controls=1`}
            title={tracks[activeTrack].title}
            frameBorder="0"
            allow="autoplay; encrypted-media"
          />
        </div>
      )}
    </div>
  );
}