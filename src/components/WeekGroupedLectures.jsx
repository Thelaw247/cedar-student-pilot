import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import LectureItem from '@/components/LectureItem';
import FreshnessBadge from '@/components/FreshnessBadge';
import { getDecayState, getWorstState, DECAY_STATES } from '@/lib/conceptDecay';

function getMondayOfWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setDate(d.getDate() + diff);
  return d;
}

function formatWeekLabel(monday) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `Week of ${months[monday.getMonth()]} ${monday.getDate()}`;
}

export default function WeekGroupedLectures({ lectures, coverageMap, allClassLectures, cls, defaultInstructor, onUpdate, searchQuery }) {
  const [internalExpanded, setInternalExpanded] = useState(new Set());

  // Group lectures by ISO week (Monday of the week)
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

  // Auto-expand if only one week exists
  const autoExpanded = useMemo(() => {
    if (weekGroups.length === 1) return new Set([weekGroups[0][0]]);
    return new Set();
  }, [weekGroups]);

  // When searching, auto-expand weeks that contain matching lectures
  const searchExpanded = useMemo(() => {
    if (!searchQuery?.trim()) return new Set();
    const expanded = new Set();
    const q = searchQuery.toLowerCase();
    for (const [weekKey, group] of weekGroups) {
      const hasMatch = group.lectures.some(l => {
        const fields = [
          l.ai_title || '',
          l.ai_summary || '',
          l.transcript || '',
          (l.ai_concepts || []).join(' '),
          (l.ai_vocabulary || []).join(' '),
          l.date || '',
        ];
        return fields.some(f => f.toLowerCase().includes(q));
      });
      if (hasMatch) expanded.add(weekKey);
    }
    return expanded;
  }, [weekGroups, searchQuery]);

  const isExpanded = (weekKey) => {
    return autoExpanded.has(weekKey) || searchExpanded.has(weekKey) || internalExpanded.has(weekKey);
  };

  const toggleWeek = (weekKey) => {
    const next = new Set(internalExpanded);
    if (next.has(weekKey)) next.delete(weekKey);
    else next.add(weekKey);
    setInternalExpanded(next);
  };

  return (
    <div className="space-y-2">
      {weekGroups.map(([weekKey, group]) => {
        const expanded = isExpanded(weekKey);
        const states = group.lectures.map(l => {
          const cov = coverageMap?.[l.id];
          return getDecayState(cov, allClassLectures, l);
        });
        const aggStateKey = getWorstState(states);
        const aggState = DECAY_STATES[aggStateKey];

        return (
          <div
            key={weekKey}
            className={`rounded-xl border border-border bg-card overflow-hidden transition-all ${expanded ? 'shadow-1' : ''}`}
          >
            <button
              onClick={() => toggleWeek(weekKey)}
              className="w-full flex items-center gap-3 p-3.5 hover:bg-muted/30 transition-colors text-left"
              style={expanded ? { borderLeft: `3px solid ${cls?.color || '#3B82F6'}` } : {}}
            >
              <div className="flex-shrink-0">
                {expanded
                  ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{formatWeekLabel(group.monday)}</p>
                <p className="text-xs text-muted-foreground">
                  {group.lectures.length} lecture{group.lectures.length !== 1 ? 's' : ''}
                </p>
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
              <div className="px-3 pb-3 space-y-2 animate-fade-in">
                {group.lectures.map(l => (
                  <LectureItem
                    key={l.id}
                    lecture={l}
                    defaultInstructor={defaultInstructor}
                    onUpdate={onUpdate}
                    decayState={getDecayState(coverageMap?.[l.id], allClassLectures, l)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}