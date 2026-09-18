import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { proofLine } from '@/lib/proof';

/**
 * Proof that real people use this, in real numbers.
 *
 * Reads GET /public/stats: how many students have an account and how many
 * lectures they have recorded. Praelecta is weeks old, so the count is small
 * and is framed as what it is — early students, not a crowd — rather than
 * inflated or hidden. When the API is unreachable the line still renders,
 * without the figures; nothing here is load-bearing.
 */
export default function LandingProof({ className = '' }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (typeof base44?.functions?.get !== 'function') return undefined;
    base44.functions.get('/public/stats')
      .then((res) => { if (!cancelled && res?.data) setStats(res.data); })
      .catch(() => { /* the line renders without numbers */ });
    return () => { cancelled = true; };
  }, []);

  return (
    <p className={`inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground ${className}`}>
      <Users className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
      <span>{proofLine(stats)}</span>
    </p>
  );
}
