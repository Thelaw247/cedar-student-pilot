import { useBalance } from '@/hooks/useBalance';
import { useUpgrade } from '@/components/monetization/UpgradeContext';
import { hasFeature, featureMinTierName } from '@/lib/tiers';

/**
 * One-hook feature gating for the UI (MON-04 rework, Aug 2026).
 *
 * `allowed` mirrors the server's FEATURE_MIN_TIER (the server always
 * re-checks — this hook only decides what to render). When locked, show the
 * grey lock treatment and call `lock()` on tap: it opens the upgrade sheet
 * with the feature's own copy and the unlocking tier highlighted.
 */
export function useFeatureGate(featureId) {
  const { tier } = useBalance();
  const { openUpgrade } = useUpgrade();
  const allowed = hasFeature(tier, featureId);
  const requiredTierName = featureMinTierName(featureId);
  const lock = () => openUpgrade({ source: 'feature-lock', feature: featureId });
  return { allowed, requiredTierName, lock, tier };
}

/** Tailwind classes for a locked ("grey with a lock") action button. */
export const LOCKED_BUTTON_CLASS =
  'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-muted-foreground text-xs font-medium cursor-pointer hover:bg-muted/80 transition-colors duration-micro';
