import React, { useState } from 'react';
import { getSetting, setSetting } from '@/lib/settings';
import { BookOpen, Layers } from 'lucide-react';

export default function LearningModeToggle() {
  const [mode, setMode] = useState(getSetting('learningMode') || 'cumulative');

  const choose = (m) => {
    setMode(m);
    setSetting('learningMode', m);
  };

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">Control how AI study sessions and reviews scope your course content.</p>
      <div className="space-y-2">
        <button onClick={() => choose('cumulative')}
          className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-colors text-left ${mode === 'cumulative' ? 'border-primary bg-primary/5' : 'border-border'}`}>
          <Layers className={`w-5 h-5 mt-0.5 flex-shrink-0 ${mode === 'cumulative' ? 'text-primary' : 'text-muted-foreground'}`} />
          <div className="flex-1">
            <p className="text-sm font-medium">Cumulative Learning</p>
            <p className="text-xs text-muted-foreground">Reviews cover all course content from the start of the semester. Best for comprehensive understanding.</p>
          </div>
          {mode === 'cumulative' && <span className="text-primary text-xs font-medium mt-0.5">✓</span>}
        </button>
        <button onClick={() => choose('isolated')}
          className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-colors text-left ${mode === 'isolated' ? 'border-primary bg-primary/5' : 'border-border'}`}>
          <BookOpen className={`w-5 h-5 mt-0.5 flex-shrink-0 ${mode === 'isolated' ? 'text-primary' : 'text-muted-foreground'}`} />
          <div className="flex-1">
            <p className="text-sm font-medium">Per-Exam Isolated</p>
            <p className="text-xs text-muted-foreground">Reviews only cover content since the last exam. Best for targeted exam preparation.</p>
          </div>
          {mode === 'isolated' && <span className="text-primary text-xs font-medium mt-0.5">✓</span>}
        </button>
      </div>
    </div>
  );
}