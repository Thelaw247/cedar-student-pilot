import { useEffect } from 'react';

/**
 * Global keyboard shortcuts hook.
 * Dispatches custom events that components can listen for.
 * Shortcuts: N (new event), R (record), / (search), ? (help), Esc (handled by modals)
 */
/** @param {{onNewEvent?: () => void, onRecord?: () => void, onSearch?: () => void, onHelp?: () => void}} options */
export function useKeyboardShortcuts({ onNewEvent, onRecord, onSearch, onHelp } = {}) {
  useEffect(() => {
    const handler = (e) => {
      // Ignore when typing in inputs, textareas, or contentEditable
      const tag = e.target.tagName;
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;
      if (isEditable && e.key !== 'Escape') return;

      // ⌘K / Ctrl+K is handled by CommandPalette already
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') return;

      switch (e.key) {
        case 'n': case 'N':
          if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); onNewEvent?.(); }
          break;
        case 'r': case 'R':
          if (!e.metaKey && !e.ctrlKey) { e.preventDefault(); onRecord?.(); }
          break;
        case '/':
          e.preventDefault(); onSearch?.();
          break;
        case '?':
          e.preventDefault(); onHelp?.();
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onNewEvent, onRecord, onSearch, onHelp]);
}
