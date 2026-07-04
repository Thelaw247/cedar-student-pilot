import React, { useState } from 'react';
import { Check, X, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

export default function QuizViewer({ questions }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);

  if (!questions || questions.length === 0) return null;

  const q = questions[index];
  const isMultipleChoice = q.type === 'multiple_choice' || (q.options && q.options.length > 0);

  const reveal = (optionIdx) => {
    if (revealed) return;
    setSelected(optionIdx);
    setRevealed(true);
    setAnswered(a => a + 1);
    if (isMultipleChoice && optionIdx !== null && q.options[optionIdx] === q.answer) {
      setScore(s => s + 1);
    }
  };

  const next = () => { setIndex((index + 1) % questions.length); setSelected(null); setRevealed(false); };
  const prev = () => { setIndex((index - 1 + questions.length) % questions.length); setSelected(null); setRevealed(false); };
  const reset = () => { setIndex(0); setSelected(null); setRevealed(false); setScore(0); setAnswered(0); };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground tabular-nums">Question {index + 1} / {questions.length}</p>
        {answered > 0 && (
          <p className="text-xs font-medium text-primary">Score: {score}/{answered}</p>
        )}
      </div>

      <h3 className="text-sm font-medium text-foreground mb-4">{q.question}</h3>

      {isMultipleChoice ? (
        <div className="space-y-2 mb-4">
          {q.options.map((opt, i) => {
            const isCorrect = opt === q.answer;
            const isSelected = selected === i;
            let style = 'border-border bg-background hover:border-primary/40';
            if (revealed) {
              if (isCorrect) style = 'border-emerald-500/40 bg-emerald-500/10';
              else if (isSelected) style = 'border-destructive/40 bg-destructive/10';
              else style = 'border-border bg-background opacity-60';
            }
            return (
              <button key={i} onClick={() => reveal(i)} disabled={revealed}
                className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all flex items-center justify-between ${style}`}>
                <span className="text-foreground">{opt}</span>
                {revealed && isCorrect && <Check className="w-4 h-4 text-emerald-600" />}
                {revealed && isSelected && !isCorrect && <X className="w-4 h-4 text-destructive" />}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mb-4">
          {!revealed ? (
            <button onClick={() => reveal(null)}
              className="w-full py-3 rounded-lg border border-primary/30 bg-primary/5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors">
              Reveal Answer
            </button>
          ) : (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
              <p className="text-[10px] text-emerald-600 uppercase tracking-wide mb-1">Answer</p>
              <p className="text-sm text-foreground">{q.answer}</p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button onClick={prev}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>
        {answered === questions.length && (
          <button onClick={reset}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-primary hover:bg-primary/10 transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> Restart
          </button>
        )}
        <button onClick={next}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}