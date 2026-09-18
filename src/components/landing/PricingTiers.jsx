import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { TIERS, TIER_ORDER, CREDITS_PER_LECTURE, PLAN_FEATURES, planHas, semesterSaving, maxSemesterSavingPercent } from '@/lib/tiers';

/**
 * The four plans as cards, on the public site.
 *
 * Every number comes from lib/tiers.js — the same record the app's own
 * subscription page and the Stripe checkout read — so the public price can
 * never drift from the charged one. Student carries the "Most popular"
 * badge: it is the natural first plan for someone who has not signed up yet
 * (the in-app page highlights Scholar, for people upgrading).
 *
 * `compact` is the homepage teaser: price, credits and the badge, with a link
 * to the full page. The full page adds the feature matrix row for row, so
 * what a tier lacks is as visible as what it has.
 */
export const RECOMMENDED_TIER = 'student';

const money = (n) => `$${n.toFixed(2)}`;
const lecturesFrom = (credits) => Math.floor(credits / CREDITS_PER_LECTURE);

export function BillingToggle({ period, onChange }) {
  const best = maxSemesterSavingPercent();
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1">
      <button type="button" onClick={() => onChange('semester')}
        className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${period === 'semester' ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
        Semester
        {best > 0 && <span className="ml-1.5 text-[10px] font-semibold uppercase text-emerald-500">Save up to {best}%</span>}
      </button>
      <button type="button" onClick={() => onChange('monthly')}
        className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${period === 'monthly' ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
        Monthly
      </button>
    </div>
  );
}

export default function PricingTiers({ compact = false, initialPeriod = 'semester' }) {
  const [period, setPeriod] = useState(initialPeriod);

  return (
    <div>
      <div className="flex flex-col items-center gap-2">
        <BillingToggle period={period} onChange={setPeriod} />
        <p className="text-xs text-muted-foreground">
          {period === 'semester'
            ? 'One bill every four months, matching your term. Renews automatically; cancel anytime.'
            : 'Billed every month. Renews automatically; cancel anytime.'}
        </p>
      </div>

      <div className={`mt-6 grid gap-4 ${compact ? 'sm:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
        {TIER_ORDER.map((id) => {
          const tier = TIERS[id];
          const saving = semesterSaving(tier);
          const recommended = id === RECOMMENDED_TIER;
          const free = tier.monthly === 0;
          const perMonth = period === 'semester' && saving ? Number(saving.perMonth) : tier.monthly;
          const lectures = lecturesFrom(tier.creditsPerMonth);

          return (
            <div key={id}
              className={`relative flex flex-col rounded-[22px] border p-5 ${recommended ? 'border-primary/60 bg-card ring-1 ring-primary/25 shadow-[0_18px_55px_-35px_rgba(46,102,255,0.9)]' : 'border-border bg-card'}`}>
              {recommended && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                  Most popular
                </span>
              )}
              <p className="text-base font-bold text-foreground">{tier.name}</p>
              <p className="mt-0.5 min-h-[32px] text-xs text-muted-foreground">{tier.blurb}</p>

              <div className="mt-3">
                <span className="text-3xl font-bold tracking-[-0.03em] text-foreground">{free ? '$0' : money(perMonth)}</span>
                {!free && <span className="ml-1 text-xs text-muted-foreground">/month</span>}
              </div>
              <p className="mt-1 min-h-[32px] text-xs text-muted-foreground">
                {free
                  ? 'No card needed'
                  : period === 'semester'
                    ? <>Billed {money(tier.semester)} once a semester{saving && <span className="text-emerald-500"> · save {saving.percent}%</span>}</>
                    : <>Billed {money(tier.monthly)} every month</>}
              </p>

              <div className="mt-3 rounded-lg bg-muted px-3 py-2">
                <p className="text-sm font-semibold text-foreground">{tier.creditsPerMonth} credits{tier.lifetimeOnly ? '' : ' a month'}</p>
                <p className="text-[11px] text-muted-foreground">
                  {tier.lifetimeOnly ? 'one-time · ' : ''}about {lectures} recorded lecture{lectures === 1 ? '' : 's'}{tier.lifetimeOnly ? '' : ' a month'}
                </p>
              </div>

              {!compact && (
                <ul className="mt-4 flex-1 space-y-1.5">
                  {PLAN_FEATURES.map((f) => {
                    const has = planHas(tier.id, f);
                    return (
                      <li key={f.label} className={`flex items-start gap-2 text-xs ${has ? 'text-foreground' : 'text-muted-foreground/60'}`}>
                        {has
                          ? <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" strokeWidth={2.5} />
                          : <span className="mt-0.5 w-3.5 flex-shrink-0 text-center">–</span>}
                        <span className={has ? '' : 'line-through'}>{f.label}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {!compact && tier.fairUseHoursPerSemester && (
                <p className="mt-3 text-[10px] text-muted-foreground">Fair use: {tier.fairUseHoursPerSemester} recorded hours a semester.</p>
              )}

              <Link to="/register"
                className={`mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${recommended ? 'auth-cta text-primary-foreground' : 'border border-border text-foreground hover:bg-muted'}`}>
                {free ? 'Start free' : `Try free, then ${tier.name}`} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          );
        })}
      </div>

      {compact && (
        <p className="mt-5 text-center text-sm text-muted-foreground">
          Every plan starts with the two free lectures.{' '}
          <Link to="/pricing" className="font-semibold text-primary hover:text-foreground">See the full comparison and credit packs</Link>
        </p>
      )}
    </div>
  );
}
