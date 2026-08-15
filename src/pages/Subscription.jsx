import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { TIERS, TIER_ORDER, CREDIT_PACKS, CREDITS_PER_LECTURE } from '@/lib/tiers';
import { Check, Loader2, ArrowLeft, Zap, Sparkles, AlertCircle } from 'lucide-react';

/**
 * Full plan comparison and checkout.
 *
 * Every price shown here is display-only. The buttons post { tier,
 * billing_period } or { pack } — never a price or an amount — and
 * createCheckoutSession resolves the real Stripe price server-side. A caller
 * cannot talk this page into selling Unlimited for a cent.
 */
export default function Subscription() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('semester'); // semester leads: better margin, better value
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const rows = await base44.entities.CreditBalance.list();
        setBalance(rows?.[0] || null);
      } catch (e) {
        console.error('[subscription] balance load failed', e);
      }
      setLoading(false);
    })();
  }, []);

  const currentTier = balance?.tier || 'free';

  const startCheckout = async (payload, key) => {
    setBusy(key);
    setError('');
    try {
      const res = await base44.functions.invoke('createCheckoutSession', payload);
      const url = res?.data?.url;
      if (url) {
        window.location.href = url;
        return;
      }
      setError(res?.data?.error || 'Billing isn’t connected yet. Please try again shortly.');
    } catch (e) {
      console.error('[subscription] checkout failed', e);
      setError('Could not start checkout. Please try again, or contact support if it keeps happening.');
    }
    setBusy('');
  };

  /** Semester plans bill every 4 months. Show the real monthly-equivalent and
   *  the actual saving rather than an invented discount. */
  const savingFor = (tier) => {
    if (!tier.monthly || !tier.semester) return null;
    const fourMonthsMonthly = tier.monthly * 4;
    const saved = fourMonthsMonthly - tier.semester;
    if (saved <= 0) return null;
    return {
      saved: saved.toFixed(2),
      percent: Math.round((saved / fourMonthsMonthly) * 100),
      perMonth: (tier.semester / 4).toFixed(2),
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <button
        onClick={() => navigate('/settings')}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Settings
      </button>

      <div className="text-center mb-8">
        <h1 className="font-heading text-3xl font-bold mb-2">Choose your plan</h1>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          Every plan includes the full exam coverage map, unlimited typed-note lectures, flashcards and analytics.
          Plans differ in how much you can <span className="text-foreground font-medium">record and process</span>.
        </p>
      </div>

      {/* Billing period toggle */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted">
          <button
            onClick={() => setPeriod('semester')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${period === 'semester' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Semester
            <span className="ml-1.5 text-[10px] font-semibold text-emerald-600 uppercase">Save 25%</span>
          </button>
          <button
            onClick={() => setPeriod('monthly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${period === 'monthly' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Monthly
          </button>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground mb-6">
        {period === 'semester'
          ? 'Semester plans bill once every 4 months and renew automatically. Cancel any time.'
          : 'Monthly plans bill every month and renew automatically. Cancel any time.'}
      </p>

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 max-w-lg mx-auto">
          <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Tier grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-12">
        {TIER_ORDER.map((id) => {
          const tier = TIERS[id];
          const isCurrent = currentTier === id;
          const isFree = id === 'free';
          const price = isFree ? 0 : (period === 'monthly' ? tier.monthly : tier.semester);
          const saving = savingFor(tier);
          const featured = id === 'scholar';

          return (
            <div
              key={id}
              className={`relative rounded-2xl border p-5 flex flex-col ${
                featured ? 'border-primary shadow-lg shadow-primary/5' : 'border-border'
              } ${isCurrent ? 'bg-muted/30' : 'bg-card'}`}
            >
              {featured && !isCurrent && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold uppercase tracking-wide">
                  Most popular
                </span>
              )}
              {isCurrent && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-foreground text-background text-[10px] font-semibold uppercase tracking-wide">
                  Current plan
                </span>
              )}

              <h2 className="font-heading text-lg font-bold">{tier.name}</h2>
              <p className="text-xs text-muted-foreground mb-4 min-h-[32px]">{tier.blurb}</p>

              <div className="mb-1">
                <span className="font-heading text-3xl font-bold">${price.toFixed(2)}</span>
                {!isFree && (
                  <span className="text-xs text-muted-foreground ml-1">
                    {period === 'monthly' ? '/month' : 'every 4 months'}
                  </span>
                )}
              </div>

              <div className="min-h-[32px] mb-4">
                {isFree ? (
                  <p className="text-xs text-muted-foreground">Free forever</p>
                ) : period === 'semester' && saving ? (
                  <p className="text-xs text-emerald-600">
                    ${saving.perMonth}/mo · save ${saving.saved}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Billed monthly</p>
                )}
              </div>

              <div className="rounded-lg bg-muted/50 px-3 py-2 mb-4">
                <p className="text-sm font-semibold">{tier.creditsPerMonth} credits</p>
                <p className="text-[11px] text-muted-foreground">
                  {tier.lifetimeOnly ? 'one-off grant · ' : 'per month · '}
                  ~{Math.floor(tier.creditsPerMonth / CREDITS_PER_LECTURE)} recorded lecture
                  {Math.floor(tier.creditsPerMonth / CREDITS_PER_LECTURE) === 1 ? '' : 's'}
                </p>
              </div>

              <ul className="space-y-1.5 mb-5 flex-1">
                {tier.includes.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <Check className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" strokeWidth={2.5} />
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
                {tier.excludes?.map((f, i) => (
                  <li key={`x${i}`} className="flex items-start gap-2 text-xs text-muted-foreground/60">
                    <span className="w-3.5 text-center mt-0.5 flex-shrink-0">–</span>
                    <span className="line-through">{f}</span>
                  </li>
                ))}
              </ul>

              {tier.fairUseHoursPerSemester && (
                <p className="text-[10px] text-muted-foreground mb-3">
                  Fair use: {tier.fairUseHoursPerSemester} recorded hours a semester.
                </p>
              )}

              {isFree ? (
                <button disabled className="w-full py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground cursor-default">
                  {isCurrent ? 'Your plan' : 'Included'}
                </button>
              ) : isCurrent ? (
                <button
                  onClick={async () => {
                    setBusy('portal');
                    try {
                      const res = await base44.functions.invoke('createPortalSession', {});
                      if (res?.data?.url) { window.location.href = res.data.url; return; }
                      setError('Billing portal isn’t available yet.');
                    } catch { setError('Could not open the billing portal.'); }
                    setBusy('');
                  }}
                  disabled={busy === 'portal'}
                  className="w-full py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {busy === 'portal' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Manage billing
                </button>
              ) : (
                <button
                  onClick={() => startCheckout({ tier: id, billing_period: period }, `${id}-${period}`)}
                  disabled={!!busy}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${
                    featured
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'border border-border hover:bg-muted'
                  }`}
                >
                  {busy === `${id}-${period}`
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Starting…</>
                    : <>Choose {tier.name}</>}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Credit packs */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4 text-primary" />
          <h2 className="font-heading text-lg font-bold">Need a top-up instead?</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          One-off credit packs. No subscription needed, and{' '}
          <span className="text-foreground font-medium">purchased credits never expire</span> — they survive
          cancellation and are spent only after your monthly credits run out.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CREDIT_PACKS.map((p) => (
            <div key={p.id} className="rounded-xl border border-border p-4 flex flex-col">
              <p className="text-sm font-semibold">{p.name}</p>
              <p className="font-heading text-2xl font-bold mt-1">${p.price.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mb-1">{p.credits} credits</p>
              <p className="text-[11px] text-muted-foreground mb-4 flex-1">
                ~{Math.floor(p.credits / CREDITS_PER_LECTURE)} recorded lectures
              </p>
              <button
                onClick={() => startCheckout({ pack: p.id }, p.id)}
                disabled={!!busy}
                className="w-full py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {busy === p.id ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Starting…</> : 'Buy'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 flex items-start gap-2 text-xs text-muted-foreground max-w-2xl mx-auto">
        <Sparkles className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <p>
          Credits are spent on AI processing — recording and transcribing a lecture, generating handbooks,
          predicting exam topics. Reading, searching and studying what you already have is always free.
          Subscription credits reset each period; purchased credits roll over forever.
        </p>
      </div>
    </div>
  );
}
