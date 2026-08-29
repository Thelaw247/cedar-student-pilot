import React from 'react';
import { Lock } from 'lucide-react';
import { useUpgrade } from './UpgradeContext';

/**
 * The tasteful tease (MON-04 §3): a locked feature stays visible, and where
 * real output exists it is shown blurred — the student's own value sells the
 * upgrade, a stock promo never could. Render the preview as children; without
 * children it falls back to a value-copy card. Never used to gate work
 * retroactively.
 */
export default function LockedFeature({
  title,
  description,
  source = 'generic',
  requiredTierName = 'Student',
  ctaLabel = 'See plans',
  children,
  className = '',
}) {
  const { openUpgrade } = useUpgrade();

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-border bg-card ${className}`}>
      {children && (
        <div className="pointer-events-none select-none blur-[6px] opacity-60 max-h-72 min-h-[128px] overflow-hidden" aria-hidden="true">
          {children}
        </div>
      )}
      {/* The panel sits in normal flow and overlaps the preview's bottom with
          a negative margin, so it can never be taller than its box and clip —
          the absolutely-positioned version cut the copy off whenever the
          preview was shorter than the pitch (seen on the Handbook tab). */}
      <div className={children ? 'relative -mt-24 bg-gradient-to-t from-card via-card/90 to-transparent pt-12' : ''}>
        <div className="p-5 w-full">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold mb-2">
            <Lock className="w-3 h-3" strokeWidth={2.5} /> {requiredTierName} and up
          </span>
          <h3 className="font-heading text-base font-semibold text-foreground">{title}</h3>
          {description && <p className="text-sm text-muted-foreground mt-1 mb-3">{description}</p>}
          <button
            type="button"
            onClick={() => openUpgrade({ source })}
            className="inline-flex items-center px-4 py-2 rounded-button bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-micro"
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
