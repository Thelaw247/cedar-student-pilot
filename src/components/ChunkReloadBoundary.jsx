import React from 'react';

/**
 * Recover from a stale bundle after a deploy.
 *
 * Every route in this app is a React.lazy(() => import(...)) chunk. When a new
 * build ships, the index.html a student already has open still references the
 * OLD chunk filenames, and the CDN no longer serves them. The next time they
 * navigate to a route whose chunk changed, the dynamic import rejects — and a
 * rejected import is an ERROR, not a Suspense pending state, so with no error
 * boundary the whole route tree unmounts to a blank screen. Pressing refresh
 * loads the new index.html with the new chunk map and it works again. That is
 * exactly the "some pages don't load until I refresh" report — and the same
 * stale bundle is why a browser tab kept running an old AttendancePrompt hours
 * after its fix had deployed.
 *
 * The fix is to notice a chunk-load failure and reload once, automatically, so
 * the student never sees the blank page. Guarded against a reload loop: a
 * chunk that is genuinely, permanently missing (not merely stale) must not
 * reload forever. We remember the last reload in sessionStorage and, if we
 * just tried within RELOAD_WINDOW_MS, stop and render a plain "reload" prompt
 * instead of thrashing.
 *
 * Vite also fires a `vite:preloadError` on the window when a modulepreload
 * fails; App wires that to reloadOnceForChunkError() too, so a failed prefetch
 * is caught before the student even clicks.
 */

const RELOAD_KEY = 'cedar-chunk-reload-at';
const RELOAD_WINDOW_MS = 12_000;

// A dynamic import failure looks different across browsers; match the shapes
// all of them use rather than any single message.
export function isChunkLoadError(error) {
  const message = String(error?.message || error || '');
  const name = String(error?.name || '');
  return (
    name === 'ChunkLoadError'
    || /Loading chunk [\w-]+ failed/i.test(message)
    || /Loading CSS chunk/i.test(message)
    || /Failed to fetch dynamically imported module/i.test(message)
    || /error loading dynamically imported module/i.test(message)
    || /Importing a module script failed/i.test(message)
  );
}

/**
 * Reload the page once for a stale-chunk error. Returns true if it triggered a
 * reload, false if it refused because it just reloaded (the loop guard).
 */
export function reloadOnceForChunkError() {
  let last;
  try {
    last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_WINDOW_MS) return false; // just tried — don't loop
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Storage unavailable (private mode) means no loop guard, and an
    // auto-reload with no guard against a permanently-missing chunk is exactly
    // the infinite loop to avoid. Refuse the auto-reload and let the boundary
    // show its manual "Reload" prompt instead — one deliberate tap, no loop.
    return false;
  }
  window.location.reload();
  return true;
}

export default class ChunkReloadBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError(error) {
    // Only claim errors we know how to fix. Anything else is re-thrown in
    // render so a real error is not swallowed as a spurious reload prompt.
    return { failed: true, chunk: isChunkLoadError(error), error };
  }

  componentDidCatch(error) {
    if (isChunkLoadError(error)) {
      // If this returns false the guard tripped — a reload just happened and
      // did not help, so we fall through to the manual prompt below.
      reloadOnceForChunkError();
    }
  }

  render() {
    if (this.state.failed) {
      if (!this.state.chunk) throw this.state.error; // not ours — let it surface
      // Shown only when the auto-reload was suppressed by the loop guard.
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
          <p className="text-sm text-muted-foreground max-w-xs">
            A new version of Praelecta is available. Reload to continue.
          </p>
          <button
            type="button"
            onClick={() => { try { sessionStorage.removeItem(RELOAD_KEY); } catch { /* ignore */ } window.location.reload(); }}
            className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
