import React, { useState } from 'react';
import { getSetting, setSetting } from '@/lib/settings';
import { Plus, X, Clock } from 'lucide-react';

export default function ReviewScheduleSection() {
  const [times, setTimes] = useState(getSetting('reviewTimes') || []);
  const [newTime, setNewTime] = useState('');

  const addTime = () => {
    if (!newTime) return;
    const updated = [...times, newTime].sort();
    setTimes(updated);
    setSetting('reviewTimes', updated);
    setNewTime('');
  };

  const removeTime = (t) => {
    const updated = times.filter(x => x !== t);
    setTimes(updated);
    setSetting('reviewTimes', updated);
  };

  const formatDisplay = (t) => {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${dh}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">Set preferred times for daily lecture reviews. We’ll remind you to review your lectures at these times.</p>

      {times.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {times.map(t => (
            <span key={t} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-sm">
              <Clock className="w-3 h-3 text-primary" />
              {formatDisplay(t)}
              <button onClick={() => removeTime(t)} className="ml-1 text-muted-foreground hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="time"
          value={newTime}
          onChange={e => setNewTime(e.target.value)}
          className="px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          onClick={addTime}
          disabled={!newTime}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Add Time
        </button>
      </div>

      {times.length === 0 && (
        <p className="text-xs text-muted-foreground mt-2">No review times set. Add a time to get daily review reminders.</p>
      )}
    </div>
  );
}