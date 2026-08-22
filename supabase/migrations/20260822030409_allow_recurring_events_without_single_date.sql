-- Weekly series use recurrence_start_date/end_date plus recurrence_days and do
-- not have one canonical date. One-off events continue to provide date.

alter table public.calendar_events
  alter column date drop not null;
