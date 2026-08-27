import React from 'react';
import { DECAY_STATES } from '@/lib/conceptDecay';

export default function FreshnessBadge({ decayState, compact = false }) {
  if (!decayState || decayState.state === 'unreviewed') {
    if (compact) return null;
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${DECAY_STATES.unreviewed.bgClass} ${DECAY_STATES.unreviewed.textClass}`}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: DECAY_STATES.unreviewed.color }} />
        Unreviewed
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${decayState.bgClass} ${decayState.textClass}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: decayState.color }} />
      {decayState.label}
    </span>
  );
}
