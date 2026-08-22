import React, { useState } from 'react';
import { getSetting, setSetting } from '@/lib/settings';
import { Check, Zap, Clock, TrendingDown } from 'lucide-react';

const OPTIONS = [
  { key: 'fast', icon: Zap, label: 'Fast', subtitle: 'Decays in 1–2 weeks' },
  { key: 'default', icon: Clock, label: 'Default', subtitle: 'Decays in 2–4 weeks' },
  { key: 'slow', icon: TrendingDown, label: 'Slow', subtitle: 'Decays in 3–6 weeks' },
];

export default function ConceptDecaySettings() {
  const [rate, setRate] = useState(getSetting('conceptDecayRate') || 'default');

  const handleChange = (key) => {
    setRate(key);
    setSetting('conceptDecayRate', key);
  };

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <p className="text-sm font-medium text-foreground mb-1">Concept Decay Rate</p>
      <p className="text-xs text-muted-foreground mb-3">
        How quickly your lecture proficiency fades when you haven't reviewed. Older lectures decay faster.
      </p>
      <div className="space-y-2">
        {OPTIONS.map(opt => {
          const selected = rate === opt.key;
          const Icon = opt.icon;
          return (
            <button
              key={opt.key}
              onClick={() => handleChange(opt.key)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/20'
              }`}
            >
              <Icon className={`w-4 h-4 ${selected ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className="text-left flex-1">
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.subtitle}</p>
              </div>
              {selected && <Check className="w-4 h-4 text-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
