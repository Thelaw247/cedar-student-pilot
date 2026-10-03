import React, { useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

// How long a toast stays up before it closes itself.
const TOAST_DURATION_MS = 5000;

/**
 * One toast. These components are plain elements, not Radix's toast, so
 * nothing closed a toast on its own: it stayed on screen until the remove
 * timer in use-toast (about 17 minutes), and its ✕ had no handler at all
 * (Oct 2026). It now closes itself after TOAST_DURATION_MS (a toast can pass
 * its own `duration`, Infinity to stay), and the ✕ closes it at once.
 */
function ToastItem({ title, description, action, onOpenChange, duration = TOAST_DURATION_MS, ...props }) {
  useEffect(() => {
    if (!Number.isFinite(duration)) return undefined;
    const timer = setTimeout(() => onOpenChange?.(false), duration);
    return () => clearTimeout(timer);
  }, [duration, onOpenChange]);

  return (
    <Toast {...props}>
      <div className="grid gap-1">
        {title && <ToastTitle>{title}</ToastTitle>}
        {description && (
          <ToastDescription>{description}</ToastDescription>
        )}
      </div>
      {action}
      <ToastClose onClick={() => onOpenChange?.(false)} />
    </Toast>
  );
}

export function Toaster() {
  const { toasts } = useToast();

  return (
    // The container is the live region: it stays mounted, and a region that
    // exists before a toast lands in it is announced reliably. Not atomic, so
    // a new toast is read on its own rather than with every one still shown.
    <ToastProvider role="status" aria-live="polite" aria-atomic="false">
      {/* A dismissed toast stays in the store, closed, until use-toast removes
          it; only open ones are drawn. `open` itself is not passed on: it is
          state, not an attribute for the element. */}
      {toasts.filter((t) => t.open !== false).map(({ id, open: _open, ...props }) => (
        <ToastItem key={id} {...props} />
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
