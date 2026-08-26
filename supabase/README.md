# Supabase migrations

The connected Supabase project predates this directory. Migrations created from
2026-08-22 onward are committed here with the exact version and name recorded
by the remote migration history.

The six earlier migrations still need a schema-only export before this
directory can bootstrap a brand-new project:

- `20260821132716_stripe_webhook_foundation`
- `20260821143658_auth_auto_provisioning`
- `20260821150644_usage_events`
- `20260821191705_core_academic_entities`
- `20260821192329_system_state`
- `20260821192556_lecture_and_schedule_optional_fields`

Do not create placeholder files for those versions: that would make migration
history look reproducible when the actual DDL is missing.

`schema_snapshot.sql` is a schema-only catalog export of the connected project
captured on 2026-08-26. It contains the current tables, constraints, indexes,
RLS, policies, API grants, functions, and triggers, but no application rows,
auth identities, or secrets. It is the evidence source for reconstructing the
six migrations above; it is deliberately not placed in `migrations/`, because
pretending the current schema existed at an earlier migration version would
make the later ALTER migrations fail on a clean rebuild.

`database.types.ts` is a generated snapshot of the connected project's public
API schema. Regenerate it after every schema migration and review the diff so
frontend/database contract drift is visible before deployment.
