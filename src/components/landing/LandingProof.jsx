import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock3, CreditCard, LogOut, Mic, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { proofLine } from '@/lib/proof';
import { TIERS } from '@/lib/tiers';
import { FOUNDER } from '@/lib/founder';

/**
 * The fact strip directly under the hero: the slot a study app usually
 * fills with a user count or a wall of university logos. Praelecta has no
 * such number yet, and will not invent one; what it has are four facts a
 * student can check against the product in five minutes. The hours come
 * from the recorder's ceiling (MAX_TOTAL_SECONDS in recording/
 * RecordingContext.jsx, held equal by a test), the prices from tiers.js.
 */
export const PROOF_FACTS = [
  { icon: Clock3, text: 'Records up to 6 hours' },
  { icon: Mic, text: 'Two full lectures free, no card' },
  { icon: CreditCard, text: `$${TIERS.student.semester.toFixed(2)} CAD for the whole semester` },
  { icon: LogOut, text: 'Cancel in one tap' },
];

export function ProofFacts({ className = '' }) {
  return (
    <ul className={`grid grid-cols-2 gap-px overflow-hidden rounded-[22px] border border-border bg-border lg:grid-cols-4 ${className}`} aria-label="Four things you can check">
      {PROOF_FACTS.map((f) => (
        <li key={f.text} className="flex items-center justify-center gap-2.5 bg-card/80 px-4 py-4 text-center text-sm font-semibold text-foreground/85">
          <f.icon className="h-4 w-4 flex-none text-primary" aria-hidden="true" />
          {f.text}
        </li>
      ))}
    </ul>
  );
}

/** The strip as a homepage section, between the hero and How it works. */
export function LandingFacts() {
  return (
    <section id="facts" className="px-4 pb-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <ProofFacts />
      </div>
    </section>
  );
}

/**
 * The person, at the final call to action. A first-year at the University of
 * Saskatchewan is a proof no other study app can copy, and the last line
 * before the footer is where a visitor who has read the page wants to know
 * who made it. The photo is FOUNDER.photo when the file exists and the
 * initials until it does, the same fallback the About page uses — never a
 * broken image.
 */
export function FounderLine({ className = '' }) {
  const [missing, setMissing] = useState(false);
  return (
    <Link to="/about" className={`group inline-flex items-center gap-3 rounded-full border border-border bg-card/70 py-1.5 pl-1.5 pr-4 text-left transition-colors hover:bg-card ${className}`}>
      {missing || !FOUNDER.photo
        ? <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary" aria-hidden="true">{FOUNDER.initials}</span>
        : <img src={FOUNDER.photo} alt="" onError={() => setMissing(true)} className="h-8 w-8 flex-none rounded-full object-cover" />}
      <span className="text-xs leading-4 text-muted-foreground">
        Built by <span className="font-semibold text-foreground">{FOUNDER.name}</span>, a first-year engineering student at the University of Saskatchewan, because he couldn&rsquo;t listen and take notes at the same time.
        <span className="ml-1 font-semibold text-primary group-hover:text-foreground">About →</span>
      </span>
    </Link>
  );
}

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
