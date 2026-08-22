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

`database.types.ts` is a generated snapshot of the connected project's public
API schema. Regenerate it after every schema migration and review the diff so
frontend/database contract drift is visible before deployment.
