import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isReviewEligible, REVIEW_SNOOZE_DAYS } from '@/lib/reviews';
import ReviewForm from '@/components/ReviewForm';
import { Check, Star } from 'lucide-react';

/**
 * The in-app ask for a review: a quiet card on Today, after the day's
 * schedule, among the other questions the app has for the student.
 *
 * A card, not a pop-up: a dialog would be a demand, not a request.
 * Shown to a current student — one with a processed lecture, or a week in
 * the app (shared/reviews.js) — who has neither reviewed nor declined, and
 * never to the founder. Three answers, all one tap: rate it now, not now
 * (two weeks, on this device), or don't ask again (stored, so the question
 * does not follow them to another device).
 */

const SNOOZE_KEY = 'praelecta-review-asked-later';
const DAY_MS = 24 * 60 * 60 * 1000;
const snoozed = () => {
  try { return Number(localStorage.getItem(SNOOZE_KEY) || 0) > Date.now(); } catch { return false; }
};
const snooze = () => {
  try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + REVIEW_SNOOZE_DAYS * DAY_MS)); } catch { /* private mode: hidden for this visit only */ }
};

export default function ReviewPrompt({ lectures = [] }) {
  const { user } = useAuth();
  const [state, setState] = useState('hidden'); // hidden | ask | thanks
  const [published, setPublished] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [declining, setDeclining] = useState(false);

  const eligible = !!user && isReviewEligible({ lectures, accountCreatedAt: user.created_at, role: user.role });

  useEffect(() => {
    if (!eligible || snoozed()) return undefined;
    let cancelled = false;
    // RLS returns the student's own row only: one review per student.
    base44.entities.AppReview.list(null, 1)
      .then((rows) => { if (!cancelled && !rows?.length) setState('ask'); })
      .catch(() => { /* a failed read never turns into a nag */ });
    return () => { cancelled = true; };
  }, [eligible]);

  const notNow = () => {
    snooze();
    setState('hidden');
  };

  const dontAskAgain = async () => {
    if (declining) return;
    setDeclining(true);
    try {
      await base44.entities.AppReview.create({ declined: true });
    } catch (e) {
      // Not stored: at least do not ask again on this device for a while.
      console.error('[review] could not store the decline:', e?.message || e);
      snooze();
    }
    setState('hidden');
  };

  const onSaved = (row) => {
    setFormOpen(false);
    setPublished(!!row?.may_publish);
    setState('thanks');
  };

  if (state === 'hidden') return null;

  if (state === 'thanks') {
    return (
      <div role="status" className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 animate-fade-in">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
          <Check className="h-4 w-4 text-emerald-500" aria-hidden="true" />
        </div>
        <p className="text-sm text-foreground">
          Thank you. That helps other students decide.{' '}
          <span className="text-muted-foreground">
            {published ? 'It will appear on praelecta.ca once it has been checked.' : 'Your rating counts toward the average on praelecta.ca.'} You can change it any time in Settings.
          </span>
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 animate-fade-in">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-400/15">
          <Star className="h-4 w-4 fill-amber-400 text-amber-500" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Would you do a quick review of Praelecta?</p>
          <p className="mt-0.5 text-xs text-muted-foreground">A star rating and a sentence or two, under a minute. It helps other students decide whether to try it.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setFormOpen(true)}
              className="min-h-[40px] rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90">
              Rate Praelecta
            </button>
            <button type="button" onClick={notNow}
              className="min-h-[40px] rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted">
              Not now
            </button>
            <button type="button" onClick={dontAskAgain} disabled={declining}
              className="min-h-[40px] px-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
              Don&rsquo;t ask again
            </button>
          </div>
        </div>
      </div>
      {formOpen && <ReviewForm fullName={user?.full_name} onClose={() => setFormOpen(false)} onSaved={onSaved} />}
    </>
  );
}
