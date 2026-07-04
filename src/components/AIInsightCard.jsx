import React from 'react';
import { Sparkles } from 'lucide-react';

/**
 * AI Insight Card — surfaces contextual, intelligent observations throughout the app.
 * confidence: 'high' | 'medium' | 'estimated'
 */
const confidenceConfig = {
  high: { label: 'High Confidence', dot: 'bg-emerald-500', text: 'text-emerald-600' },
  medium: { label: 'Medium Confidence', dot: 'bg-amber-500', text: 'text-amber-600' },
  estimated: { label: 'Estimated Summary', dot: 'bg-muted-foreground', text: 'text-muted-foreground' },
};

export default function AIInsightCard({ insight, confidence = 'high', action }) {
  const conf = confidenceConfig[confidence] || confidenceConfig.high;
  return (
    <div className="rounded-card border border-violet-500/20 bg-gradient-to-b from-violet-500/5 to-transparent p-4 shadow-1">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-violet-500" strokeWidth={1.5} />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-600">Insight</span>
        </div>
        <div className={`flex items-center gap-1 ${conf.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
          <span className="text-[10px] font-medium">{conf.label}</span>
        </div>
      </div>
      <p className="text-sm text-foreground leading-relaxed">{insight}</p>
      {action && (
        <button onClick={action.onClick} className="mt-3 text-xs font-medium text-primary hover:underline">
          {action.label} →
        </button>
      )}
    </div>
  );
}