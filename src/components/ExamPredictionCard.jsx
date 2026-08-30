import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Brain, Loader2, Lightbulb } from 'lucide-react';
import Widget from '@/components/ui/Widget';
import { Lock } from 'lucide-react';
import { useFeatureGate } from '@/components/monetization/useFeatureGate';
import { todayString } from '@/lib/time';

/**
 * Exam topic predictions on the widget grammar (Design Blueprint, Class
 * detail fixes): priority is carried by order and typography — high topics
 * lead, bolder, with an amber marker; medium topics follow, quieter — not by
 * competing rose/amber blocks. The result is cached per class per day in
 * localStorage, so switching to the Practice tab no longer re-runs the AI
 * analysis on every visit (same lectures, same prediction).
 */
const cacheKey = (classId) => `cedar-exampred-${classId}-${todayString()}`;

export default function ExamPredictionCard({ classId }) {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const { allowed, requiredTierName, lock } = useFeatureGate('exam_prediction');

  useEffect(() => {
    if (!classId || !allowed) { setLoading(false); return; }
    let cancelled = false;
    try {
      const cached = localStorage.getItem(cacheKey(classId));
      if (cached) {
        setPrediction(JSON.parse(cached));
        setLoading(false);
        return;
      }
    } catch { /* storage unavailable — fall through to a fresh fetch */ }
    (async () => {
      setLoading(true);
      try {
        const res = await base44.functions.invoke('predictExamTopics', { class_id: classId });
        if (!cancelled) {
          setPrediction(res.data);
          try { localStorage.setItem(cacheKey(classId), JSON.stringify(res.data)); } catch { /* cosmetic */ }
        }
      } catch (e) {
        // Quietly absent — the card simply doesn't render on failure.
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [classId, allowed]);

  // Locked: the grey card with a lock — visible while exploring, one tap to
  // the upgrade sheet, never a dead end (law: paywall is never an error).
  if (!allowed) {
    return (
      <div className="rounded-xl border border-border bg-muted/40 p-4 mb-4 flex items-center gap-3">
        <span className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
          <Brain className="w-4 h-4 text-muted-foreground" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-muted-foreground">Exam topic predictions</p>
          <p className="text-[11px] text-muted-foreground">We read every lecture and predict what your exam will cover. Unlocks with {requiredTierName}.</p>
        </div>
        <button onClick={lock}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-muted-foreground text-xs font-medium hover:text-foreground transition-colors flex-shrink-0">
          <Lock className="w-3.5 h-3.5" /> Upgrade to use
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-1 p-4 mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        Analyzing lecture patterns for exam predictions...
      </div>
    );
  }

  if (!prediction || !prediction.prediction) return null;

  const pred = prediction.prediction;
  const stats = prediction.stats;
  const topics = [
    ...(pred.high_priority || []).map(t => ({ ...t, high: true })),
    ...(pred.medium_priority || []).map(t => ({ ...t, high: false })),
  ];

  return (
    <Widget
      icon={Brain}
      title="Exam topic predictions"
      meta={`${stats.total_lectures} lectures analyzed · ${stats.coverage_percent}% coverage${stats.upcoming_exam ? ` · Exam: ${stats.upcoming_exam}` : ''}`}
      collapsible
      storageKey="exam-pred"
      className="mb-4"
      padded
    >
      <div className="pt-1">
        {pred.summary && (
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{pred.summary}</p>
        )}

        {topics.length > 0 && (
          <div className="space-y-1.5 mb-1">
            {topics.map((t, i) => (
              <div key={i} className="flex items-start gap-2.5 py-1">
                <span className={`w-1.5 h-1.5 rounded-full mt-[7px] flex-shrink-0 ${t.high ? 'bg-amber-500' : 'bg-muted-foreground/40'}`} />
                <div className="min-w-0">
                  <p className={`text-sm text-foreground ${t.high ? 'font-semibold' : 'font-medium'}`}>
                    {t.topic}
                    {t.high && <span className="ml-2 text-[11px] font-semibold text-amber-600 dark:text-amber-500 uppercase tracking-wide">Likely</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{t.reason}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {pred.gaps && pred.gaps.length > 0 && (
          <div className="mt-3 p-2.5 rounded-lg bg-muted/50">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
              <Lightbulb className="w-3 h-3" /> Coverage gaps
            </p>
            <ul className="space-y-0.5">
              {pred.gaps.map((g, i) => (
                <li key={i} className="text-[11px] text-muted-foreground">— {g}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Widget>
  );
}
