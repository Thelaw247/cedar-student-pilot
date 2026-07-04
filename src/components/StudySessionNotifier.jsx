import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Headphones, RefreshCw, X, Loader2 } from 'lucide-react';
import { getSetting } from '@/lib/settings';

export default function StudySessionNotifier() {
  const [pendingSession, setPendingSession] = useState(null);
  const [classes, setClasses] = useState([]);
  const [rebooking, setRebooking] = useState(false);
  const [rebookResult, setRebookResult] = useState(null);
  const [dismissed, setDismissed] = useState(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    const check = async () => {
      if (!getSetting('studySessionReminders')) return;
      try {
        const today = new Date().toISOString().split('T')[0];
        const sessions = await base44.entities.StudySession.filter({
          status: 'scheduled',
          scheduled_date: today,
        });

        if (sessions.length === 0) return;

        // Load classes for context
        const semesters = await base44.entities.Semester.filter({ is_active: true });
        if (semesters.length > 0) {
          const cls = await base44.entities.Class.filter({ semester_id: semesters[0].id });
          setClasses(cls);
        }

        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();

        for (const s of sessions) {
          if (dismissed.has(s.id)) continue;
          if (!s.scheduled_time) continue;
          const [h, m] = s.scheduled_time.split(':').map(Number);
          const sessionMin = h * 60 + m;
          const diff = sessionMin - nowMin;

          // Notify if within 5 minutes before or 10 minutes after start
          if (diff <= 5 && diff >= -10) {
            setPendingSession(s);
            return;
          }
        }
      } catch (e) { /* silent */ }
    };

    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, [dismissed]);

  // Re-check when settings change
  useEffect(() => {
    const handler = () => { if (!getSetting('studySessionReminders')) setPendingSession(null); };
    window.addEventListener('cedar-settings-change', handler);
    return () => window.removeEventListener('cedar-settings-change', handler);
  }, []);

  const classMap = Object.fromEntries(classes.map(c => [c.id, c]));

  const handleStudyNow = () => {
    navigate(`/focus/${pendingSession.id}`);
  };

  const handleRebook = async () => {
    setRebooking(true);
    try {
      const result = await base44.functions.invoke('rebookStudySession', {
        session_id: pendingSession.id,
      });
      setRebookResult(result);
    } catch (e) {
      setRebookResult({ error: 'Failed to rebook. Try again later.' });
    }
    setRebooking(false);
  };

  const close = () => {
    setDismissed(prev => new Set([...prev, pendingSession.id]));
    setPendingSession(null);
    setRebookResult(null);
  };

  if (!pendingSession) return null;

  const cls = classMap[pendingSession.class_id];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 glass p-4">
      <div className="bg-card rounded-2xl border border-border p-6 max-w-sm w-full animate-fade-in">
        {rebookResult ? (
          <>
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <RefreshCw className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="font-heading text-lg font-semibold text-center mb-2">Session Rebooked</h3>
            {rebookResult.error ? (
              <p className="text-sm text-destructive text-center mb-4">{rebookResult.error}</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground text-center mb-1">
                  Your study session has been moved to
                </p>
                <p className="font-heading text-base font-semibold text-center mb-1">
                  {new Date(rebookResult.new_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
                <p className="text-sm text-primary text-center font-medium mb-4">
                  {rebookResult.new_time}
                </p>
                {rebookResult.reason && (
                  <p className="text-xs text-muted-foreground text-center mb-4 italic">"{rebookResult.reason}"</p>
                )}
              </>
            )}
            <button onClick={close} className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
              Got it
            </button>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 relative">
              <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping"></span>
              <Headphones className="w-7 h-7 text-primary relative" />
            </div>
            <h3 className="font-heading text-lg font-semibold text-center mb-1">Study Session Starting</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              {cls?.name || 'Study session'} is scheduled to start now{pendingSession.scheduled_time ? ` at ${pendingSession.scheduled_time}` : ''}.
            </p>
            <p className="text-sm text-muted-foreground text-center mb-6">Are you studying now, or should I rebook it?</p>
            <div className="flex flex-col gap-2">
              <button onClick={handleStudyNow}
                className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 flex items-center justify-center gap-2">
                <Headphones className="w-4 h-4" /> Study Now
              </button>
              <button onClick={handleRebook} disabled={rebooking}
                className="w-full px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 flex items-center justify-center gap-2">
                {rebooking ? <><Loader2 className="w-4 h-4 animate-spin" /> Rebooking...</> : <><RefreshCw className="w-4 h-4" /> Rebook with AI</>}
              </button>
              <button onClick={close} className="text-xs text-muted-foreground hover:text-foreground py-1">
                Dismiss
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}