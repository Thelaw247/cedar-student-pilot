-- Preserve the two supported event shapes at the database boundary. Weekly
-- series carry a bounded day set; one-off events carry one concrete date.

alter table public.calendar_events
  add constraint calendar_events_recurrence_check
  check (recurrence is null or recurrence in ('none', 'weekly')),
  add constraint calendar_events_shape_check
  check (
    (
      recurrence = 'weekly'
      and date is null
      and recurrence_start_date is not null
      and recurrence_end_date is not null
      and recurrence_start_date <= recurrence_end_date
      and coalesce(cardinality(recurrence_days), 0) > 0
    )
    or
    (
      coalesce(recurrence, 'none') = 'none'
      and date is not null
    )
  );
