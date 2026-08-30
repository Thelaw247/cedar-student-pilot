import { base44 } from '@/api/base44Client';

/**
 * Fire-and-forget product telemetry (MON-04 Phase D). First-party only —
 * events go to Praelecta's own API, never a third party. Event names are
 * whitelisted server-side; meta is short scalars only. A failed or blocked
 * call is silently ignored: telemetry must never change what the user
 * feels, block a click, or throw into UI code.
 */
export function track(event, meta = undefined) {
  try {
    base44.functions.invoke('trackEvent', meta ? { event, meta } : { event }).catch(() => {});
  } catch { /* never let telemetry surface */ }
}
