import React, { useState, useRef, useEffect } from 'react';
import { X, Loader2, AlertTriangle } from 'lucide-react';

/**
 * Small red ✕ in the corner of a card, with a two-step inline confirm.
 *
 * Used for deleting an exam/assignment (which takes its study sessions with
 * it) and for deleting a single study session. Matches the two-step
 * destructive-action pattern already used elsewhere in the app — nothing is
 * removed on the first click.
 *
 * The parent element must be `relative` for the default absolute positioning.
 *
 * @param {{
 *   onDelete: () => Promise<void>,
 *   confirmText: string,
 *   confirmLabel?: string,
 *   className?: string,
 *   ariaLabel?: string,
 * }} props
 */
export default function DeleteXButton({
  onDelete,
  confirmText,
  confirmLabel = 'Delete',
  className = 'absolute top-2 right-2',
  ariaLabel = 'Delete',
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const wrapRef = useRef(null);
  const xRef = useRef(null);
  const cancelRef = useRef(null);

  // Backing out puts the keyboard back on the ✕, instead of on the page body
  // once the panel holding the focused button unmounts.
  const backOut = () => {
    setConfirming(false);
    setError(null);
    xRef.current?.focus();
  };

  // Opening the confirm puts the keyboard on Cancel, the safe choice.
  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  // Clicking elsewhere or pressing Escape backs out of the confirm.
  useEffect(() => {
    if (!confirming) return;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setConfirming(false);
        setError(null);
      }
    };
    // preventDefault marks this Escape as handled. The edit modal this sits in
    // closes on Escape too (useEscapeKey), and skips one already handled, so
    // backing out of the confirm no longer also throws away the open modal.
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); backOut(); }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [confirming]);

  const handleDelete = async (e) => {
    e.stopPropagation();
    setDeleting(true);
    setError(null);
    try {
      await onDelete();
      // On success the row usually unmounts, so no state reset needed.
    } catch {
      setError('Could not delete. Try again.');
      setDeleting(false);
    }
  };

  return (
    <div ref={wrapRef} className={`${className} z-20`} onClick={e => e.stopPropagation()}>
      {/* The ✕ always stays in the layout; the confirm panel overlays it, so
          opening the confirm never reflows the card behind it. */}
      <button
        ref={xRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={confirming}
        onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
        className={`w-6 h-6 rounded-md bg-destructive/10 text-destructive border border-destructive/20
                   flex items-center justify-center hover:bg-destructive/20 hover:border-destructive/40
                   transition-colors flex-shrink-0 ${confirming ? 'opacity-0 pointer-events-none' : ''}`}
      >
        <X className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden="true" />
      </button>

      {confirming && (
        <div className="absolute top-0 right-0 w-56 rounded-lg border border-destructive/30 bg-card shadow-lg p-2.5 animate-fade-in">
          <div className="flex items-start gap-1.5 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive mt-px flex-shrink-0" aria-hidden="true" />
            <p className="text-[11px] leading-snug text-muted-foreground">{confirmText}</p>
          </div>
          {error && <p role="alert" className="text-[11px] text-destructive mb-2">{error}</p>}
          <div className="flex gap-1.5">
            <button
              ref={cancelRef}
              type="button"
              onClick={(e) => { e.stopPropagation(); backOut(); }}
              disabled={deleting}
              className="flex-1 py-1.5 rounded-md border border-border text-[11px] font-medium
                         text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 py-1.5 rounded-md bg-destructive text-destructive-foreground text-[11px]
                         font-medium hover:bg-destructive/90 disabled:opacity-50
                         inline-flex items-center justify-center gap-1"
            >
              {deleting ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> : <X className="w-3 h-3" aria-hidden="true" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
