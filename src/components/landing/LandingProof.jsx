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
 *
 * PROOF_AVATARS puts faces beside the number (the 22 Sep 2026 audit, D3.1):
 * six to twelve small photos of real students who have said yes, or their
 * first names as initials while there are fewer than six photos. Empty until
 * that permission exists — nothing renders — and never filled from the
 * database: a name on the homepage is a name the student agreed to put
 * there. Shape: { name: 'Sarah', photo: '/students/sarah.jpg' } (photo optional).
 */
export const PROOF_AVATARS = [];

function ProofAvatars({ avatars }) {
  if (!avatars.length) return null;
  return (
    <ul className="flex -space-x-2" aria-label="Some of the students using Praelecta">
      {avatars.slice(0, 12).map((a) => (
        <li key={a.name} title={a.name}>
          {a.photo
            ? <img src={a.photo} alt={a.name} className="h-7 w-7 rounded-full border-2 border-card object-cover" />
            : <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-primary/15 text-[11px] font-bold text-primary" aria-label={a.name}>{a.name.slice(0, 1)}</span>}
        </li>
      ))}
    </ul>
  );
}

export default function LandingProof({ className = '', avatars = PROOF_AVATARS }) {
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
      <ProofAvatars avatars={avatars} />
      <Users className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
      <span>{proofLine(stats)}</span>
    </p>
  );
}
