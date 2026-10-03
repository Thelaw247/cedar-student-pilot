import crypto from 'node:crypto';

/**
 * One answer for a paid request sent twice.
 *
 * A double tap, a click retried before the first one answered, the same
 * screen open in two tabs: an identical paid request arriving while the first
 * was still running ran again, and charged again, because each run settles
 * its own credits. For some features it also did the work twice: two
 * missed-lecture summaries, two sets of study sessions, two copies of an
 * uploaded handout. The buttons disable themselves while they wait, but that
 * is the client's promise, and the server is the one that charges.
 *
 * gateFeature asks here first. The first request with a given user, feature
 * and body runs. An identical one that arrives while it is in flight waits
 * for it and is sent the same answer, without running and without being
 * charged. Once the first has answered, the same request runs normally:
 * asking again after an answer is not a double tap.
 *
 * In memory, so per instance. The API runs as one instance; with more, a
 * duplicate that lands on another one runs as it always did.
 */
const inFlight = new Map();

function requestKey(userId, feature, body) {
  const digest = crypto.createHash('sha256').update(JSON.stringify(body ?? null)).digest('base64url');
  return `${userId}:${feature}:${digest}`;
}

/**
 * True when this request duplicated one in flight and has already been
 * answered with that one's response; the caller stops there. Otherwise this
 * request is registered as the one running, and whatever it answers with is
 * the answer for any duplicate.
 */
export async function answeredAsDuplicate(userId, feature, res) {
  // Nothing to compare without the request (a script or a test calling the
  // gate directly): run as before.
  if (!res?.req || typeof res.once !== 'function') return false;
  // The student may already have gone (closed the tab while the route was
  // still reading): 'close' has fired and will not fire again, so nothing
  // would ever clear an entry made now, and every later tap would be sent
  // this abandoned run's answer. It runs on its own instead.
  if (res.destroyed || res.writableEnded || res.socket?.destroyed) return false;
  const key = requestKey(userId, feature, res.req.body);

  for (;;) {
    const running = inFlight.get(key);
    if (!running) break;
    const answer = await running;
    if (answer) {
      if (!res.headersSent) res.status(answer.status).json(answer.body);
      return true;
    }
    // The first request's connection closed before it answered: this one
    // runs in its place. Looped because another waiter may have taken over.
  }

  let settle;
  const answer = new Promise((resolve) => { settle = resolve; });
  const release = () => { if (inFlight.get(key) === answer) inFlight.delete(key); };
  inFlight.set(key, answer);
  const json = res.json.bind(res);
  res.json = (payload) => {
    // Whoever is already waiting gets this; anyone after it runs afresh.
    settle({ status: res.statusCode, body: payload });
    release();
    return json(payload);
  };
  // 'close' follows every response, and a dropped connection too: a waiter
  // whose first request never answered runs in its place.
  res.once('close', () => {
    settle(null);
    release();
  });
  return false;
}
