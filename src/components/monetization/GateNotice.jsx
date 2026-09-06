import React from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { useUpgrade } from '@/components/monetization/UpgradeContext';
import { featureMinTierName } from '@/lib/tiers';
import { track } from '@/lib/analytics';

/**
 * A refusal a student can act on.
 *
 * The law already written on ExamPredictionCard — "paywall is never an error"
 * — held wherever the UI knew a feature was locked BEFORE the tap. It did not
 * hold on the way back: the server answers a gated call with a machine-readable
 * 402, and almost every screen caught it, pulled `message` out, threw the rest
 * away, and rendered a sentence in red. Correct, and a dead end. Twelve
 * handbook refusals were logged on one account in a single day, each one a
 * student reading "this needs Scholar" with nothing to press.
 *
 * So a refusal is a component, not a string. It says what is needed and offers
 * the one control that resolves it.
 *
 * Two shapes come back from server/lib/credits.js, and they resolve
 * differently, so they are not flattened together:
 *
 *   upgrade_required     the tier is too low. Only upgrading fixes it.
 *   insufficient_credits the tier is fine and the balance is not. Buying a
 *                        pack fixes it, and so does a bigger plan.
 */

/**
 * Read a caught error as a refusal, or null if it is an ordinary failure.
 *
 * Call this in the catch and keep what it returns. The point is to stop the
 * structure being discarded one line after it arrives — a screen holding only
 * `message` cannot offer anything, however good its copy is.
 */
export function gateFromError(error) {
  const data = error?.response?.data;
  if (!data || error?.response?.status !== 402) return null;
  if (data.error === 'upgrade_required') {
    return {
      kind: 'tier',
      feature: data.feature || null,
      requiredTierName: featureMinTierName(data.feature) || 'Student',
      message: data.message || 'This feature needs a higher plan.',
    };
  }
  if (data.error === 'insufficient_credits') {
    return {
      kind: 'credits',
      feature: data.feature || null,
      message: data.message || 'You do not have enough credits for this.',
    };
  }
  return null;
}

/**
 * @param {object} o
 * @param {ReturnType<typeof gateFromError>} o.gate  from gateFromError
 * @param {string} [o.source]  analytics label for where the refusal happened
 * @param {string} [o.className]
 */
export default function GateNotice({ gate, source = 'gate-notice', className = '' }) {
  const { openUpgrade } = useUpgrade();
  if (!gate) return null;

  const isTier = gate.kind === 'tier';
  const open = () => {
    track('feature_lock_tapped', { feature: gate.feature, source });
    openUpgrade({ source, feature: gate.feature });
  };

  return (
    <div className={`rounded-xl border border-primary/25 bg-primary/5 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          {isTier
            ? <Lock className="w-4 h-4 text-primary" />
            : <Sparkles className="w-4 h-4 text-primary" />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {isTier ? `Unlocks with ${gate.requiredTierName}` : 'Not enough credits'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{gate.message}</p>
          <button
            type="button"
            onClick={open}
            className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            {/* The credits case is also solved by a bigger plan, and the sheet
                shows both packs and plans — so one control, not a fork the
                student has to reason about mid-task. */}
            {isTier ? 'Upgrade to unlock' : 'Get more credits'}
          </button>
        </div>
      </div>
    </div>
  );
}
