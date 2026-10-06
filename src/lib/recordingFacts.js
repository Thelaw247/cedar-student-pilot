/**
 * The two facts the recording telemetry reports (recording/RecordingContext,
 * `saveFacts`), kept pure so the tests can run them.
 *
 * A save that fails on the device leaves nothing on the server. In Oct 2026
 * one student's every save had failed for three weeks and the only trace was
 * the absence of lecture rows; the cause (Safari recording AAC at six times
 * the bitrate the segment cap assumed) could be read off two numbers that
 * were never recorded: what the device was, and the bitrate it recorded at.
 * These are those two numbers, as short scalars and nothing more.
 */

/**
 * What the device is, in one word. Never the whole user agent: a short token
 * is all a count needs ("how many iPhone saves failed this week"), and the
 * server keeps telemetry meta to short scalars anyway.
 */
export function devicePlatform(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  const s = String(ua || '');
  if (/iPhone|iPad|iPod/.test(s)) return 'ios';
  if (/Macintosh/.test(s)) return 'mac';
  if (/Android/.test(s)) return 'android';
  if (/Windows/.test(s)) return 'windows';
  return 'other';
}

/**
 * The measured bitrate of what was captured, in kbps, or null until there is
 * something to measure. This is the number the telemetry exists for: it says
 * what the browser actually recorded at, which no option we pass guarantees.
 */
export function measuredKbps(bytes, seconds) {
  if (!(bytes > 0) || !(seconds > 0)) return null;
  return Math.round((bytes * 8) / seconds / 1000);
}
