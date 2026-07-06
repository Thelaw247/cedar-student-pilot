import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { X, ChevronDown, ChevronRight, Check, Loader2, Play } from 'lucide-react';
import FreshnessBadge from '@/components/FreshnessBadge';
import { getDecayState, getWorstState, DECAY_STATES } from '@/lib/conceptDecay';

function getMondayOfWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function formatWeekLabel(monday) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `Week of ${months[monday.getMonth()]} ${monday.getDate()}`;
}

export default function LecturePickerSheet({ classId, cls, onStart, onClose }) {
  const [lectures, setLectures] = useState([]);
  const [coverage, setCoverage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [expandedWeeks, setExpandedWeeks] = useState(new Set());

  useEffect(() => {
    const load = async () => {
      try {
        const [lecs, covs] = await Promise.all([
          base44.entities.Lecture.filter({ class_id: classId }, '-date'),
          base44.entities.KnowledgeCoverage.filter({ class_id: classId }),
        ]);
        setLectures(lecs);
        setCoverage(covs);
        // Auto-expand the most recent week
        if (lecs.length > 0) {
          const monday = getMondayOfWeek(lecs[0].date);
          setExpandedWeeks(new Set([monday.toISOString().split('T')[0]]));
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, [classId]);

  const coverageMap = useMemo(() => {
    const map = {};
    for (const c of coverage) {
      if (c.lecture_id) map[c.lecture_id] = c;
    }
    return map;
  }, [coverage]);

  // Group lectures by week
  const weekGroups = useMemo(() => {
    const groups = {};
    for (const l of lectures) {
      const monday = getMondayOfWeek(l.date);
      const key = monday.toISOString().split('T')[0];
      if (!groups[key]) groups[key] = { monday, lectures: [] };
      groups[key].lectures.push(l);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [lectures]);

  const toggleLecture = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleWeek = (key) => {
    const next = new Set(expandedWeeks);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedWeeks(next);
  };

  const handleStart = () => {
    onStart([...selected]);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/30 glass" onClick={onClose}>
      <div
        className="bg-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-border animate-fade-in max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <div>
            <h3 className="font-heading text-base font-semibold">Select Lectures</h3>
            <p className="text-xs text-muted-foreground">
              {selected.size} selected • {cls?.name || 'Class'}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lecture list */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : lectures.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">No lectures recorded for this class yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {weekGroups.map(([weekKey, group]) => {
                const expanded = expandedWeeks.has(weekKey);
                const states = group.lectures.map(l =>
                  getDecayState(coverageMap[l.id], lectures, l)
                );
                const aggKey = getWorstState(states);
                const aggState = DECAY_STATES[aggKey];

                return (
                  <div key={weekKey} className="rounded-xl border border-border overflow-hidden">
                    <button
                      onClick={() => toggleWeek(weekKey)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors text-left"
                    >
                      {expanded
                        ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{formatWeekLabel(group.monday)}</p>
                        <p className="text-xs text-muted-foreground">{group.lectures.length} lecture{group.lectures.length !== 1 ? 's' : ''}</p>
                      </div>
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md"
                        style={{ backgroundColor: aggState.color + '15', color: aggState.color }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: aggState.color }} />
                        {aggState.label}
                      </span>
                    </button>

                    {expanded && (
                      <div className="border-t border-border divide-y divide-border">
                        {group.lectures.map(l => {
                          const decay = getDecayState(coverageMap[l.id], lectures, l);
                          const isSelected = selected.has(l.id);
                          return (
                            <button
                              key={l.id}
                              onClick={() => toggleLecture(l.id)}
                              className={`w-full flex items-center gap-3 p-3 hover:bg-muted/20 transition-colors text-left ${isSelected ? 'bg-primary/5' : ''}`}
                            >
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                isSelected ? 'border-primary bg-primary' : 'border-border'
                              }`}>
                                {isSelected && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {l.ai_title || `Lecture — ${l.date}`}
                                </p>
                                <p className="text-xs text-muted-foreground">{l.date}</p>
                              </div>
                              <FreshnessBadge decayState={decay} />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex-shrink-0">
          <button
            onClick={handleStart}
            disabled={selected.size === 0}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4 fill-current" /> Start Session ({selected.size})
          </button>
        </div>
      </div>
    </div>
  );
}