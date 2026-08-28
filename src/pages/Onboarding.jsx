import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, FileText, Layers, CalendarCheck, Check, Loader2, Shield } from 'lucide-react';
import { TIERS, CREDITS_PER_LECTURE } from '@/lib/tiers';
import { startCheckout } from '@/lib/checkout';

/**
 * The onboarding-primed paywall (research series MON-04 §2).
 *
 * Three steps after first signup: the student names their struggle (self-
 * identification — it personalizes everything after and picks the persona),
 * sees Cedar's mechanism answered in their own terms plus honest trust
 * markers, and meets the paywall once, at peak motivation — with a visible,
 * unshamed "Continue with Free" exit, because education converts at midterms,
 * not day zero (28.5% day-0 share, the lowest of any category).
 *
 * Honesty rules embedded here: no invented testimonials or ratings (swap in
 * real ones once they exist), the billed total always beside the per-month
 * framing, and skipping costs nothing. The chosen goal is kept client-side
 * (localStorage) purely to personalize copy — no schema change.
 */
const GOALS = [
  { id: 'fast-prof', icon: Mic, label: 'My prof talks too fast', sub: 'I miss half of what matters in lectures' },
  { id: 'notes', icon: FileText, label: "I can't listen and take notes at once", sub: 'Writing means missing what comes next' },
  { id: 'exams', icon: Layers, label: 'Exams sneak up on me', sub: 'By midterms my notes are a mess' },
  { id: 'organized', icon: CalendarCheck, label: 'Staying organized is the hard part', sub: 'I need the plan made for me' },
];

const PROMISES = {
  'fast-prof': {
    title: 'Never miss a word again',
    lines: ['Record the lecture — Cedar transcribes every word', 'Replay anything at your own speed, with the transcript beside it', 'A clean summary and key concepts, minutes after class ends'],
  },
  notes: {
    title: 'Just listen. Cedar takes the notes.',
    lines: ['Hit record and put the pen down', 'Transcript, summary and action items appear after class', 'Your own quick notes attach to the exact lecture'],
  },
  exams: {
    title: 'Walk into every exam covered',
    lines: ['Every lecture becomes flashcards and practice questions', 'Cedar flags every exam mention your prof drops', 'Exam-topic prediction shows what to study first'],
  },
  organized: {
    title: 'Your semester, already structured',
    lines: ['Import your timetable once — every class scheduled', 'Study sessions planned around your real deadlines', 'One place for lectures, notes, flashcards and plans'],
  },
};

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState(null);
  const [period, setPeriod] = useState('semester');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const finish = (to = '/setup') => {
    try {
      localStorage.setItem('cedar-onboarded', '1');
      if (goal) localStorage.setItem('cedar-goal', goal);
    } catch { /* storage unavailable — cosmetic only */ }
    navigate(to);
  };

  const pickGoal = (id) => {
    setGoal(id);
    try { localStorage.setItem('cedar-goal', id); } catch { /* cosmetic */ }
    setStep(1);
  };

  const buy = async (tierId) => {
    setBusy(tierId);
    setError(null);
    try {
      localStorage.setItem('cedar-onboarded', '1');
    } catch { /* cosmetic */ }
    try {
      await startCheckout({ tier: tierId, billing_period: period });
    } catch (e) {
      setError(e?.message || 'Could not start checkout. You can also upgrade later from Settings.');
      setBusy(null);
    }
  };

  const promise = PROMISES[goal] || PROMISES.exams;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* progress */}
          <div className="flex items-center justify-center gap-1.5 mb-8" aria-label={`Step ${step + 1} of 3`}>
            {[0, 1, 2].map((i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all duration-standard ease-standard ${i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted'}`} />
            ))}
          </div>

          {step === 0 && (
            <div className="animate-fade-in">
              <h1 className="font-heading text-2xl font-bold text-foreground text-center mb-1">
                What&rsquo;s your biggest struggle this semester?
              </h1>
              <p className="text-sm text-muted-foreground text-center mb-6">Cedar shapes itself around your answer.</p>
              <div className="space-y-2.5">
                {GOALS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => pickGoal(g.id)}
                    className="w-full flex items-start gap-3 p-4 rounded-2xl border border-border bg-card text-left hover:border-primary/40 hover:bg-primary/[0.03] transition-colors duration-micro"
                  >
                    <span className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <g.icon className="w-[18px] h-[18px] text-primary" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-foreground">{g.label}</span>
                      <span className="block text-xs text-muted-foreground mt-0.5">{g.sub}</span>
                    </span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => finish()} className="mt-6 w-full text-center text-xs text-muted-foreground hover:text-foreground">
                Skip for now
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="animate-fade-in">
              <h1 className="font-heading text-2xl font-bold text-foreground text-center mb-6">{promise.title}</h1>
              <div className="rounded-2xl border border-border bg-card shadow-2 p-5 mb-4">
                <ul className="space-y-3">
                  {promise.lines.map((line) => (
                    <li key={line} className="flex items-start gap-2.5 text-sm text-foreground">
                      <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" strokeWidth={2.5} /> {line}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-muted/40 px-4 py-3 mb-6">
                <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Your recordings stay private to you. Cedar helps you learn your own lectures — it never does
                  assignments — and recording consent is built into every class.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full py-3 rounded-button bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-micro"
              >
                Continue
              </button>
              <button type="button" onClick={() => finish()} className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground">
                Skip for now
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in">
              <h1 className="font-heading text-2xl font-bold text-foreground text-center mb-1">Start the semester covered</h1>
              <p className="text-sm text-muted-foreground text-center mb-5">Most students pick Student. Change or cancel anytime.</p>

              <div className="flex justify-center mb-4">
                <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted">
                  {['semester', 'monthly'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPeriod(p)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors duration-micro ${period === p ? 'bg-card text-foreground shadow-1' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5 mb-4">
                {['student', 'scholar'].map((id) => {
                  const t = TIERS[id];
                  const isPopular = id === 'student';
                  const perMonth = period === 'semester' ? t.semester / 4 : t.monthly;
                  return (
                    <div key={id} className={`relative rounded-2xl border p-4 ${isPopular ? 'border-primary/50 ring-1 ring-primary/25 bg-primary/[0.03]' : 'border-border bg-card'}`}>
                      {isPopular && (
                        <span className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold uppercase tracking-wide">
                          Most popular
                        </span>
                      )}
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-heading text-base font-bold text-foreground">{t.name}</span>
                        <span className="text-sm tabular-nums text-foreground">
                          <b className="font-heading text-lg">${perMonth.toFixed(2)}</b>
                          <span className="text-muted-foreground text-xs">/mo</span>
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                        {period === 'semester' ? `Billed $${t.semester.toFixed(2)} once per semester.` : `Billed $${t.monthly.toFixed(2)} monthly.`}{' '}
                        ~{Math.floor(t.creditsPerMonth / CREDITS_PER_LECTURE)} recorded lectures a month.
                      </p>
                      <button
                        type="button"
                        onClick={() => buy(id)}
                        disabled={busy !== null}
                        className={`w-full py-2.5 rounded-button text-sm font-medium transition-colors duration-micro disabled:opacity-50 flex items-center justify-center gap-2 ${isPopular ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border border-border text-foreground hover:bg-muted'}`}
                      >
                        {busy === id ? <><Loader2 className="w-4 h-4 animate-spin" /> Opening checkout…</> : `Get ${t.name}`}
                      </button>
                    </div>
                  );
                })}
              </div>

              {error && <p className="text-xs text-destructive mb-3 text-center">{error}</p>}

              <button
                type="button"
                onClick={() => finish()}
                className="w-full py-2.5 rounded-button border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors duration-micro"
              >
                Continue with Free
              </button>
              <p className="text-[11px] text-muted-foreground text-center mt-3">
                Free includes {TIERS.free.creditsPerMonth} starter credits — enough to record your first two lectures.
                Cancel anytime · No hidden fees · Prices in CAD
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
