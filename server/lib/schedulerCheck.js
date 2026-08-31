/**
 * Are the scheduled jobs reachable?
 *
 * Both cron routes are guarded by a shared secret — GRANT_TRIGGER_TOKEN and
 * REMINDERS_TRIGGER_TOKEN. With the variable unset the route rejects every
 * caller with 401, which is the correct behaviour and an awful failure mode:
 * whoever wires up a scheduler gets a 401 with no explanation, or worse, wires
 * it, sees a 200-shaped success in their scheduler's UI, and never checks.
 *
 * The monthly grant is the one that matters. Nothing runs it today, and when
 * something does, a missing token means subscribers silently stop receiving
 * credits after their first month — a month after the first sale, which is the
 * worst possible time to be debugging a shared secret.
 *
 * Reported at boot, alongside the Stripe and account-deletion lines, so the
 * answer is already in the log before a scheduler is pointed at it.
 */

export const TRIGGERS = [
  { env: 'GRANT_TRIGGER_TOKEN', route: '/grant-monthly-credits', what: 'monthly credit grant' },
  { env: 'REMINDERS_TRIGGER_TOKEN', route: '/send-study-reminders', what: 'study reminders' },
];

export function schedulerStatus(env = process.env) {
  const missing = TRIGGERS.filter((t) => !String(env[t.env] || '').trim());
  if (missing.length === 0) {
    return { ok: true, missing: [], message: `scheduled jobs: both trigger tokens set (${TRIGGERS.map((t) => t.route).join(', ')})` };
  }
  return {
    ok: false,
    missing: missing.map((t) => t.env),
    message: `scheduled jobs: ${missing.map((t) => `${t.env} is missing, so ${t.route} (${t.what}) will reject every scheduler with 401`).join('; ')}`,
  };
}

export function logSchedulerStatus(env = process.env, logger = console) {
  const status = schedulerStatus(env);
  if (status.ok) logger.log(`[boot] ${status.message}`);
  else logger.error(`[boot] ${status.message}`);
  return status;
}
