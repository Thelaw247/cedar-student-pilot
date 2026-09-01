/**
 * What a failed save actually means, so the UI can say the right thing.
 *
 * "Try again" is the wrong button for most failures, and for a provider rate
 * limit it is actively harmful: the quota is per hour, so retrying eleven
 * seconds later spends more of the quota you are already out of. That is what
 * turned one failure into two on 1 Sep. Each kind carries whether retrying now
 * makes sense and, when it does not, what the student should do instead.
 *
 * Pure, shared with the iOS app: the same messages come back from the same
 * server, and the native island will need the same classification.
 */

export const SAVE_ERROR = {
  RATE_LIMITED: 'rate_limited',   // provider quota; audio is safe, wait
  OUT_OF_CREDITS: 'out_of_credits',
  TOO_LARGE: 'too_large',         // over the 24 MB / 6 h caps; will never succeed
  NETWORK: 'network',             // never reached the server; retry is sensible
  UNKNOWN: 'unknown',
};

export function classifySaveError(error) {
  const status = Number(error?.response?.status || error?.status || 0);
  const text = String(
    error?.response?.data?.message || error?.response?.data?.error || error?.message || '',
  );
  const lower = text.toLowerCase();

  if (status === 402 || /not enough credits|insufficient credits/.test(lower)) {
    return { kind: SAVE_ERROR.OUT_OF_CREDITS, retryNow: false, message: text };
  }

  // Groq's quota error is a 413 with "per hour" in the body; a generic 429 is
  // the same situation from any provider. Both are the server relaying an
  // upstream limit, and both clear on their own.
  if (status === 429 || /rate limit|per hour|asph|too many requests/.test(lower)) {
    return { kind: SAVE_ERROR.RATE_LIMITED, retryNow: false, message: text };
  }

  // The server's own caps. A recording over them will fail identically every
  // time; "try again" would be a lie.
  if (status === 413 || /24 mb|six hours|too large|exceeded the safe upload/.test(lower)) {
    return { kind: SAVE_ERROR.TOO_LARGE, retryNow: false, message: text };
  }

  if (/failed to fetch|network|load failed|timed? ?out|econnreset/.test(lower) || status === 0) {
    return { kind: SAVE_ERROR.NETWORK, retryNow: true, message: text };
  }

  return { kind: SAVE_ERROR.UNKNOWN, retryNow: true, message: text };
}

/** The headline and the sentence under it, per kind. */
export function describeSaveError(classified) {
  switch (classified.kind) {
    case SAVE_ERROR.RATE_LIMITED:
      return {
        title: 'Saved — transcription is queued',
        body: 'Your recording is uploaded and safe. The transcription service is rate-limited for the next hour, so this one will need to be processed a little later. You can start another recording now.',
      };
    case SAVE_ERROR.OUT_OF_CREDITS:
      return {
        title: 'Saved — needs credits to process',
        body: 'Your recording is uploaded and safe. Processing it needs more credits than you have. Top up, or process it later.',
      };
    case SAVE_ERROR.TOO_LARGE:
      return {
        title: "This recording can't be processed",
        body: classified.message || 'It is over the size limit. Trying again will not change that.',
      };
    case SAVE_ERROR.NETWORK:
      return {
        title: "Couldn't reach the server",
        body: 'Your audio is safe on this device — nothing was lost. Check your connection and try again.',
      };
    default:
      return {
        title: "Couldn't save the recording",
        body: `Your audio is safe on this device — nothing was lost. ${classified.message || 'Please try again.'}`,
      };
  }
}
