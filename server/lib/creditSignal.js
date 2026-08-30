import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request tally of credits actually spent.
 *
 * The credit meter in the client is a shared store that refreshes on the
 * 'cedar-data-changed' event. Before this, only the recording flow fired that
 * event, so every other paid action (transcript cleanup, handbooks, exam
 * prediction, study material, reviews...) left the meter showing a stale
 * number until the user reloaded or refocused the tab. Credits appearing to
 * vanish on a later reload is exactly the kind of surprise the billing rules
 * say we do not ship.
 *
 * Rather than remember to fire an event at ~15 call sites — and at every one
 * added later — the server reports what it charged. spendCredits() is the
 * single place credits move, so it records into this store; the middleware
 * turns a non-zero tally into an X-Credits-Spent response header, and the
 * client refreshes the meter whenever it sees one. A future paid route gets
 * this for free and cannot forget it.
 *
 * spendCredits also runs outside any request (the Stripe webhook, the monthly
 * grant cron). There is no store in those contexts and recordCreditsSpent is
 * a no-op, which is the correct behaviour — nobody is waiting on a header.
 */
const storage = new AsyncLocalStorage();

export const CREDITS_SPENT_HEADER = 'X-Credits-Spent';

/** Run `fn` with a fresh tally attached to the current async context. */
export function runWithCreditSignal(fn) {
  return storage.run({ spent: 0 }, fn);
}

/** Add to the current request's tally. No-op outside a request. */
export function recordCreditsSpent(amount) {
  const store = storage.getStore();
  if (!store) return;
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return;
  store.spent += value;
}

/** Credits charged so far in the current request. 0 outside a request. */
export function creditsSpent() {
  return storage.getStore()?.spent || 0;
}

/**
 * Express middleware. Runs the rest of the request inside a tally, and stamps
 * the header on the way out. res.json is patched rather than using the
 * 'finish' event because headers are already flushed by then.
 */
export function creditSignal(req, res, next) {
  runWithCreditSignal(() => {
    const json = res.json.bind(res);
    res.json = (body) => {
      const spent = creditsSpent();
      if (spent > 0 && !res.headersSent) res.set(CREDITS_SPENT_HEADER, String(spent));
      return json(body);
    };
    next();
  });
}
