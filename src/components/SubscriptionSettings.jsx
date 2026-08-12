import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Zap, CreditCard, ExternalLink, TrendingUp, AlertCircle } from 'lucide-react';
import { CREDIT_PACKS, CREDITS_PER_LECTURE, tierOf, nextTierUp } from '@/lib/tiers';

/**
 * Subscription, credit balance and purchase management.
 *
 * Reads CreditBalance and UsageEvent directly — both are RLS-scoped to the
 * signed-in user, so this shows only their own data.
 *
 * The checkout and billing-portal calls target backend functions that the
 * Stripe integration will provide (`createCheckoutSession`, `createPortalSession`).
 * Until those exist the buttons surface a clear "not connected yet" message
 * rather than a stack trace, so this panel is safe to ship before billing is.
 */
export default function SubscriptionSettings() {
  const [balance, setBalance] = useState(null);
  const [usage, setUsage] = useState({ lectures: 0, credits: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [balances, events] = await Promise.all([
        base44.entities.CreditBalance.list(),
        base44.entities.UsageEvent.list('-occurred_at', 200),
      ]);
      setBalance(balances?.[0] || null);

      // This calendar month only.
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const recent = (events || []).filter(
        e => e.success !== false && e.occurred_at && new Date(e.occurred_at) >= monthStart
      );
      setUsage({
        lectures: recent.filter(e => e.feature === 'process_lecture').length,
        credits: recent.reduce((s, e) => s + (e.cedar_credits_charged || 0), 0),
      });
    } catch (e) {
      console.error(e);
      // A missing entity or an empty table is not an error worth shouting about.
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const startCheckout = async (payload, key) => {
    setBusy(key);
    setError(null);
    if (window.self !== window.top) {
      setError('Checkout only works from the published app. Open Cedar in a new tab to complete your purchase.');
      setBusy(null);
      return;
    }
    try {
      const res = await base44.functions.invoke('createCheckoutSession', payload);
      const url = res?.data?.url || res?.data?.checkout_url;
      if (!url) throw new Error('No checkout URL returned.');
      window.location.href = url;
    } catch (e) {
      console.error(e);
      setError('Billing isn’t connected yet. Once Stripe is wired up this will open checkout.');
      setBusy(null);
    }
  };

  const openPortal = async () => {
    setBusy('portal');
    setError(null);
    try {
      const res = await base44.functions.invoke('createPortalSession', {});
      const url = res?.data?.url;
      if (!url) throw new Error('No portal URL returned.');
      window.location.href = url;
    } catch (e) {
      console.error(e);
      setError('Billing isn’t connected yet. This will open the Stripe billing portal.');
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  const tier = tierOf(balance?.tier || 'free');
  const upgrade = nextTierUp(tier.id);
  const available = (balance?.subscription_credits || 0) + (balance?.purchased_credits || 0);
  const lecturesLeft = Math.floor(available / CREDITS_PER_LECTURE);
  const low = available > 0 && available <= 10;
  const empty = available <= 0;

  return (
    <div>
      {/* Current plan + balance */}
      <div className="rounded-lg border border-border p-4 mb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-semibold">{tier.name} plan</p>
            <p className="text-xs text-muted-foreground">{tier.blurb}</p>
          </div>
          {tier.id !== 'free' && (
            <button onClick={openPortal} disabled={busy === 'portal'}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0">
              {busy === 'portal' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
              Manage billing
            </button>
          )}
        </div>

        <div className={`rounded-lg p-3 ${empty ? 'bg-destructive/5 border border-destructive/20' : low ? 'bg-amber-500/5 border border-amber-500/20' : 'bg-muted/50'}`}>
          <div className="flex items-baseline gap-2">
            <Zap className={`w-4 h-4 ${empty ? 'text-destructive' : low ? 'text-amber-600' : 'text-primary'}`} />
            <span className="font-heading text-2xl font-bold tabular-nums">{available}</span>
            <span className="text-xs text-muted-foreground">credits left</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            About {lecturesLeft} more {lecturesLeft === 1 ? 'lecture' : 'lectures'}.
            {(balance?.purchased_credits || 0) > 0 && ` ${balance.purchased_credits} of these never expire.`}
          </p>
          {empty && (
            <p className="text-[11px] text-destructive mt-2 flex items-start gap-1.5">
              <AlertCircle className="w-3 h-3 mt-px flex-shrink-0" />
              You&rsquo;re out of credits. Recordings are still saved &mdash; they process as soon as you top up.
            </p>
          )}
        </div>

        <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground">
          <span>{usage.lectures} {usage.lectures === 1 ? 'lecture' : 'lectures'} this month</span>
          <span>{usage.credits} credits used</span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-muted/50 p-3 mb-4 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground">{error}</p>
        </div>
      )}

      {/* Upgrade */}
      {upgrade && (
        <div className="rounded-lg border border-primary/30 bg-primary/[0.03] p-4 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold">Upgrade to {upgrade.name}</p>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{upgrade.blurb}</p>
          <ul className="space-y-1 mb-3">
            {upgrade.includes.slice(0, 4).map(f => (
              <li key={f} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                <span className="text-primary mt-px">&bull;</span>{f}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              onClick={() => startCheckout({ tier: upgrade.id, billing_period: 'semester' }, 'sem')}
              disabled={!!busy}
              className="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50">
              {busy === 'sem' ? 'Opening…' : `$${upgrade.semester}/semester`}
              <span className="block text-[10px] font-normal opacity-80">best value</span>
            </button>
            <button
              onClick={() => startCheckout({ tier: upgrade.id, billing_period: 'monthly' }, 'mo')}
              disabled={!!busy}
              className="flex-1 px-3 py-2 rounded-lg border border-border text-xs font-medium hover:bg-muted disabled:opacity-50">
              {busy === 'mo' ? 'Opening…' : `$${upgrade.monthly}/month`}
            </button>
          </div>
        </div>
      )}

      {/* Credit packs */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-medium">Buy credits</p>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          No subscription needed. Purchased credits never expire and unlock every feature while your balance lasts.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {CREDIT_PACKS.map(p => (
            <button key={p.id}
              onClick={() => startCheckout({ pack: p.id }, p.id)}
              disabled={!!busy}
              className="rounded-lg border border-border p-3 text-left hover:border-primary/30 hover:bg-primary/[0.03] transition-colors disabled:opacity-50">
              <p className="text-sm font-semibold">${p.price}</p>
              <p className="text-[11px] text-muted-foreground">
                {p.credits} credits &middot; ~{Math.floor(p.credits / CREDITS_PER_LECTURE)} lectures
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}