import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, FileText, Layers, CalendarCheck, Check, Loader2, Shield, X, Lock, Sparkles } from 'lucide-react';
import { TIERS, hoursFrom } from '@/lib/tiers';
import { startCheckout } from '@/lib/checkout';
import { track } from '@/lib/analytics';
import PaywallLegalLinks from '@/components/monetization/PaywallLegalLinks';

/**
 * The onboarding-primed paywall, v2 (MON-04 §2 + Aug 2026 rework).
 *
 * Questionnaire-first, Duolingo-pattern: three micro-decisions before any
 * pricing (self-identification builds sunk cost and picks the persona), a
 * promise step that answers the student's OWN words, then ONE paywall at
 * peak motivation with every plan and rate visible.
 *
 * The exit is deliberately soft (research: soft walls prime, hard walls
 * burn): a quiet X in the corner — pressing it shows a single honest
 * recommendation ("start with Scholar: everything unlocked from day one")
 * with a real, unshamed "Continue with Free" beneath it. One interstitial,
 * never a loop; the free path always works; no invented urgency, numbers or
 * testimonials. Free framing is honest about its size: 2 full lectures.
 */

const GOALS = [
  { id: 'fast-prof', icon: Mic, label: 'My prof talks too fast', sub: 'I miss half of what matters in lectures' },
  { id: 'notes', icon: FileText, label: "I can't listen and take notes at once", sub: 'Writing means missing what comes next' },
  { id: 'exams', icon: Layers, label: 'Exams sneak up on me', sub: 'By midterms my notes are a mess' },
  { id: 'organized', icon: CalendarCheck, label: 'Staying organized is the hard part', sub: 'I need the plan made for me' },
];

const STUDY_STYLES = [
  { id: 'cram', label: 'Cramming from messy notes the night before', answer: 'Each lecture you record becomes a summary and flashcards the same day, so you start studying from notes you already have.' },
  { id: 'reread', label: 'Re-reading or re-listening to everything', answer: 'Searchable transcripts and summaries take you straight to the part that matters, so you never re-listen to a whole lecture.' },
  { id: 'flashcards', label: 'Making my own flashcards by hand', answer: 'Flashcards make themselves from every recorded lecture.' },
  { id: 'unsure', label: "I never know what to study first", answer: 'Exam topic prediction ranks what to study first, using your own lectures.' },
];

const COURSE_LOADS = [
  { id: 'few', label: '3 or fewer' },
  { id: 'mid', label: '4 or 5' },
  { id: 'many', label: '6 or more' },
];

const PROMISES = {
  'fast-prof': { title: 'Keep up with a fast professor', lines: ['Record the lecture and get the full transcript', 'Replay anything at your own speed, with the transcript beside it', 'A clean summary and key concepts a few minutes after class'] },
  notes: { title: 'Just listen. We take the notes.', lines: ['Hit record and put the pen down', 'Transcript, summary and action items appear after class', 'Your own quick notes attach to the exact lecture'] },
  exams: { title: 'Prepare for the exams that count', lines: ['Your lectures become flashcards and practice questions', 'Exam hints your prof drops get flagged', 'Exam-topic prediction shows what to study first'] },
  organized: { title: 'Your semester, already structured', lines: ['Import your timetable once and every class is scheduled', 'Study sessions planned around your real deadlines', 'One place for lectures, notes, flashcards and plans'] },
};

// What stays locked on Free — shown ON the paywall so the value of upgrading
// is explicit, not implied (his words: "clearly communicate the value").
const LOCKED_ON_FREE = [
  { label: 'AI reviews, quizzes & practice questions', tier: 'Student' },
  { label: 'Class handbooks & exam topic prediction', tier: 'Scholar' },
  { label: 'AI study schedules', tier: 'Scholar' },
];

const LOAD_NUDGE = {
  few: 'Scholar includes every tool: handbooks, exam predictions and study schedules.',
  mid: 'With 4 or 5 courses, Scholar gives you a handbook for every class.',
  many: `With 6 or more courses, Scholar records about ${hoursFrom(TIERS.scholar.creditsPerMonth)} hours of lectures a month. Unlimited records more.`,
};

const STEPS = 5; // struggle, study style, course load, promise, plans

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState(null);
  const [studyStyle, setStudyStyle] = useState(null);
  const [courseLoad, setCourseLoad] = useState(null);
  const [period, setPeriod] = useState('semester');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  // The soft exit: X on the paywall opens one recommendation screen.
  const [exitOffer, setExitOffer] = useState(false);

  // Funnel telemetry — view/dismiss/convert on the one paywall (Phase D).
  useEffect(() => {
    if (step === 4 && !exitOffer) track('onboarding_paywall_viewed');
    if (step === 4 && exitOffer) track('onboarding_exit_offer_shown');
  }, [step, exitOffer]);

  const finish = (to = '/setup') => {
    try {
      localStorage.setItem('cedar-onboarded', '1');
      if (goal) localStorage.setItem('cedar-goal', goal);
      if (studyStyle) localStorage.setItem('cedar-studystyle', studyStyle);
    } catch { /* storage unavailable — cosmetic only */ }
    navigate(to);
  };

  const pick = (setter, key, value, next) => {
    setter(value);
    try { localStorage.setItem(key, value); } catch { /* cosmetic */ }
    setStep(next);
  };

  const buy = async (tierId) => {
    setBusy(tierId);
    setError(null);
    track('checkout_started', { tier: tierId, period, source: exitOffer ? 'onboarding-exit' : 'onboarding' });
    if (exitOffer) track('onboarding_exit_scholar_clicked');
    try { localStorage.setItem('cedar-onboarded', '1'); } catch { /* cosmetic */ }
    try {
      await startCheckout({ tier: tierId, billing_period: period });
    } catch (e) {
      setError(e?.message || 'Could not start checkout. You can also upgrade later from Settings.');
      setBusy(null);
    }
  };

  const promise = PROMISES[goal] || PROMISES.exams;
  const styleAnswer = STUDY_STYLES.find((s) => s.id === studyStyle)?.answer;
  const nudge = LOAD_NUDGE[courseLoad] || LOAD_NUDGE.few;
  const scholarPerMonth = (period === 'semester' ? TIERS.scholar.semester / 4 : TIERS.scholar.monthly).toFixed(2);

  const QuestionShell = ({ title, sub = null, children }) => (
    <div className="animate-fade-in">
      <h1 className="font-heading text-2xl font-bold text-foreground text-center mb-1">{title}</h1>
      {sub && <p className="text-sm text-muted-foreground text-center mb-6">{sub}</p>}
      {children}
      <button type="button" onClick={() => finish()} className="mt-6 w-full text-center text-xs text-muted-foreground hover:text-foreground">
        Skip for now
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* progress. The first dot is the account they just made, already
              done: a run that starts part-way is finished more often than one
              that starts from nothing (the endowed-progress effect), and it
              is true, so it costs nothing. */}
          {!exitOffer && (
            <div className="flex items-center justify-center gap-1.5 mb-8" role="img" aria-label={`Step ${step + 2} of ${STEPS + 1}: account made`}>
              {Array.from({ length: STEPS + 1 }, (_, i) => {
                const current = i === step + 1;
                const done = i <= step;
                return (
                  <span key={i} className={`h-1.5 rounded-full transition-all duration-standard ease-standard ${current ? 'w-6 bg-primary' : done ? 'w-1.5 bg-primary/40' : 'w-1.5 bg-muted'}`} />
                );
              })}
            </div>
          )}

          {/* Q1 — the struggle (persona) */}
          {step === 0 && (
            <QuestionShell title="What&rsquo;s your biggest struggle this semester?" sub="We shape the app around your answer.">
              <div className="space-y-2.5">
                {GOALS.map((g) => (
                  <button key={g.id} type="button" onClick={() => pick(setGoal, 'cedar-goal', g.id, 1)}
                    className="w-full flex items-start gap-3 p-4 rounded-2xl border border-border bg-card text-left hover:border-primary/40 hover:bg-primary/[0.03] transition-colors duration-micro">
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
            </QuestionShell>
          )}

          {/* Q2 — how studying happens today */}
          {step === 1 && (
            <QuestionShell title="When an exam gets close, what does studying usually look like?" sub="Be honest. Everyone&rsquo;s is messier than they admit.">
              <div className="space-y-2.5">
                {STUDY_STYLES.map((s) => (
                  <button key={s.id} type="button" onClick={() => pick(setStudyStyle, 'cedar-studystyle', s.id, 2)}
                    className="w-full p-4 rounded-2xl border border-border bg-card text-left text-sm font-medium text-foreground hover:border-primary/40 hover:bg-primary/[0.03] transition-colors duration-micro">
                    {s.label}
                  </button>
                ))}
              </div>
            </QuestionShell>
          )}

          {/* Q3 — course load (tailors the plan nudge) */}
          {step === 2 && (
            <QuestionShell title="How many courses are you juggling this term?">
              <div className="space-y-2.5">
                {COURSE_LOADS.map((c) => (
                  <button key={c.id} type="button" onClick={() => pick(setCourseLoad, 'cedar-courseload', c.id, 3)}
                    className="w-full p-4 rounded-2xl border border-border bg-card text-left text-sm font-medium text-foreground hover:border-primary/40 hover:bg-primary/[0.03] transition-colors duration-micro">
                    {c.label}
                  </button>
                ))}
              </div>
            </QuestionShell>
          )}

          {/* The promise — their own words answered */}
          {step === 3 && (
            <div className="animate-fade-in">
              <h1 className="font-heading text-2xl font-bold text-foreground text-center mb-6">{promise.title}</h1>
              <div className="rounded-2xl border border-border bg-card shadow-2 p-5 mb-4">
                <ul className="space-y-3">
                  {promise.lines.map((line) => (
                    <li key={line} className="flex items-start gap-2.5 text-sm text-foreground">
                      <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" strokeWidth={2.5} /> {line}
                    </li>
                  ))}
                  {styleAnswer && (
                    <li className="flex items-start gap-2.5 text-sm text-foreground">
                      <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" /> {styleAnswer}
                    </li>
                  )}
                </ul>
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-muted/40 px-4 py-3 mb-6">
                <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Your recordings stay private to you. We help you learn your own lectures, we never do
                  assignments, and every class asks you to confirm you have permission to record.
                </p>
              </div>
              <button type="button" onClick={() => setStep(4)}
                className="w-full py-3 rounded-button bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-micro">
                See how to get all of this
              </button>
            </div>
          )}

          {/* The paywall — every plan, every rate, locks explicit */}
          {step === 4 && !exitOffer && (
            <div className="animate-fade-in relative">
              {/* The soft exit: quiet by design, always functional */}
              <button type="button" onClick={() => setExitOffer(true)} aria-label="Close plans"
                className="absolute -top-1 right-0 p-1.5 text-muted-foreground/50 hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>

              <h1 className="font-heading text-2xl font-bold text-foreground text-center mb-1">Start the semester covered</h1>
              <p className="text-sm text-muted-foreground text-center mb-4">{nudge}</p>

              {/* Honest free framing + what stays locked */}
              <div className="rounded-xl border border-border bg-muted/30 p-3.5 mb-4">
                <p className="text-xs text-foreground font-medium mb-2">
                  Free covers your first two lectures of up to 90 minutes each, with transcripts, summaries and flashcards. These stay locked:
                </p>
                <ul className="space-y-1">
                  {LOCKED_ON_FREE.map((f) => (
                    <li key={f.label} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Lock className="w-3 h-3 flex-shrink-0" /> {f.label}
                      <span className="ml-auto text-[11px] font-medium text-primary/80">{f.tier}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex justify-center mb-4">
                <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted">
                  {['semester', 'monthly'].map((p) => (
                    <button key={p} type="button" onClick={() => setPeriod(p)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors duration-micro ${period === p ? 'bg-card text-foreground shadow-1' : 'text-muted-foreground hover:text-foreground'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5 mb-2">
                {['student', 'scholar'].map((id) => {
                  const t = TIERS[id];
                  const recommended = id === 'scholar';
                  const perMonth = period === 'semester' ? t.semester / 4 : t.monthly;
                  return (
                    <div key={id} className={`relative rounded-2xl border p-4 ${recommended ? 'border-primary/50 ring-1 ring-primary/25 bg-primary/[0.03]' : 'border-border bg-card'}`}>
                      {recommended && (
                        <span className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold">
                          Recommended · every tool included
                        </span>
                      )}
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-heading text-base font-bold text-foreground">{t.name}</span>
                        <span className="text-sm tabular-nums text-foreground">
                          <b className="font-heading text-lg">${perMonth.toFixed(2)}</b>
                          <span className="text-muted-foreground text-xs">/mo</span>
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">
                        {period === 'semester' ? `Billed $${t.semester.toFixed(2)} once per semester.` : `Billed $${t.monthly.toFixed(2)} monthly.`}{' '}
                        About {hoursFrom(t.creditsPerMonth)} hours of lectures a month.
                      </p>
                      {/* Compact by design — the paywall step stays scannable;
                          the full comparison lives on /subscription. */}
                      <ul className="mb-2.5 space-y-1">
                        {t.includes.slice(1, 4).map((line) => (
                          <li key={line} className="flex items-start gap-1.5 text-xs text-foreground">
                            <Check className="w-3.5 h-3.5 text-primary mt-[1px] flex-shrink-0" strokeWidth={2.5} /> {line}
                          </li>
                        ))}
                      </ul>
                      <button type="button" onClick={() => buy(id)} disabled={busy !== null}
                        className={`w-full py-2.5 rounded-button text-sm font-medium transition-colors duration-micro disabled:opacity-50 flex items-center justify-center gap-2 ${recommended ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border border-border text-foreground hover:bg-muted'}`}>
                        {busy === id ? <><Loader2 className="w-4 h-4 animate-spin" /> Opening checkout…</> : `Get ${t.name}`}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Unlimited, compact — it exists for the heaviest users */}
              <button type="button" onClick={() => buy('unlimited')} disabled={busy !== null}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-border text-left hover:bg-muted transition-colors duration-micro disabled:opacity-50 mb-3">
                <span className="text-xs text-foreground font-medium">Unlimited: record every lecture and lab</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {busy === 'unlimited' ? 'Opening…' : `$${(period === 'semester' ? TIERS.unlimited.semester / 4 : TIERS.unlimited.monthly).toFixed(2)}/mo`}
                </span>
              </button>

              {error && <p className="text-xs text-destructive mb-2 text-center">{error}</p>}
              <p className="text-[11px] text-muted-foreground text-center">
                Cancel anytime in Settings · Keep your plan until the period ends · Prices in CAD ·{' '}
                <PaywallLegalLinks />
              </p>
            </div>
          )}

          {/* The exit offer — one honest recommendation, then a real free path */}
          {step === 4 && exitOffer && (
            <div className="animate-fade-in text-center">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h1 className="font-heading text-xl font-bold text-foreground mb-2">Before you decide</h1>
              <p className="text-sm text-muted-foreground mb-1">
                We recommend starting with <b className="text-foreground">Scholar</b>. It includes every tool from day one:
                handbooks, exam predictions and AI study schedules.
              </p>
              <p className="text-xs text-muted-foreground mb-5">
                ${scholarPerMonth}/mo{period === 'semester' ? `, billed $${TIERS.scholar.semester.toFixed(2)} once per semester` : ''}. Cancel anytime.
              </p>
              <button type="button" onClick={() => buy('scholar')} disabled={busy !== null}
                className="w-full py-3 rounded-button bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-micro disabled:opacity-50 flex items-center justify-center gap-2">
                {busy === 'scholar' ? <><Loader2 className="w-4 h-4 animate-spin" /> Opening checkout…</> : 'Get Scholar'}
              </button>
              <button type="button" onClick={() => { track('onboarding_continue_free'); finish(); }}
                className="mt-2.5 w-full py-2.5 rounded-button border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors duration-micro">
                Continue with Free
              </button>
              <button type="button" onClick={() => setExitOffer(false)}
                className="mt-3 text-xs text-muted-foreground hover:text-foreground">
                Back to all plans
              </button>
              {error && <p className="text-xs text-destructive mt-2">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
