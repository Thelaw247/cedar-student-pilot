import React from 'react';
import { Brain, BookOpen } from 'lucide-react';

export default function StudyModeSelector({ onSelect, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 glass px-4" onClick={onClose}>
      <div
        className="bg-card w-full max-w-md rounded-2xl border border-border p-6 animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="font-heading text-lg font-semibold mb-1">How will you study?</h3>
        <p className="text-sm text-muted-foreground mb-5">Choose your study method for this session.</p>

        <div className="space-y-3">
          {/* In-App Study */}
          <button
            onClick={() => onSelect('in_app')}
            className="w-full rounded-xl border border-border bg-card p-4 hover:border-primary/30 hover:shadow-2 transition-all text-left group"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Study In-App</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Read through the handbook and test your knowledge with built-in quizzes as you go.
                </p>
              </div>
            </div>
          </button>

          {/* Manual / Paper Study */}
          <button
            onClick={() => onSelect('manual')}
            className="w-full rounded-xl border border-border bg-card p-4 hover:border-primary/30 hover:shadow-2 transition-all text-left group"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-500/20 transition-colors">
                <BookOpen className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Study Manually (Paper)</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Get a study guide with topics and lecture material to review on paper. Timer tracks your session.
                </p>
              </div>
            </div>
          </button>
        </div>

        <button onClick={onClose} className="w-full mt-4 py-2.5 text-sm text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>
    </div>
  );
}