import React from 'react';
import { Loader2, Check, AlertCircle } from 'lucide-react';

/**
 * Quiet status line for autosaving surfaces — the replacement for a Save
 * button. Stays out of the way while idle so the UI doesn't flicker on every
 * keystroke, and only speaks up while writing, on success, or on failure.
 *
 * status: 'idle' | 'saving' | 'saved' | 'error'
 */
export default function AutosaveIndicator({ status, className = '' }) {
  if (status === 'idle') {
    return <span className={`text-[11px] text-muted-foreground/60 ${className}`}>Changes save automatically</span>;
  }
  if (status === 'saving') {
    return (
      <span className={`inline-flex items-center gap-1.5 text-[11px] text-muted-foreground ${className}`}>
        <Loader2 className="w-3 h-3 animate-spin" /> Saving…
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span className={`inline-flex items-center gap-1.5 text-[11px] text-emerald-600 ${className}`}>
        <Check className="w-3 h-3" /> Saved
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] text-destructive ${className}`}>
      <AlertCircle className="w-3 h-3" /> Couldn’t save — check your connection
    </span>
  );
}
