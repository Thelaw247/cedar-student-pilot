/**
 * Which Supabase auth events actually warrant re-checking the session.
 *
 * supabase-js re-validates its session whenever the tab regains visibility and
 * emits TOKEN_REFRESHED (and, on some versions, SIGNED_IN) even though nothing
 * about the signed-in user changed. AuthContext used to answer every event by
 * running checkUserAuth(), which flipped isLoadingAuth to true — and
 * ProtectedRoute renders a spinner instead of <Outlet /> while that flag is
 * set. The whole authenticated tree unmounted and remounted on every tab
 * switch: every page effect re-ran, every list refetched, and the app looked
 * like it had reloaded. RecordingProvider lives inside that tree, so a live
 * recording was torn down too.
 *
 * The rule is identity, not event name: re-check when the session's user is
 * different from the one already held, or when the event is one that changes
 * the user record itself. An unfamiliar future event with an unchanged user is
 * ignored, which is the safe default — the session we hold is still the one
 * Supabase just confirmed.
 */

/** Events that change the account itself, whatever the id comparison says. */
export const IDENTITY_EVENTS = new Set(['SIGNED_OUT', 'USER_UPDATED']);

/**
 * Events that are pure session bookkeeping. Listed for documentation and for
 * the tests; the identity comparison is what actually decides.
 */
export const BOOKKEEPING_EVENTS = new Set(['INITIAL_SESSION', 'TOKEN_REFRESHED']);

/**
 * @param {string} event Supabase auth event name
 * @param {string|null|undefined} nextUserId user id on the incoming session
 * @param {string|null|undefined} currentUserId user id already held
 * @returns {boolean} true when the app should re-run its auth check
 */
export function shouldRecheckAuth(event, nextUserId, currentUserId) {
  if (IDENTITY_EVENTS.has(event)) return true;
  return (nextUserId || null) !== (currentUserId || null);
}
