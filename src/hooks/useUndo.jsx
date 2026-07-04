import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Undo2, X } from 'lucide-react';

/**
 * Undo system — shows a toast after a destructive action with an Undo button.
 * Usage: const { showUndo } = useUndo(); showUndo('Lecture deleted', () => restoreLecture());
 */
export function useUndo() {
  const [toast, setToast] = useState(null);
  const timeoutRef = useRef(null);

  const dismiss = useCallback(() => {
    setToast(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const undoCallbackRef = useRef(null);

  const showUndo = useCallback((message, onUndo, duration = 6000) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    undoCallbackRef.current = onUndo;
    setToast({ message, id: Date.now() });
    timeoutRef.current = setTimeout(() => {
      setToast(null);
      undoCallbackRef.current = null;
    }, duration);
  }, []);

  const handleUndo = useCallback(() => {
    if (undoCallbackRef.current) undoCallbackRef.current();
    dismiss();
  }, [dismiss]);

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  return { toast, showUndo, handleUndo, dismiss };
}

export function UndoToast({ toast, onUndo, onDismiss }) {
  if (!toast) return null;
  return (
    <div className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-[55] animate-fade-in">
      <div className="flex items-center gap-3 bg-foreground text-background px-4 py-2.5 rounded-notification shadow-3">
        <span className="text-sm font-medium">{toast.message}</span>
        <button
          onClick={onUndo}
          className="flex items-center gap-1 text-sm font-semibold text-primary-foreground/90 hover:text-primary-foreground underline underline-offset-2"
        >
          <Undo2 className="w-3.5 h-3.5" /> Undo
        </button>
        <button onClick={onDismiss} className="text-background/60 hover:text-background ml-1">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}