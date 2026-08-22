import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, Flame, TrendingDown, BookX, CalendarClock, ChevronRight, X } from 'lucide-react';
import { isDismissedToday, dismissToday } from '@/lib/dismiss';

const riskIcons = {
  missed_lectures: BookX,
  low_engagement: TrendingDown,
  no_study_planned: CalendarClock,
  low_proficiency: AlertTriangle,
  behind_schedule: CalendarClock,
};

const severityColors = {
  high: 'border-rose-500/30 bg-rose-500/5 text-rose-600',
  medium: 'border-amber-500/30 bg-amber-500/5 text-amber-600',
  low: 'border-blue-500/30 bg-blue-500/5 text-blue-600',
};

// Each risk routes to the existing tool that resolves it — no new screens.
// missed_lectures → Classes (each class's study tools generate missed-lecture
// summaries); the planner handles scheduling, rescheduling, and review.
const riskActions = {
  missed_lectures: { label: 'View classes', to: '/classes' },
  low_engagement: { label: 'Plan a study session', to: '/planner?tab=plan' },
  no_study_planned: { label: 'Generate study plan', to: '/planner?tab=plan' },
  low_proficiency: { label: 'Review weak topics', to: '/planner?tab=practice' },
  behind_schedule: { label: 'Reschedule my plan', to: '/planner?tab=plan' },
};
const fallbackAction = { label: 'Open study planner', to: '/planner' };

export default function RiskIndicatorCard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  // Dismissed keys (per-day — see lib/dismiss). A dismissed risk that's still
  // true tomorrow comes back; dismissing never permanently silences a real
  // problem, since that would defeat the point of a risk alert.
  const [dismissed, setDismissed] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await base44.functions.invoke('detectAcademicRisk', {});
        if (!cancelled) setData(res.data);
      } catch (e) {
        if (!cancelled) console.error(e);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const dismiss = (key) => {
    dismissToday(key);
    setDismissed(prev => new Set([...prev, key]));
  };

  if (loading) return null;

  if (!data || (data.risks.length === 0 && data.burnout_level === 'none')) return null;

  const visibleRisks = data.risks.slice(0, 3).filter((risk, i) => {
    const key = `risk-${risk.type || i}`;
    return !dismissed.has(key) && !isDismissedToday(key);
  });
  const burnoutKey = 'burnout';
  const showBurnout = data.burnout_level !== 'none' && data.burnout_level !== 'low'
    && !dismissed.has(burnoutKey) && !isDismissedToday(burnoutKey);

  if (visibleRisks.length === 0 && !showBurnout) return null;

  return (
    <div className="mb-4 space-y-3">
      {/* Risk warnings */}
      {visibleRisks.map((risk, i) => {
        const key = `risk-${risk.type || i}`;
        const Icon = riskIcons[risk.type] || AlertTriangle;
        const colorClass = severityColors[risk.severity] || severityColors.medium;
        const action = riskActions[risk.type] || fallbackAction;
        return (
          <div key={key} className={`rounded-xl border p-3 ${colorClass}`}>
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-current/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{risk.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{risk.description}</p>
                <button
                  onClick={() => navigate(action.to)}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-current/10 hover:bg-current/20 transition-colors"
                >
                  {action.label} <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <button onClick={() => dismiss(key)} aria-label="Dismiss"
                className="text-current opacity-60 hover:opacity-100 flex-shrink-0 p-1 -m-1">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}

      {/* Burnout indicator */}
      {showBurnout && (
        <div className={`rounded-xl border p-3 ${data.burnout_level === 'high' ? 'border-rose-500/30 bg-rose-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
          <div className="flex items-start gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${data.burnout_level === 'high' ? 'bg-rose-500/10' : 'bg-amber-500/10'}`}>
              <Flame className={`w-4 h-4 ${data.burnout_level === 'high' ? 'text-rose-600' : 'text-amber-600'}`} />
            </div>
            <div className="flex-1">
              <p className={`text-sm font-semibold ${data.burnout_level === 'high' ? 'text-rose-700 dark:text-rose-500' : 'text-amber-700 dark:text-amber-500'}`}>
                {data.burnout_level === 'high' ? 'High Burnout Risk' : 'Moderate Study Load'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{data.burnout_advice}</p>
              <button
                onClick={() => navigate('/planner?tab=plan')}
                className={`mt-2 inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${data.burnout_level === 'high' ? 'text-rose-600 bg-rose-500/10 hover:bg-rose-500/20' : 'text-amber-600 bg-amber-500/10 hover:bg-amber-500/20'}`}
              >
                Rebalance my plan <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <button onClick={() => dismiss(burnoutKey)} aria-label="Dismiss"
              className={`flex-shrink-0 p-1 -m-1 opacity-60 hover:opacity-100 ${data.burnout_level === 'high' ? 'text-rose-600' : 'text-amber-600'}`}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

