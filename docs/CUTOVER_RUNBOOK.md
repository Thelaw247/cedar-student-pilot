# Cedar production cutover and rollback runbook

Status: preparation only. Nothing in this document authorizes a production
change. Base44, production DNS, and live Stripe remain unchanged until every
entry gate is checked and the owner explicitly approves a cutover window.

## 1. Entry gates

Do not begin the cutover unless all boxes are checked on the same release SHA.

- [ ] Draft migration PR approved and CI green on the intended release SHA.
- [ ] Supabase Auth signup, login, confirmation, and recovery email pass.
- [ ] Banner timetable, Today, and weekly views pass on representative dates.
- [ ] Avatar upload, replacement, signed playback, and deletion pass through R2.
- [ ] Lecture recording, segmented upload, Groq transcription, Gemini processing,
      playback, and deletion pass.
- [ ] Resend transcript and reminder emails arrive from the verified sender.
- [ ] Stripe test checkout, webhook replay, renewal, portal, and cancellation pass.
- [ ] Both scheduled jobs run successfully and demonstrate idempotency.
- [ ] Clean-user CRUD matrix and account deletion pass.
- [ ] Render uses `/health/ready` and returns database/storage `ok`.
- [ ] Rollback rehearsal completed without changing production DNS.

Record the immutable release identifiers:

| Item | Approved value |
| --- | --- |
| Git commit SHA | `________________` |
| Cloudflare version ID | `________________` |
| Render deploy ID | `________________` |
| Supabase migration version | `________________` |
| Stripe API version | `________________` |
| Cutover owner | `________________` |
| Window (timezone included) | `________________` |

## 2. Pre-cutover preservation

- [ ] Export a fresh Base44 data snapshot and record its timestamp/location.
- [ ] Confirm Supabase point-in-time recovery or take a restorable database backup.
- [ ] Export current production DNS records and TTLs.
- [ ] Capture current Base44 production URL, custom-domain mapping, and publish ID.
- [ ] Capture current live Stripe webhook endpoints, signing-secret ownership,
      product/price IDs, and customer-portal configuration without copying secret
      values into Git or chat.
- [ ] Record current production email DNS (SPF, DKIM, DMARC) and sender identity.
- [ ] Verify the prior Base44 application remains deployable during the entire
      rollback window; do not delete or decommission it.

## 3. Production configuration (before traffic)

Create production-isolated resources. Never reuse staging secrets.

- [ ] Apply reviewed Supabase migrations to the production project.
- [ ] Configure production Auth site URL, redirect allowlist, SMTP, and templates.
- [ ] Configure Render production environment with live origins and provider keys.
- [ ] Set `STRIPE_EXPECTED_MODE=live` only on the production Render service.
- [ ] Set Render health check to `/health/ready`; wait for database and R2 `ok`.
- [ ] Deploy the approved Cloudflare build with production-only environment values.
- [ ] Verify the production Worker by its temporary workers.dev URL before DNS.
- [ ] Create live Stripe webhook endpoint only after the production API is healthy.
- [ ] Keep the live webhook disabled or pointed away from customer traffic until
      the final traffic switch.

## 4. Traffic switch

One owner calls each step and one observer records timestamps/results.

1. Freeze Base44 writes or announce the maintenance window.
2. Run the final Base44 export and import only the agreed delta into Supabase.
3. Compare source/target counts and financial/credit aggregates; stop on mismatch.
4. Enable the production Stripe webhook and send a signed test event.
5. Attach the production hostname to Cloudflare and apply the reviewed DNS record.
6. Verify TLS and security headers before allowing normal traffic.
7. Run the smoke checks below from a clean browser session.
8. End the write freeze only after all blocking smoke checks pass.

## 5. Blocking smoke checks

- [ ] Landing, register, login, recovery, and logout.
- [ ] `/health/ready` returns HTTP 200 with database and storage `ok`.
- [ ] Create/read/update/delete one harmless academic record.
- [ ] Today and weekly schedule show the same representative class correctly.
- [ ] Small avatar R2 upload and signed retrieval.
- [ ] Short lecture recording through transcript and saved study material.
- [ ] Stripe live low-risk checkout using an owner-controlled account, webhook
      fulfillment exactly once, portal access, then cancellation/refund as planned.
- [ ] Transcript email to the authenticated account.
- [ ] No new critical Supabase advisor findings or Render error logs.

## 6. Abort and rollback criteria

Rollback immediately if any of these occurs and cannot be repaired within the
agreed window:

- Authentication or account provisioning fails for more than one test account.
- Database/R2 readiness is not continuously green.
- Ownership/RLS isolation fails or another user's object can be accessed.
- Stripe charges without exactly-once fulfillment, or webhook signatures fail.
- Imported record counts or credit/subscription aggregates do not reconcile.
- Core timetable, recording, or account-deletion flows corrupt or lose data.

Rollback order:

1. Re-enable the Base44 maintenance/write boundary if it was lifted.
2. Restore the prior DNS record/custom-domain mapping from the recorded export.
3. Disable the new live Stripe webhook endpoint; restore the prior endpoint state.
4. Confirm Base44 login and a harmless read/write operation before reopening it.
5. Preserve Render, Cloudflare, Supabase, and Stripe logs; do not destroy failed
   migration resources or overwrite evidence.
6. Reconcile any writes accepted by the new stack during the cutover window before
   allowing edits on Base44, using the timestamped cutover ledger.
7. Publish the incident decision, affected interval, and next retry prerequisites.

DNS rollback does not reverse writes already accepted by Supabase. The cutover
ledger and write freeze are therefore mandatory; DNS alone is not a data rollback.

## 7. Stability window and decommission gates

- [ ] Monitor Render errors/readiness, Supabase advisors, R2 failures, email
      bounces, and Stripe webhook failures throughout the agreed stability window.
- [ ] Reconcile subscriptions, credits, and usage events daily during the window.
- [ ] Keep Base44 intact and restorable until the owner signs off on stability.
- [ ] Do not begin Phase 8 (Capacitor/Vanta work or Base44 decommissioning) until
      backups, legal retention, customer support, and rollback expiry are approved.
