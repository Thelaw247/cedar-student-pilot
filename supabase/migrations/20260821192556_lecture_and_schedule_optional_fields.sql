-- Optional schedule, consent, and transcript-cleaning fields.
alter table public.classes add column class_start_date date,add column class_end_date date,add column recording_consent_confirmed boolean not null default false,add column recording_consent_date date,add column meetings jsonb;
alter table public.lectures add column is_ai_estimated boolean not null default false,add column actual_instructor text,add column instructor_confirmed boolean not null default false,add column transcript_raw text,add column transcript_cleaned boolean not null default false;
alter table public.calendar_events add column recurrence text,add column recurrence_days text[],add column recurrence_start_date date,add column recurrence_end_date date;
