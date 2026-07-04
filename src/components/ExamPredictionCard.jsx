import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Brain, Loader2, AlertTriangle, TrendingUp, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';

export default function ExamPredictionCard({ classId }) {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!classId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await base44.functions.invoke('predictExamTopics', { class_id: classId });
        if (!cancelled) {
          setPrediction(res.data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError('Could not generate predictions.');
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [classId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        Analyzing lecture patterns for exam predictions...
      </div>
    );
  }

  if (error || !prediction || !prediction.prediction) {
    return null;
  }

  const pred = prediction.prediction;
  const stats = prediction.stats;

  return (
    <div className="rounded-xl border border-primary/30 bg-gradient-to-b from-primary/5 to-transparent p-4 mb-4">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Brain className="w-4 h-4 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-foreground">Exam Topic Predictions</h3>
            <p className="text-[11px] text-muted-foreground">
              {stats.total_lectures} lectures analyzed · {stats.coverage_percent}% coverage
              {stats.upcoming_exam && ` · Exam: ${stats.upcoming_exam}`}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="animate-fade-in">
          {pred.summary && (
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{pred.summary}</p>
          )}

          {pred.high_priority && pred.high_priority.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] font-semibold text-rose-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> High Priority Topics
              </p>
              <div className="space-y-1.5">
                {pred.high_priority.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-rose-500/5 border border-rose-500/15">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{t.topic}</p>
                      <p className="text-[11px] text-muted-foreground">{t.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pred.medium_priority && pred.medium_priority.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Medium Priority
              </p>
              <div className="space-y-1">
                {pred.medium_priority.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{t.topic}</p>
                      <p className="text-[11px] text-muted-foreground">{t.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pred.gaps && pred.gaps.length > 0 && (
            <div className="mt-3 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15">
              <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide mb-1 flex items-center gap-1">
                <Lightbulb className="w-3 h-3" /> Coverage Gaps
              </p>
              <ul className="space-y-0.5">
                {pred.gaps.map((g, i) => (
                  <li key={i} className="text-[11px] text-muted-foreground">• {g}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}