# Supabase migrations

The connected Supabase project predates this directory. Migrations created from
2026-08-22 onward are committed here with the exact version and name recorded
by the remote migration history.

The six earlier migrations have been reconstructed from the verified
schema-only catalog snapshot and the exact later `ALTER` history:

- `20260821132716_stripe_webhook_foundation`
- `20260821143658_auth_auto_provisioning`
- `20260821150644_usage_events`
- `20260821191705_core_academic_entities`
- `20260821192329_system_state`
- `20260821192556_lecture_and_schedule_optional_fields`

These are executable DDL files, not placeholders. They preserve the semantic
boundaries named in the remote history; every subsequent recorded migration
remains responsible for its own later changes.

`schema_snapshot.sql` is a schema-only catalog export of the connected project
captured on 2026-08-26. It contains the current tables, constraints, indexes,
RLS, policies, API grants, functions, and triggers, but no application rows,
auth identities, or secrets. It remains the evidence source for reviewing the
six reconstructed migrations. It is deliberately not placed in `migrations/`,
because applying the complete current schema before the later ALTER migrations
would duplicate columns and constraints on a clean rebuild.

`database.types.ts` is a generated snapshot of the connected project's public
API schema. Regenerate it after every schema migration and review the diff so
frontend/database contract drift is visible before deployment.
