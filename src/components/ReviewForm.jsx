import React, { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { announceDataChange } from '@/lib/dataChanged';
import { REVIEW_LIMITS, suggestedDisplayName, validateReview } from '@/lib/reviews';
import { AlertTriangle, Loader2, Star, Trash2 } from 'lucide-react';
import { useDraft } from '@/hooks/useDraft';

/**
 * The review itself: a star rating and a short description, with an
 * optional, unticked box to show it on praelecta.ca. Opened from the card on
 * Today (ReviewPrompt) and from Settings → Your review, where `existing` is
 * the student's row and the form edits or deletes it.
 *
 * Every rating goes through the same form — there is no different path for
 * a high one and a low one — and the fine print says exactly what happens
 * to each part: the stars count toward the average, the words and the name
 * appear only with the box ticked and after a check.
 */

const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40';
const WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

/** What to tell the student when the review could not be saved. */
export function describeReviewError(e) {
  const text = String(e?.message || e?.details || '').toLowerCase();
  const status = Number(e?.status || 0);
  if (/not signed in|jwt|refresh token|invalid token|session/.test(text) || status === 401) {
    return { kind: 'signed_out', text: 'Your session has ended. Sign in again, then send this.' };
  }
  if (/failed to fetch|load failed|networkerror|network request failed|timeout/.test(text)
    || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return { kind: 'network', text: "Couldn't reach the server. Check your connection and send again — nothing is saved until it goes through." };
  }
  // The error's own text is the database's, and the caller logs it.
  return { kind: 'unknown', text: 'This could not be saved. Try again in a moment.' };
}

export default function ReviewForm({ existing = null, fullName = '', onClose, onSaved }) {
  const id = useId();
  const editing = !!existing && !existing.declined && existing.rating != null;
  // What the student has written is kept if they leave before sending it
  // (hooks/useDraft.js); closing the form or sending it lets it go.
  const draft = `review:${existing?.id || 'new'}`;
  const [rating, setRating] = useDraft(`${draft}:rating`, existing?.rating || 0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useDraft(`${draft}:body`, existing?.body || '');
  const [mayPublish, setMayPublish] = useDraft(`${draft}:may_publish`, !!existing?.may_publish);
  const [displayName, setDisplayName] = useDraft(`${draft}:display_name`, existing?.display_name || suggestedDisplayName(fullName));
  const [detail, setDetail] = useDraft(`${draft}:detail`, existing?.detail || '');
  const [school, setSchool] = useDraft(`${draft}:school`, existing?.school || '');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // 'save' | 'delete' | null
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const onStarsKey = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); setRating((r) => Math.min(5, (r || 0) + 1)); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); setRating((r) => Math.max(1, (r || 2) - 1)); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const { ok, errors: found, row } = validateReview({
      rating, body, may_publish: mayPublish, display_name: displayName, detail, school,
    });
    setErrors(found);
    if (!ok) return;
    setBusy('save');
    setError(null);
    try {
      // A student who once chose "Don't ask again" has a row already; their
      // review fills it in rather than colliding with it.
      const saved = existing
        ? await base44.entities.AppReview.update(existing.id, row)
        : await base44.entities.AppReview.create(row);
      announceDataChange(['AppReview']);
      onSaved(saved);
    } catch (err) {
      console.error('[review] could not save:', err?.message || err);
      setError(describeReviewError(err));
      setBusy(null);
    }
  };

  const remove = async () => {
    if (busy || !editing) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setBusy('delete');
    setError(null);
    try {
      await base44.entities.AppReview.delete(existing.id);
      announceDataChange(['AppReview']);
      onSaved(null);
    } catch (err) {
      console.error('[review] could not delete:', err?.message || err);
      setError(describeReviewError(err));
      setBusy(null);
    }
  };

  const shown = hover || rating;

  return (
    <div className="sheet-overlay fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 glass" onClick={() => { if (!busy) onClose(); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6 animate-fade-in max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id={`${id}-title`} className="font-heading text-lg font-semibold">{editing ? 'Your review' : 'Rate Praelecta'}</h3>
        <p className="mt-1 text-sm text-muted-foreground">Honest is more useful than nice. It takes under a minute.</p>

        <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
          <div>
            <p id={`${id}-rating`} className="text-xs font-medium text-muted-foreground">How would you rate it?</p>
            <div
              role="radiogroup"
              aria-labelledby={`${id}-rating`}
              aria-describedby={errors.rating ? `${id}-rating-error` : undefined}
              onKeyDown={onStarsKey}
              onMouseLeave={() => setHover(0)}
              className="mt-1.5 flex items-center gap-0.5"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} star${n === 1 ? '' : 's'}, ${WORDS[n]}`}
                  tabIndex={rating ? (rating === n ? 0 : -1) : (n === 1 ? 0 : -1)}
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <Star aria-hidden="true" className={`h-7 w-7 ${n <= shown ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}`} />
                </button>
              ))}
              <span className="ml-2 text-xs font-medium text-muted-foreground" aria-hidden="true">{WORDS[shown]}</span>
            </div>
            {errors.rating && <p id={`${id}-rating-error`} className="mt-1 text-xs text-destructive">{errors.rating}</p>}
          </div>

          <div>
            <label htmlFor={`${id}-body`} className="text-xs font-medium text-muted-foreground">What would you tell a friend about it?</label>
            <textarea
              id={`${id}-body`}
              rows={3}
              maxLength={REVIEW_LIMITS.body}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="A sentence or two, in your own words"
              aria-invalid={errors.body ? true : undefined}
              aria-describedby={errors.body ? `${id}-body-error` : undefined}
              className={`${inputCls} mt-1.5 resize-none`}
            />
            <div className="mt-1 flex items-start justify-between gap-3 text-[11px]">
              <span id={`${id}-body-error`} className="text-destructive">{errors.body}</span>
              <span className="tabular-nums text-muted-foreground">{body.length}/{REVIEW_LIMITS.body}</span>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-muted/40 p-3">
            <input
              type="checkbox"
              checked={mayPublish}
              onChange={(e) => setMayPublish(e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-none rounded border-input accent-primary"
            />
            <span className="text-sm">
              <span className="font-medium text-foreground">Show my review on praelecta.ca</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">With the name, course and school below. Optional: your rating helps either way.</span>
            </span>
          </label>

          {mayPublish && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor={`${id}-name`} className="text-xs font-medium text-muted-foreground">Name to show</label>
                <input id={`${id}-name`} type="text" maxLength={REVIEW_LIMITS.display_name} value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)} placeholder="First name" className={`${inputCls} mt-1.5`}
                  aria-invalid={errors.display_name ? true : undefined}
                  aria-describedby={errors.display_name ? `${id}-name-error` : undefined} />
                {errors.display_name && <p id={`${id}-name-error`} className="mt-1 text-xs text-destructive">{errors.display_name}</p>}
              </div>
              <div>
                <label htmlFor={`${id}-detail`} className="text-xs font-medium text-muted-foreground">Course or program <span className="font-normal">(optional)</span></label>
                <input id={`${id}-detail`} type="text" maxLength={REVIEW_LIMITS.detail} value={detail}
                  onChange={(e) => setDetail(e.target.value)} placeholder="e.g. PHYS 117" className={`${inputCls} mt-1.5`} />
              </div>
              <div>
                <label htmlFor={`${id}-school`} className="text-xs font-medium text-muted-foreground">School <span className="font-normal">(optional)</span></label>
                <input id={`${id}-school`} type="text" maxLength={REVIEW_LIMITS.school} value={school}
                  onChange={(e) => setSchool(e.target.value)} placeholder="e.g. University of Saskatchewan" className={`${inputCls} mt-1.5`} />
              </div>
            </div>
          )}

          <p className="text-[11px] leading-4 text-muted-foreground">
            Your star rating counts toward the average shown on praelecta.ca. Your words and name appear only if you tick the box, and only after a quick check. Change or delete this any time in Settings → Your review.
          </p>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-left text-xs leading-5 text-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-500" aria-hidden="true" />
              <span>
                {error.text}
                {error.kind === 'signed_out' && <> <Link to="/login" className="font-semibold text-primary hover:text-foreground">Sign in</Link></>}
              </span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={!!busy}
              className="flex-1 min-h-[44px] rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={!!busy} aria-busy={busy === 'save'}
              className="flex-[2] inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
              {busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {busy === 'save' ? 'Sending…' : editing ? 'Save changes' : 'Send review'}
            </button>
          </div>

          {editing && (
            <button type="button" onClick={remove} disabled={!!busy} aria-busy={busy === 'delete'}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-500 disabled:opacity-50">
              {busy === 'delete' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
              {confirmDelete ? 'Tap again to delete it everywhere' : 'Delete my review'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
