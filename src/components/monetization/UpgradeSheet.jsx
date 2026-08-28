import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Check, Loader2 } from 'lucide-react';
import { TIERS, TIER_ORDER, CREDIT_COSTS, CREDITS_PER_LECTURE } from '@/lib/tiers';
import { startCheckout } from '@/lib/checkout';
import { useBalance } from '@/hooks/useBalance';

/**
 * The single upgrade surface (MON-04 §3-4). Entry-aware headline, semester
 * billing pre-selected with the billed total always visible, Scholar
 * highlighted, credit packs demoted to a quiet link, honest reassurance
 * strip. Dark patterns are out of scope by design — the close button is
 * always visible and "not now" costs nothing.
 */
const ENTRY_COPY = {
  generic: { title: 'Do more with Cedar', sub: 'Pick the plan that fits your semester.' },
  meter: { title: 'Your Cedar credits', sub: 'Credits power recording, handbooks and AI study tools. Plans refresh them every month.' },
  'out-of-credits': { title: "You're out of credits", sub: 'Everything you recorded is safe — it processes the moment you top up.' },
  handbook: { title: 'Every class, its own handbook', sub: 'Cedar writes a living handbook from your own lectures, chapter by chapter.' },
  recording: { title: 'Keep every lecture covered', sub: 'Student covers about 20 recorded lectures a month — every class, all semester.' },
  schedule: { title: 'Your week, already planned', sub: 'AI study schedules build themselves around your classes and deadlines.' },
  history: { title: 'See your whole semester', sub: 'Full proficiency history and every handbook ship with Scholar.' },
  onboarding: { title: 'Start the semester covered', sub: 'Most students pick Student. Change or cancel anytime.' },
};

// The onboarding goal (localStorage, set in Onboarding.jsx) upgrades the
// generic entry to persona copy — the sheet speaks to the struggle the
// student named on day one.
const GOAL_SOURCES = {
  'fast-prof': { title: 'Never miss a word again', sub: 'Student covers about 20 recorded, transcribed lectures a month.' },
  notes: { title: 'Just listen. Cedar takes the notes.', sub: 'Every plan turns lectures into transcripts, summaries and flashcards.' },
  exams: { title: 'Walk into every exam covered', sub: 'Flashcards, exam-mention tracking and topic prediction on every plan.' },
  organized: { title: 'Your semester, already structured', sub: 'AI study schedules and a planner that rebooks itself.' },
};

function storedGoalCopy() {
  try {
    return GOAL_SOURCES[localStorage.getItem('cedar-goal')] || null;
  } catch {
    return null;
  }
}

const PAYWALL_TIERS = ['student', 'scholar', 'unlimited'];

export default function UpgradeSheet({ source = 'generic', onClose }) {
  const copy = (source === 'generic' && storedGoalCopy()) || ENTRY_COPY[source] || ENTRY_COPY.generic;
  const { tier: currentTier } = useBalance();
  const [period, setPeriod] = useState('semester');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const currentRank = TIER_ORDER.indexOf(currentTier);
  const options = PAYWALL_TIERS.filter((id) => TIER_ORDER.indexOf(id) > currentRank);

  const buy = async (tierId) => {
    setBusy(tierId);
    setError(null);
    try {
      await startCheckout({ tier: tierId, billing_period: period });
    } catch (e) {
      setError(e?.message || 'Could not start checkout. Please try again.');
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 glass" onClick={onClose}>
      <div
        className="bg-card w-full sm:max-w-md rounded-t-modal sm:rounded-modal border border-border shadow-3 p-6 max-h-[90vh] overflow-y-auto animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={copy.title}
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="font-heading text-xl font-bold text-foreground">{copy.title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground p-1 -m-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">{copy.sub}</p>

        {source === 'meter' && (
          <div className="rounded-xl bg-muted/50 px-4 py-3 mb-4 text-xs text-muted-foreground">
            What credits buy: a recorded lecture ≈ {CREDITS_PER_LECTURE} · class handbook {CREDIT_COSTS.flat.handbook} ·
            lecture review {CREDIT_COSTS.flat.lecture_review} · exam prediction {CREDIT_COSTS.flat.exam_prediction} ·
            study schedule {CREDIT_COSTS.flat.study_schedule}. Timetable import is always free.
          </div>
        )}

        {options.length === 0 ? (
          <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
            You&rsquo;re on the top plan. Manage billing anytime in{' '}
            <Link to="/settings" onClick={onClose} className="text-primary font-medium hover:underline">Settings</Link>.
          </div>
        ) : (
          <>
            <div className="flex justify-center mb-4">
              <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted">
                {['semester', 'monthly'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors duration-micro ${
                      period === p ? 'bg-card text-foreground shadow-1' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {p}
                    {p === 'semester' && <span className="ml-1 text-[10px] font-semibold text-emerald-600 uppercase">Save</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5 mb-4">
              {options.map((id) => {
                const t = TIERS[id];
                const isPopular = id === 'scholar';
                const perMonth = period === 'semester' ? t.semester / 4 : t.monthly;
                return (
                  <div
                    key={id}
                    className={`relative rounded-2xl border p-4 ${
                      isPopular ? 'border-primary/50 ring-1 ring-primary/30 bg-primary/[0.03]' : 'border-border'
                    }`}
                  >
                    {isPopular && (
                      <span className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold uppercase tracking-wide">
                        Most popular
                      </span>
                    )}
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-heading text-base font-bold text-foreground">{t.name}</span>
                      <span className="text-sm text-foreground tabular-nums">
                        <b className="font-heading text-lg">${perMonth.toFixed(2)}</b>
                        <span className="text-muted-foreground text-xs">/mo</span>
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t.blurb}{' '}
                      {period === 'semester'
                        ? `Billed $${t.semester.toFixed(2)} once per semester.`
                        : `Billed $${t.monthly.toFixed(2)} monthly.`}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {t.includes.slice(0, 3).map((line) => (
                        <li key={line} className="flex items-start gap-1.5 text-xs text-foreground">
                          <Check className="w-3.5 h-3.5 text-primary mt-[1px] flex-shrink-0" strokeWidth={2.5} /> {line}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => buy(id)}
                      disabled={busy !== null}
                      className={`mt-3 w-full py-2.5 rounded-button text-sm font-medium transition-colors duration-micro disabled:opacity-50 flex items-center justify-center gap-2 ${
                        isPopular
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                          : 'border border-border text-foreground hover:bg-muted'
                      }`}
                    >
                      {busy === id ? <><Loader2 className="w-4 h-4 animate-spin" /> Opening checkout…</> : `Get ${t.name}`}
                    </button>
                  </div>
                );
              })}
            </div>

            {error && <p className="text-xs text-destructive mb-3">{error}</p>}

            <div className="flex items-center justify-between text-xs">
              <Link to="/subscription" onClick={onClose} className="text-muted-foreground hover:text-foreground underline">
                Compare all plans
              </Link>
              <Link to="/subscription" onClick={onClose} className="text-muted-foreground hover:text-foreground underline">
                Just need a few credits?
              </Link>
            </div>
            <p className="text-[11px] text-muted-foreground text-center mt-3">
              Cancel anytime · No hidden fees · Prices in CAD
            </p>
          </>
        )}
      </div>
    </div>
  );
}
