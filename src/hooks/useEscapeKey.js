import { useEffect } from 'react';

/**
 * Calls onClose when Escape is pressed, for hand-rolled modals that close on
 * a backdrop click. An Escape a Radix popover or select inside the modal has
 * already handled (it calls preventDefault) is left alone, so dismissing a
 * dropdown does not also close the modal around it.
 * @param {() => void} onClose
 * @param {boolean} [enabled]
 */
export function useEscapeKey(onClose, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, enabled]);
}
