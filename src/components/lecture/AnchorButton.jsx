import React from 'react';
import { Quote } from 'lucide-react';
import { hasAnchor } from './lectureStudy';

/**
 * "Show in transcript" — the link from any study item back to the exact
 * moment in the recording. Only renders when the server actually resolved
 * the model's quote to a transcript offset, so it never jumps somewhere
 * wrong (see lectureEnrichment.js: an unresolved anchor has offset -1).
 */
export default function AnchorButton({ item, onJump, label = 'Show in transcript', className = '' }) {
  if (!hasAnchor(item)) return null;
  return (
    <button
      type="button"
      onClick={() => onJump?.(item.anchor)}
      title={`“${item.anchor.quote}”`}
      className={`inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline ${className}`}
    >
      <Quote className="w-3 h-3" /> {label}
    </button>
  );
}
