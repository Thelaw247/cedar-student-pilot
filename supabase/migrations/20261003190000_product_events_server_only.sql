-- product_events is written and read only by the API, over its own database
-- connection: trackEvent inserts, ownerAnalytics and exportUserData read.
-- The browser never touches it.
--
-- It was created after 20260822023448 tightened the Data API grants, so it
-- kept Supabase's default table privileges for anon and authenticated:
-- every one of them, TRUNCATE included, which row level security does not
-- cover. RLS with no policies already denied rows to both roles; this takes
-- the privileges away as well, the same shape as system_state. Nothing in
-- the app used them.

revoke all privileges on table public.product_events from anon, authenticated;
