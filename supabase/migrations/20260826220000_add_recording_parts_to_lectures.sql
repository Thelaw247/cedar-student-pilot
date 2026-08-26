-- A recording longer than the transcription provider's per-file size limit
-- (Groq's free tier: 25 MB) is now captured as multiple ordered segments
-- instead of being hard-capped at ~90 minutes. `recording_url` keeps holding
-- the first segment's r2:// reference for backward compatibility with every
-- existing single-part lecture and any code that reads it directly (for
-- example playback). `recording_parts` is only populated when a lecture was
-- actually split into more than one segment.

alter table public.lectures
  add column if not exists recording_parts jsonb;

comment on column public.lectures.recording_parts is
  'Ordered array of r2:// storage refs for a recording captured as multiple segments to stay under the transcription provider''s per-file size limit. Null for a single-segment recording, where recording_url alone is authoritative.';
