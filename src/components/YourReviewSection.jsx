import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { reviewStatus } from '@/lib/reviews';
import ReviewForm from '@/components/ReviewForm';
import Stars from '@/components/ui/Stars';
import { Star } from 'lucide-react';

/**
 * Settings → Your review: where a student sees what became of their review
 * and changes their mind — edit the words, untick "show on praelecta.ca"
 * (it comes off the site at once), or delete it. Also the way to leave one
 * for someone who said "Don't ask again" on Today.
 */

const STATUS = {
  none: 'You have not rated Praelecta yet.',
  declined: 'You asked not to be reminded. You can still leave a rating whenever you like.',
  private: 'Private: your rating counts toward the average on praelecta.ca, and your words are not shown.',
  pending: 'Waiting for a quick check before it appears on praelecta.ca.',
  shown: 'Shown on praelecta.ca.',
};

export default function YourReviewSection() {
  const { user } = useAuth();
  const [row, setRow] = useState(undefined); // undefined while loading, null when there is none
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    base44.entities.AppReview.list(null, 1)
      .then((rows) => { if (!cancelled) setRow(rows?.[0] || null); })
      .catch(() => { if (!cancelled) setRow(null); });
    return () => { cancelled = true; };
  }, []);

  if (row === undefined) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const status = reviewStatus(row);
  const hasReview = status !== 'none' && status !== 'declined';

  return (
    <div>
      {hasReview && (
        <div className="mb-3 rounded-lg border border-border bg-muted/40 p-3">
          <Stars rating={row.rating} />
          {row.body && <p className="mt-2 text-sm text-foreground">&ldquo;{row.body}&rdquo;</p>}
        </div>
      )}
      <p className="text-sm text-muted-foreground">{STATUS[status]}</p>
      <button
        type="button"
        onClick={() => setFormOpen(true)}
        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
      >
        <Star className="h-4 w-4 text-amber-500" aria-hidden="true" />
        {hasReview ? 'Edit your review' : 'Rate Praelecta'}
      </button>
      {formOpen && (
        <ReviewForm
          existing={row}
          fullName={user?.full_name}
          onClose={() => setFormOpen(false)}
          onSaved={(saved) => { setRow(saved); setFormOpen(false); }}
        />
      )}
    </div>
  );
}
