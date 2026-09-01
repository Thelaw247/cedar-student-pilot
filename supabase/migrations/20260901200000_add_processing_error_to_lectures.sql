-- Why the last processing attempt failed, in words a student can act on.
--
-- Processing runs in the background and the client only polls `status`. When
-- a run failed it saw the lecture go back to 'pending' and could only say
-- "Processing didn't finish — try again". On 1 Sep that hid a per-hour
-- transcription quota behind a generic retry button, and retrying spent more
-- of the quota. The server now records the reason here when it releases the
-- lecture, clears it when it claims the lecture again, and the client reads
-- it to choose between "try again", "process later" and "this will never
-- work".

alter table public.lectures
  add column if not exists processing_error text;

comment on column public.lectures.processing_error is
  'Human-readable reason the most recent processing attempt failed; null while processing or after success.';
