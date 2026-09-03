import React, { useState } from 'react';
import { Check, X, ChevronDown, Lightbulb } from 'lucide-react';

/**
 * The results half of every quiz in the app (lecture review, quick quiz,
 * handbook quiz, session review).
 *
 * Leads with what the student got wrong — each miss shows the option they
 * picked, the right one, and the model's one-line explanation of why — then
 * folds the correct answers away under a toggle. That order is the product
 * rule since 2 Sep 2026: a review exists to surface gaps, so the gaps come
 * first and the confirmations are one tap away.
 *
 * `questions[i]` is the normalized server shape (question, options,
 * correct_answer, explanation, concept); `answers[i]` is what was picked.
 */
export function isChoiceCorrect(question, answer) {
  return !!answer && String(answer).trim().toLowerCase() === String(question?.correct_answer || '').trim().toLowerCase();
}

export function scoreQuiz(questions, answers) {
  const total = questions.length;
  const correct = questions.filter((q, i) => isChoiceCorrect(q, answers[i])).length;
  return { total, correct, pct: total ? Math.round((correct / total) * 100) : 0 };
}

function MissCard({ q, answer, index }) {
  return (
    <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
      <div className="flex items-start gap-2.5">
        <span className="w-6 h-6 rounded-full bg-rose-500/15 text-rose-600 text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{index + 1}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{q.question}</p>
          {q.concept && <p className="text-[11px] text-muted-foreground mt-0.5">{q.concept}</p>}
          <div className="mt-3 space-y-1.5">
            <p className="text-xs flex items-start gap-1.5">
              <X className="w-3.5 h-3.5 text-rose-600 mt-0.5 flex-shrink-0" />
              <span><span className="text-muted-foreground">You picked: </span><span className="text-rose-600 font-medium">{answer || 'nothing'}</span></span>
            </p>
            <p className="text-xs flex items-start gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
              <span><span className="text-muted-foreground">Correct: </span><span className="text-emerald-600 font-medium">{q.correct_answer}</span></span>
            </p>
          </div>
          {q.explanation && (
            <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-card border border-border px-3 py-2">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-foreground/85 leading-relaxed">{q.explanation}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HitRow({ q, index }) {
  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 flex items-start gap-2">
      <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-foreground">{index + 1}. {q.question}</p>
        <p className="text-[11px] text-emerald-700 dark:text-emerald-500 mt-0.5">{q.correct_answer}</p>
      </div>
    </div>
  );
}

export default function QuizReview({ questions, answers, className = '' }) {
  const [showCorrect, setShowCorrect] = useState(false);
  const missed = [];
  const hit = [];
  questions.forEach((q, i) => {
    (isChoiceCorrect(q, answers[i]) ? hit : missed).push({ q, i });
  });

  return (
    <div className={className}>
      {missed.length > 0 ? (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">What you got wrong</h3>
            <span className="text-[11px] font-medium text-rose-600">{missed.length} to revisit</span>
          </div>
          <div className="space-y-3">
            {missed.map(({ q, i }) => <MissCard key={i} q={q} answer={answers[i]} index={i} />)}
          </div>
        </div>
      ) : (
        <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-500">Nothing missed — every answer was right.</p>
          <p className="text-xs text-muted-foreground mt-1">Come back to this material in a few days to make it stick.</p>
        </div>
      )}

      {hit.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowCorrect((v) => !v)}
            aria-expanded={showCorrect}
            className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground py-1.5"
          >
            <span>{hit.length} answered correctly</span>
            <ChevronDown className={`w-4 h-4 transition-transform duration-standard ${showCorrect ? 'rotate-180' : ''}`} />
          </button>
          {showCorrect && (
            <div className="space-y-2 mt-2">
              {hit.map(({ q, i }) => <HitRow key={i} q={q} index={i} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** The one option list every quiz screen renders — no free-text fallback. */
export function ChoiceOptions({ question, value, onChange, compact = false }) {
  const options = Array.isArray(question?.options) ? question.options : [];
  return (
    <div className="space-y-2" role="radiogroup" aria-label="Answer options">
      {options.map((opt, i) => {
        const selected = value === opt;
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt)}
            className={`w-full text-left ${compact ? 'px-4 py-2.5 rounded-lg' : 'px-4 py-3 rounded-xl'} border text-sm transition-all flex items-start gap-3 ${
              selected ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border bg-card text-foreground hover:border-primary/30'
            }`}
          >
            <span className={`w-5 h-5 rounded-full border text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5 ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'}`}>
              {String.fromCharCode(65 + i)}
            </span>
            <span>{opt}</span>
          </button>
        );
      })}
    </div>
  );
}
