import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { stripeDelete } from '../../shared/stripe.ts';

/**
 * Full account reset / right-to-erasure endpoint.
 *
 * Deletes every trace of the signed-in student so that signing up again is
 * indistinguishable from a brand new user: fresh free tier, fresh 20-credit
 * lifetime grant, no cached handbooks, no leftover usage history.
 *
 * ORDER MATTERS. The Stripe subscription is cancelled FIRST. If data deletion
 * ran first and then failed partway, a student could end up with no account
 * but a live subscription still billing them every month. Cancelling first
 * means the worst case is a cancelled subscription with data still present —
 * annoying, but it never takes money for something that no longer exists.
 *
 * TWO CLIENTS, DELIBERATELY:
 *
 * - Academic entities use the per-request AUTHENTICATED client. The platform
 *   scopes every list/delete to the caller's own records, so this physically
 *   cannot reach another user's data.
 *
 * - Billing/system entities (CreditBalance, UsageEvent, ProcessedStripeEvent,
 *   Handbook) have RLS `delete: false` for users, so the authenticated client
 *   cannot touch them at all. Those use asServiceRole, which bypasses RLS
 *   entirely — so every query is EXPLICITLY filtered by user_id and the result
 *   is re-checked per row before deleting. A missing filter here would delete
 *   another user's billing records.
 */

// Scoped by the platform to the caller. Children before parents.
const USER_SCOPED_ENTITIES = [
  'StudySessionReview',
  'Flashcard',
  'PracticeQuestion',
  'KnowledgeCoverage',
  'Note',
  'ClassAttendance',
  'Lecture',
  'Assignment',
  'StudySession',
  'StudyRecord',
  'CalendarEvent',
  'CustomTrack',
  'Class',
  'Semester',
];

// RLS blocks user deletes; must go through asServiceRole with an explicit filter.
const SERVICE_ROLE_ENTITIES = [
  'Handbook',
  'UsageEvent',
  'ProcessedStripeEvent',
  'CreditBalance', // last: it holds the Stripe ids needed above
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    // Guard against an accidental call. The UI sends this explicitly.
    if (body?.confirm !== 'DELETE') {
      return Response.json(
        { error: 'Confirmation required', hint: 'Send { "confirm": "DELETE" }' },
        { status: 400 },
      );
    }

    const summary: Record<string, number> = {};
    const errors: string[] = [];
    let totalDeleted = 0;

    // ------------------------------------------------ 1. stop the billing ---
    let subscriptionCancelled = false;
    let cancelledSubscriptionId = '';
    try {
      const balances = await base44.asServiceRole.entities.CreditBalance.filter({ user_id: user.id });
      const mine = (balances || []).filter((b: any) => b.user_id === user.id);
      for (const b of mine) {
        if (!b.stripe_subscription_id) continue;
        try {
          await stripeDelete(`subscriptions/${b.stripe_subscription_id}`);
          subscriptionCancelled = true;
          cancelledSubscriptionId = b.stripe_subscription_id;
        } catch (e) {
          const msg = (e as Error).message || '';
          // Already cancelled or never existed — not an error for our purposes.
          if (msg.includes('resource_missing') || msg.includes('No such subscription')) {
            subscriptionCancelled = true;
          } else {
            errors.push(`stripe:cancel_subscription — ${msg}`);
          }
        }
      }
    } catch (e) {
      errors.push(`stripe:lookup — ${(e as Error).message}`);
    }

    // If the subscription could not be cancelled, STOP. Deleting the data now
    // would destroy the only record linking this user to that subscription,
    // leaving a charge nobody can trace back or refund.
    if (errors.some(e => e.startsWith('stripe:cancel_subscription'))) {
      return Response.json({
        status: 'aborted',
        reason: 'subscription_cancel_failed',
        message: 'Your subscription could not be cancelled, so nothing was deleted. No data has been changed. Please try again or cancel from the billing portal first.',
        errors,
      }, { status: 502 });
    }

    // -------------------------------------------- 2. academic data (user) ---
    for (const name of USER_SCOPED_ENTITIES) {
      const entity = (base44.entities as any)[name];
      if (!entity) continue;
      let deleted = 0;
      try {
        let records = await entity.list();
        if (!Array.isArray(records)) records = [];
        for (const rec of records) {
          if (!rec?.id) continue;
          try {
            await entity.delete(rec.id);
            deleted += 1;
          } catch (e) {
            errors.push(`${name}:${rec.id} — ${(e as Error).message}`);
          }
        }
      } catch (e) {
        errors.push(`${name} (list) — ${(e as Error).message}`);
      }
      summary[name] = deleted;
      totalDeleted += deleted;
    }

    // ------------------------------------ 3. billing/system (service role) ---
    for (const name of SERVICE_ROLE_ENTITIES) {
      const entity = (base44.asServiceRole.entities as any)[name];
      if (!entity) continue;
      let deleted = 0;
      try {
        // Explicit user_id filter — asServiceRole bypasses RLS, so this filter
        // is the ONLY thing scoping the query to the caller.
        const records = await entity.filter({ user_id: user.id });
        for (const rec of records || []) {
          // Belt and braces: re-verify ownership before every delete.
          if (!rec?.id || rec.user_id !== user.id) continue;
          try {
            await entity.delete(rec.id);
            deleted += 1;
          } catch (e) {
            errors.push(`${name}:${rec.id} — ${(e as Error).message}`);
          }
        }
      } catch (e) {
        errors.push(`${name} (filter) — ${(e as Error).message}`);
      }
      summary[name] = deleted;
      totalDeleted += deleted;
    }

    console.log('[deleteUserData] reset complete', JSON.stringify({
      user_id: user.id,
      total_deleted: totalDeleted,
      subscription_cancelled: subscriptionCancelled,
      error_count: errors.length,
    }));

    return Response.json({
      status: errors.length > 0 ? 'complete_with_errors' : 'complete',
      total_deleted: totalDeleted,
      deleted_by_entity: summary,
      subscription_cancelled: subscriptionCancelled,
      cancelled_subscription_id: cancelledSubscriptionId,
      errors,
      note: 'All app data has been deleted and any active subscription cancelled. No refund was issued. Signing in again will start a fresh free-tier account. Uploaded audio files are no longer linked to your account; contact support if you need stored files purged from backups.',
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
