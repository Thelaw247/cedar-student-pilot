import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, Loader2, Flame, TrendingDown, BookX, CalendarClock, ChevronRight } from 'lucide-react';

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

export default function RiskIndicatorCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return null;

  if (!data || (data.risks.length === 0 && data.burnout_level === 'none')) return null;

  return (
    <div className="mb-4 space-y-3">
      {/* Risk warnings */}
      {data.risks.slice(0, 3).map((risk, i) => {
        const Icon = riskIcons[risk.type] || AlertTriangle;
        const colorClass = severityColors[risk.severity] || severityColors.medium;
        return (
          <div key={i} className={`rounded-xl border p-3 ${colorClass}`}>
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-current/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{risk.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{risk.description}</p>
                <p className="text-[11px] font-medium mt-1 opacity-80">→ {risk.action}</p>
              </div>
            </div>
          </div>
        );
      })}

      {/* Burnout indicator */}
      {data.burnout_level !== 'none' && data.burnout_level !== 'low' && (
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}