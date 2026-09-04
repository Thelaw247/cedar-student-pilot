import React from 'react';
import { ListChecks, BookOpen, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * One question asked in one place: quiz or handbook?
 *
 * "Review" used to mean two different things depending on which button you
 * pressed. Review this week ran a quiz; the same word inside a focus session
 * opened the handbook. Both are legitimate ways to review — the mistake was
 * deciding for the student. Every entry point now lands on /lecture-review,
 * which asks first, so the word means the same thing everywhere.
 *
 * The answer is carried in the URL (?mode=), so a choice is bookmarkable and
 * a deep link that already knows the answer skips this screen entirely.
 */
export default function ReviewModeChooser({ subtitle, onSelect, backTo = '/planner' }) {
  return (
    <div className="max-w-md mx-auto px-4 py-10 animate-fade-in">
      <Link to={backTo} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ChevronLeft className="w-4 h-4" /> Back
      </Link>
      <h1 className="font-heading text-xl font-bold text-foreground mb-1">How do you want to review?</h1>
      <p className="text-sm text-muted-foreground mb-6">{subtitle}</p>

      <div className="space-y-3">
        <ModeOption
          icon={ListChecks} tint="primary"
          title="Quiz me"
          desc="Multiple-choice questions in your professor's teaching order. Best for finding the gaps."
          onClick={() => onSelect('quiz')}
        />
        <ModeOption
          icon={BookOpen} tint="amber"
          title="Read the handbook"
          desc="Your lectures written up as chapters, with a quiz waiting at the end of each one."
          onClick={() => onSelect('handbook')}
        />
      </div>
    </div>
  );
}

function ModeOption({ icon: Icon, title, desc, onClick, tint }) {
  const tints = {
    primary: 'bg-primary/10 text-primary group-hover:bg-primary/20',
    amber: 'bg-amber-500/10 text-amber-600 group-hover:bg-amber-500/20',
  };
  return (
    <button type="button" onClick={onClick}
      className="w-full rounded-xl border border-border bg-card p-4 text-left group hover:border-primary/30 hover:shadow-2 transition-all duration-micro">
      <div className="flex items-start gap-3">
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${tints[tint]}`}>
          <Icon className="w-5 h-5" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-foreground">{title}</span>
          <span className="block text-xs text-muted-foreground mt-0.5">{desc}</span>
        </span>
      </div>
    </button>
  );
}
