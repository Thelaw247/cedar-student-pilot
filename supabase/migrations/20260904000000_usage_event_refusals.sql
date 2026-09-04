-- Tell a refusal apart from a failure in the usage ledger.
--
-- gateFeature logs success=false for two very different things: a provider or
-- pipeline that actually broke, and a request we deliberately declined because
-- the student's tier does not include the feature or their balance does not
-- cover it. The owner dashboard counted both as "failures", so a healthy
-- paywall read as a broken product -- on 4 Sep a new user showed "5 of 12
-- failed" when all five were the paywall working exactly as designed (three
-- 2-hour lectures she could not afford on free, two Student-only features),
-- and she upgraded and completed every one of them minutes later.
--
-- `refusal` is additive and nullable: every existing row keeps its meaning,
-- and success stays the flag the rest of the code reads.
alter table public.usage_events
  add column if not exists refusal text;

alter table public.usage_events
  drop constraint if exists usage_events_refusal_check;

alter table public.usage_events
  add constraint usage_events_refusal_check
  check (refusal is null or refusal = any (array['tier'::text, 'credits'::text]));

-- Backfill, deterministically rather than by guesswork. Every logUsage call
-- site that passes success:false is either a tier gate, a credit gate, or the
-- one genuine failure in cleanLectureTranscript -- and that one always records
-- a provider, because it only fires after the model has been called. So a
-- failed row with no provider is a gate, and which gate it was follows from
-- the tier at the time against the feature's minimum (server/lib/credits.js
-- FEATURE_MIN_TIER).
update public.usage_events
   set refusal = case
     when feature = any (array['lecture_review','study_material','session_review','missed_summary',
                               'smart_rebook','project_roadmap','clean_transcript'])
          and tier_at_time = 'free' then 'tier'
     when feature = any (array['handbook','exam_prediction','study_schedule'])
          and tier_at_time = any (array['free','student']) then 'tier'
     else 'credits'
   end
 where success = false
   and refusal is null
   and provider is null;

comment on column public.usage_events.refusal is
  'Why a success=false row was declined rather than attempted: tier gate, or insufficient credits. NULL means the work was attempted and genuinely failed.';
