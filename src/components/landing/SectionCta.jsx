import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

/**
 * The button at the end of a homepage section, worded as the result the
 * visitor is after ("Record your first lecture free"), with the free tier
 * restated beside it.
 *
 * From the 28 Sep 2026 audit: the two competitors put a call to action under
 * every section; praelecta.ca had one at the top and one at the bottom with
 * about two thousand words between them. Same button everywhere (.auth-cta),
 * same destination, so the page reads as one offer made several times rather
 * than several offers.
 */
export default function SectionCta({ label = 'Start free', note = 'Two full lectures free, no card.', to = '/register', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 sm:flex-row ${className}`}>
      <Link to={to} className="auth-cta inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-primary-foreground sm:w-auto">
        {label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
      {note && <p className="text-xs font-medium text-muted-foreground">{note}</p>}
    </div>
  );
}
