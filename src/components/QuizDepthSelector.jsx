import React, { useState } from 'react';
import { Zap, BookOpen, Brain, Settings2 } from 'lucide-react';

export const QUIZ_PRESETS = [
  { key: 'quick', label: 'Quick', count: 5, icon: Zap, desc: '5 questions' },
  { key: 'standard', label: 'Standard', count: 10, icon: BookOpen, desc: '10 questions' },
  { key: 'deep', label: 'Deep', count: 15, icon: Brain, desc: '15 questions' },
];

export default function QuizDepthSelector({ value, onChange }) {
  const [custom, setCustom] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const selectedPreset = QUIZ_PRESETS.find(p => p.key === value);
  const isCustom = value && !QUIZ_PRESETS.find(p => p.key === value);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-muted-foreground">Quiz Depth</p>
        <button
          onClick={() => setShowCustom(!showCustom)}
          className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md transition-colors ${
            isCustom || showCustom
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Settings2 className="w-3 h-3" /> Custom
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {QUIZ_PRESETS.map(preset => {
          const Icon = preset.icon;
          const isActive = value === preset.key;
          return (
            <button
              key={preset.key}
              onClick={() => { onChange(preset.key); setShowCustom(false); }}
              className={`rounded-xl border p-2.5 text-center transition-all ${
                isActive
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/30'
              }`}
            >
              <Icon className="w-4 h-4 mx-auto mb-1" strokeWidth={isActive ? 2.5 : 2} />
              <p className="text-[10px] font-medium">{preset.label}</p>
              <p className="text-[9px] text-muted-foreground">{preset.desc}</p>
            </button>
          );
        })}
      </div>

      {showCustom && (
        <div className="flex items-center gap-2 mt-2 animate-fade-in">
          <input
            type="number"
            min={1}
            max={30}
            value={custom}
            onChange={e => {
              const v = e.target.value;
              setCustom(v);
              const n = parseInt(v);
              if (n >= 1 && n <= 30) {
                onChange(n);
              }
            }}
            placeholder="Number of questions (1-30)"
            className="flex-1 px-3 py-2 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            autoFocus
          />
          <span className="text-xs text-muted-foreground">questions</span>
        </div>
      )}

      {isCustom && !showCustom && (
        <p className="text-[10px] text-primary font-medium">Custom: {value} questions</p>
      )}
    </div>
  );
}