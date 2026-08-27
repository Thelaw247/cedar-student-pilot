import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Sparkles, CalendarClock, Zap, X, Loader2, Check, Calendar } from 'lucide-react';

export default function RebookSessionModal({ session, className = '', onClose, onRebooked }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState(null); // null = menu, 'ai' | 'manual' | 'done'
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [manualDate, setManualDate] = useState(getTodayString());
  const [manualTime, setManualTime] = useState('19:00');
  const [manualLoading, setManualLoading] = useState(false);
  const [error, setError] = useState(null);

  function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function getCurrentTime() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  const handleAIRebook = async () => {
    setAiLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('rebookStudySession', { session_id: session.id });
      setAiResult(res.data);
      setMode('done');
      onRebooked?.();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Could not rebook. Try again.');
    }
    setAiLoading(false);
  };

  const handleManualRebook = async () => {
    setManualLoading(true);
    setError(null);
    try {
      await base44.entities.StudySession.update(session.id, {
        scheduled_date: manualDate,
        scheduled_time: manualTime,
        status: 'scheduled',
      });
      setMode('done');
      onRebooked?.();
    } catch (e) {
      setError(e?.message || 'Could not update session.');
    }
    setManualLoading(false);
  };

  const handleStartNow = async () => {
    setManualLoading(true);
    setError(null);
    try {
      const today = getTodayString();
      const nowTime = getCurrentTime();
      await base44.entities.StudySession.update(session.id, {
        scheduled_date: today,
        scheduled_time: nowTime,
        status: 'scheduled',
      });
      onRebooked?.();
      onClose();
      navigate(`/focus/${session.id}`);
    } catch (e) {
      setError(e?.message || 'Could not start session.');
      setManualLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 glass" onClick={onClose}>
      <div className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border p-6 animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-heading text-lg font-semibold">Rebook Study Session</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        {className && <p className="text-sm text-muted-foreground mb-4">{className}</p>}
        {!className && <div className="mb-4" />}

        {/* Original session info */}
        <div className="rounded-lg bg-muted/50 px-3 py-2 mb-5 flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Was: {session.scheduled_date}{session.scheduled_time ? ` at ${session.scheduled_time}` : ''}</span>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 mb-4 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* Menu */}
        {mode === null && (
          <div className="space-y-2.5">
            <button onClick={handleAIRebook} disabled={aiLoading}
              className="w-full flex items-center gap-3 rounded-xl border border-border p-3.5 hover:border-primary/30 hover:bg-primary/5 transition-all text-left disabled:opacity-60">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                {aiLoading ? <Loader2 className="w-5 h-5 text-primary animate-spin" /> : <Sparkles className="w-5 h-5 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">AI Smart Rebook</p>
                <p className="text-xs text-muted-foreground">Let AI find the best time based on your schedule</p>
              </div>
            </button>

            <button onClick={() => setMode('manual')}
              className="w-full flex items-center gap-3 rounded-xl border border-border p-3.5 hover:border-primary/30 hover:bg-primary/5 transition-all text-left">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <CalendarClock className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Choose a Time</p>
                <p className="text-xs text-muted-foreground">Pick a date and time yourself</p>
              </div>
            </button>

            <button onClick={handleStartNow} disabled={manualLoading}
              className="w-full flex items-center gap-3 rounded-xl border border-border p-3.5 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all text-left disabled:opacity-60">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                {manualLoading ? <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" /> : <Zap className="w-5 h-5 text-emerald-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Start Now</p>
                <p className="text-xs text-muted-foreground">Rebook to right now & start studying</p>
              </div>
            </button>
          </div>
        )}

        {/* Manual date/time picker */}
        {mode === 'manual' && (
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground mb-1.5 block">New Date</span>
              <input type="date" value={manualDate} min={getTodayString()}
                onChange={e => setManualDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground mb-1.5 block">New Time</span>
              <input type="time" value={manualTime}
                onChange={e => setManualTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </label>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setMode(null)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted">
                Back
              </button>
              <button onClick={handleManualRebook} disabled={manualLoading || !manualDate}
                className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                {manualLoading ? 'Saving...' : 'Rebook'}
              </button>
            </div>
          </div>
        )}

        {/* Done state (AI or manual) */}
        {mode === 'done' && aiResult && (
          <div className="text-center py-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              Rebooked to {aiResult.new_date} at {aiResult.new_time}
            </p>
            {aiResult.reason && (
              <p className="text-xs text-muted-foreground mb-4">{aiResult.reason}</p>
            )}
            <button onClick={onClose}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
              Done
            </button>
          </div>
        )}

        {mode === 'done' && !aiResult && (
          <div className="text-center py-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-foreground mb-4">Session rebooked!</p>
            <button onClick={onClose}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
