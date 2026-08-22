import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Check, Clock, Trash2, Loader2, AlertTriangle, Calendar } from 'lucide-react';

export default function ProjectSessionEndModal({ assignmentId, onClose }) {
  const [phase, setPhase] = useState('ask'); // ask → time → fitting → scheduled → full → done
  const [minutes, setMinutes] = useState(60);
  const [result, setResult] = useState(null);
  const [deletedIds, setDeletedIds] = useState(new Set());
  const [fitting, setFitting] = useState(false);

  const quickOptions = [30, 60, 90, 120];

  const fitTime = async (mins) => {
    setFitting(true);
    try {
      const res = await base44.functions.invoke('fitProjectTime', {
        assignment_id: assignmentId,
        additional_minutes: mins,
      });
      if (res.data?.error) throw new Error(res.data.error);
      setResult(res.data);
      if (res.data.scheduled) {
        setPhase('scheduled');
      } else {
        setPhase('full');
      }
    } catch (e) {
      alert('Could not schedule additional time. Please try again.');
    }
    setFitting(false);
  };

  const handleDeleteSuggestion = async (suggestion) => {
    try {
      if (suggestion.entity === 'CalendarEvent') {
        await base44.entities.CalendarEvent.delete(suggestion.id);
      } else {
        await base44.entities.StudySession.delete(suggestion.id);
      }
      setDeletedIds(prev => new Set([...prev, suggestion.id]));
    } catch (e) {
      alert('Could not delete event.');
    }
  };

  const retryFit = () => {
    setDeletedIds(new Set());
    fitTime(minutes);
  };

  const priorityColors = {
    low: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    medium: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    high: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 glass p-4">
      <div className="bg-card rounded-2xl border border-border p-6 max-w-md w-full animate-fade-in max-h-[85vh] overflow-y-auto">
        {phase === 'ask' && (
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-heading text-lg font-semibold mb-2">Session Complete!</h3>
            <p className="text-sm text-muted-foreground mb-6">Do you need more time to work on this project?</p>
            <div className="flex gap-2">
              <button onClick={onClose}
                className="flex-1 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted">
                No, I'm Done
              </button>
              <button onClick={() => setPhase('time')}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 flex items-center justify-center gap-2">
                <Clock className="w-4 h-4" /> Yes, Need More Time
              </button>
            </div>
          </div>
        )}

        {phase === 'time' && (
          <div>
            <h3 className="font-heading text-lg font-semibold mb-2">How much more time?</h3>
            <p className="text-sm text-muted-foreground mb-4">The AI will find free time in your schedule before the due date.</p>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {quickOptions.map(m => (
                <button key={m} onClick={() => { setMinutes(m); }}
                  className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${minutes === m ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:bg-muted'}`}>
                  {m}m
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mb-4">
              <input type="number" value={minutes}
                onChange={e => setMinutes(Math.max(15, Number(e.target.value)))}
                className="flex-1 px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              <span className="text-sm text-muted-foreground">minutes</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPhase('ask')}
                className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted">
                Back
              </button>
              <button onClick={() => fitTime(minutes)} disabled={fitting || minutes < 15}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {fitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Finding Free Time...</> : <>Schedule Time</>}
              </button>
            </div>
          </div>
        )}

        {phase === 'scheduled' && (
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="font-heading text-lg font-semibold mb-2">Time Scheduled!</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {result?.sessions_created} additional project session{result?.sessions_created !== 1 ? 's' : ''} added to your schedule.
            </p>
            <button onClick={onClose}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
              Done
            </button>
          </div>
        )}

        {phase === 'full' && (
          <div>
            <div className="flex items-start gap-2 mb-4 rounded-lg bg-amber-500/5 border border-amber-500/30 p-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-500">Schedule is Full</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Only {result?.total_free_minutes || 0} min free, but you need {result?.needed_minutes || minutes} min.
                  Delete some lower-priority events to make room.
                </p>
              </div>
            </div>

            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
              {(result?.suggestions || [])
                .filter(s => !deletedIds.has(s.id))
                .map(s => (
                  <div key={`${s.entity}-${s.id}`} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      {s.entity === 'CalendarEvent' ? <Calendar className="w-4 h-4 text-muted-foreground" /> : <Clock className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-foreground truncate">{s.title}</h4>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{s.date}</span>
                        {s.time && <span>• {s.time}</span>}
                        <span>• {s.duration_minutes}m</span>
                      </div>
                    </div>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border uppercase ${priorityColors[s.priority] || priorityColors.medium}`}>
                      {s.priority}
                    </span>
                    <button onClick={() => handleDeleteSuggestion(s)}
                      className="w-8 h-8 rounded-lg border border-destructive/30 text-destructive flex items-center justify-center hover:bg-destructive/10 transition-colors flex-shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              {(result?.suggestions || []).filter(s => !deletedIds.has(s.id)).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">All suggestions deleted. Try scheduling again.</p>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={onClose}
                className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted">
                Cancel
              </button>
              <button onClick={retryFit} disabled={fitting}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {fitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Retrying...</> : <>Try Scheduling Again</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
