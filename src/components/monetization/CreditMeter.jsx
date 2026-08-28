import React from 'react';
import { Sparkles } from 'lucide-react';
import { useBalance } from '@/hooks/useBalance';
import { tierOf } from '@/lib/tiers';
import { useUpgrade } from './UpgradeContext';

/**
 * The always-visible credit pill (MON-04 §3).
 *
 * Predictable, visible limits are the anti-TurboLearn artifact: a balance the
 * student can always see is a balance they forgive. Tapping it opens the
 * upgrade sheet — with the cost table when credits remain, and the
 * out-of-credits framing when they don't.
 */
export default function CreditMeter({ className = '' }) {
  const { balance, available, tier, loading } = useBalance();
  const { openUpgrade } = useUpgrade();

  if (loading && !balance) return null;

  const empty = available <= 0;
  const low = !empty && available <= 10;
  const tone = empty
    ? 'border-destructive/40 text-destructive bg-destructive/5'
    : low
      ? 'border-amber-500/40 text-amber-700 dark:text-amber-500 bg-amber-500/5'
      : 'border-border text-foreground bg-card';

  return (
    <button
      type="button"
      onClick={() => openUpgrade({ source: empty ? 'out-of-credits' : 'meter' })}
      aria-label={`${available} Cedar credits remaining — see plans`}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium tabular-nums transition-colors duration-micro hover:border-primary/40 hover:text-primary ${tone} ${className}`}
    >
      <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />
      {available}
      <span className="sr-only">credits</span>
      {/* Which plan those credits come from — one glance, no Settings trip. */}
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-l border-border pl-1.5 ml-0.5">
        {tierOf(tier).name}
      </span>
    </button>
  );
}
