import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Shared credit-balance store.
 *
 * The credit meter, the upgrade sheet and any gated surface all need the same
 * CreditBalance row, so this hook keeps one module-level copy and one
 * in-flight request no matter how many components subscribe. It refreshes on
 * the app's existing 'cedar-data-changed' event (fired after syncs) and on
 * window focus, so the meter stays honest after a purchase or a processed
 * lecture without any component wiring.
 */
let cached = null;
let inflight = null;
const listeners = new Set();

function fetchBalance() {
  if (!inflight) {
    inflight = base44.entities.CreditBalance.list()
      .then((rows) => {
        cached = rows?.[0] || null;
        inflight = null;
        listeners.forEach((l) => l(cached));
        return cached;
      })
      .catch((error) => {
        inflight = null;
        throw error;
      });
  }
  return inflight;
}

export function availableCredits(balance) {
  return (balance?.subscription_credits || 0) + (balance?.purchased_credits || 0);
}

export function useBalance() {
  const [balance, setBalance] = useState(cached);
  const [loading, setLoading] = useState(!cached);

  const refresh = useCallback(() => {
    fetchBalance().catch(() => { /* transient — the last known value stands */ });
  }, []);

  useEffect(() => {
    const listener = (b) => { setBalance(b); setLoading(false); };
    listeners.add(listener);
    if (cached) setLoading(false);
    else fetchBalance().catch(() => setLoading(false));
    window.addEventListener('cedar-data-changed', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      listeners.delete(listener);
      window.removeEventListener('cedar-data-changed', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  return {
    balance,
    available: availableCredits(balance),
    tier: balance?.tier || 'free',
    loading,
    refresh,
  };
}
