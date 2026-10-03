import { useEffect } from 'react';

// How much of the screen has to disappear before it counts as the keyboard
// rather than the browser's toolbar sliding away (about 60px on a phone).
const KEYBOARD_MIN_PX = 120;

const TEXT_INPUT_TYPES = new Set(['', 'text', 'search', 'email', 'url', 'tel', 'password', 'number', 'date', 'time', 'datetime-local', 'month', 'week']);

/** A field that brings up the on-screen keyboard (or a picker in its place). */
export function isTypingTarget(el) {
  if (!el || el.disabled || el.readOnly) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return tag === 'INPUT' && TEXT_INPUT_TYPES.has(String(el.getAttribute('type') || '').toLowerCase());
}

/**
 * Whether the keyboard is up, and the part of the screen it leaves visible.
 * Pure, so it can be tested without a phone.
 *
 * `fullHeight` is the tallest the window has been at this width: on the
 * phones that shrink the window for the keyboard rather than covering it
 * (Firefox on Android, Chrome when asked to), innerHeight drops with it, so
 * innerHeight alone would never see the keyboard there.
 */
export function keyboardState({ fullHeight, innerHeight, viewport, typing }) {
  if (!viewport || !typing || viewport.scale > 1.05) return { open: false };
  const covered = fullHeight - viewport.height;
  if (covered < KEYBOARD_MIN_PX) return { open: false };
  return {
    open: true,
    top: Math.max(0, Math.round(viewport.offsetTop)),
    height: Math.round(viewport.height),
    // How far above the bottom of the layout the visible part ends.
    inset: Math.max(0, Math.round(innerHeight - viewport.height - viewport.offsetTop)),
  };
}

/**
 * Keeps the field being typed in above the on-screen keyboard.
 *
 * A phone opens the keyboard over the page rather than shrinking it (Safari
 * always; Chrome on Android since 108). Whatever is fixed to the bottom of the
 * screen stays where it was, under the keyboard: the lower fields of a form
 * sheet and its Save button, the recording island's note. Safari tries to
 * scroll a focused field into view, and inside a fixed sheet it often can't.
 *
 * This watches the part of the screen still visible (visualViewport) and,
 * while the keyboard is up, puts `keyboard-open` on <html> with that area as
 * --visible-top, --visible-height and --keyboard-inset. index.css fits form
 * sheets (.sheet-overlay) and the recording island into it and hides the
 * bottom nav. When the keyboard opens, or focus moves to another field while
 * it is open, the field is scrolled into view inside its sheet. Mounted once,
 * in Layout.
 */
export function useOnScreenKeyboard() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;
    const root = document.documentElement;
    let fullHeight = window.innerHeight;
    let fullWidth = window.innerWidth;
    let wasOpen = false;
    let lastField = null;
    let frame = 0;

    const update = () => {
      frame = 0;
      if (window.innerWidth !== fullWidth) { fullWidth = window.innerWidth; fullHeight = window.innerHeight; }
      fullHeight = Math.max(fullHeight, window.innerHeight);
      const field = document.activeElement;
      const state = keyboardState({ fullHeight, innerHeight: window.innerHeight, viewport, typing: isTypingTarget(field) });
      root.classList.toggle('keyboard-open', state.open);
      if (state.open) {
        root.style.setProperty('--visible-top', `${state.top}px`);
        root.style.setProperty('--visible-height', `${state.height}px`);
        root.style.setProperty('--keyboard-inset', `${state.inset}px`);
        // Only when the keyboard opens or the field changes: scrolling the
        // page while typing must not be pulled back every frame.
        if (!wasOpen || field !== lastField) {
          requestAnimationFrame(() => field?.scrollIntoView?.({ block: 'nearest' }));
        }
      } else {
        root.style.removeProperty('--visible-top');
        root.style.removeProperty('--visible-height');
        root.style.removeProperty('--keyboard-inset');
      }
      wasOpen = state.open;
      lastField = state.open ? field : null;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };

    viewport.addEventListener('resize', schedule);
    viewport.addEventListener('scroll', schedule);
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', schedule);
    return () => {
      viewport.removeEventListener('resize', schedule);
      viewport.removeEventListener('scroll', schedule);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', schedule);
      if (frame) cancelAnimationFrame(frame);
      root.classList.remove('keyboard-open');
    };
  }, []);
}
