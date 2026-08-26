-- Generated from the live Cedar Student Pilot Supabase catalog on 2026-08-26.
-- Schema only: contains no user rows, auth identities, or secret values.
-- This is an evidence snapshot for reconstructing the six pre-repository migrations.
-- Do not apply it on top of an existing project.

-- Tables

create table public.profiles (
  id uuid not null,
  role text default 'user'::text not null,
  avatar_url text,
  full_name text,
  created_at timestamp with time zone default now() not null
);

create table public.credit_balances (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  tier text default 'free'::text not null,
  subscription_credits numeric default 0 not null,
  purchased_credits numeric default 0 not null,
  lifetime_granted numeric default 0 not null,
  period_key text,
  last_grant_date date,
  fair_use_flagged boolean default false not null,
  applied_credit_operations text[] default '{}'::text[] not null,
  fulfilled_stripe_anchors text[] default '{}'::text[] not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.processed_stripe_events (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  anchor_id text not null,
  kind text not null,
  stripe_event_id text,
  stripe_session_id text,
  credits_granted numeric default 0 not null,
  status text,
  attempt_count integer default 0 not null,
  last_error text,
  completed_at timestamp with time zone,
  processed_at timestamp with time zone default now() not null
);

create table public.usage_events (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  feature text not null,
  provider text,
  model text,
  call_count numeric default 0 not null,
  base44_credits numeric default 0 not null,
  input_tokens numeric default 0 not null,
  output_tokens numeric default 0 not null,
  cedar_credits_charged numeric default 0 not null,
  credit_operation_id text,
  cost_cad numeric default 0 not null,
  tier_at_time text,
  latency_ms numeric default 0 not null,
  lecture_id uuid,
  audio_seconds numeric default 0 not null,
  success boolean default true not null,
  occurred_at timestamp with time zone default now() not null
);

create table public.semesters (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_active boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.classes (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  semester_id uuid not null,
  name text not null,
  instructor text,
  room text,
  color text default '#3B82F6'::text not null,
  days_of_week text[] default '{}'::text[] not null,
  start_time text,
  end_time text,
  class_start_date date,
  class_end_date date,
  recording_consent_confirmed boolean default false not null,
  recording_consent_date date,
  meetings jsonb,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  course_code text
);

create table public.lectures (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  class_id uuid not null,
  date date not null,
  recording_url text,
  duration_seconds numeric,
  transcript text,
  ai_title text,
  ai_summary text,
  ai_concepts text[] default '{}'::text[] not null,
  ai_vocabulary text[] default '{}'::text[] not null,
  ai_definitions jsonb default '[]'::jsonb not null,
  ai_formulas text[] default '{}'::text[] not null,
  ai_action_items text[] default '{}'::text[] not null,
  ai_exam_mentions text[] default '{}'::text[] not null,
  is_missed boolean default false not null,
  is_ai_estimated boolean default false not null,
  actual_instructor text,
  instructor_confirmed boolean default false not null,
  status text default 'pending'::text not null,
  transcript_raw text,
  transcript_cleaned boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.assignments (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  class_id uuid not null,
  title text not null,
  due_date date not null,
  type text default 'assignment'::text not null,
  status text default 'active'::text not null,
  coverage_scope text default 'cumulative'::text not null,
  lecture_range_start text,
  lecture_range_end text,
  description text,
  project_metadata jsonb default '{}'::jsonb not null,
  roadmap jsonb default '[]'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.notes (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  lecture_id uuid,
  class_id uuid not null,
  content text,
  attachments text[] default '{}'::text[] not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.study_sessions (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  assignment_id uuid,
  class_id uuid not null,
  scheduled_date date not null,
  scheduled_time text,
  duration_minutes numeric,
  priority text default 'medium'::text not null,
  status text default 'scheduled'::text not null,
  title text,
  notes text,
  email_notified boolean default false not null,
  session_type text default 'study'::text not null,
  roadmap_step_index numeric,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  lecture_id uuid
);

create table public.study_records (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  duration_seconds numeric not null,
  date date not null,
  class_id uuid,
  mode text,
  cycles_completed numeric,
  goal_minutes numeric,
  study_type text default 'manual'::text not null,
  study_mode text,
  lectures_covered numeric default 0 not null,
  total_lectures numeric default 0 not null,
  quiz_score numeric,
  quiz_questions_count numeric,
  topics_reviewed text[] default '{}'::text[] not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.calendar_events (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  title text not null,
  date date,
  start_time text,
  end_time text,
  type text default 'custom'::text not null,
  color text default '#3B82F6'::text not null,
  notes text,
  reminder_minutes_before numeric,
  class_id uuid,
  recurrence text,
  recurrence_days text[],
  recurrence_start_date date,
  recurrence_end_date date,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.class_attendance (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  class_id uuid not null,
  date date not null,
  attended boolean default false not null,
  confirmed_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.knowledge_coverage (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  class_id uuid not null,
  lecture_id uuid,
  concepts_seen text[] default '{}'::text[] not null,
  concepts_mastered text[] default '{}'::text[] not null,
  proficiency numeric default 0 not null,
  sessions_reviewed numeric default 0 not null,
  last_reviewed_date date,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.flashcards (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  lecture_id uuid,
  class_id uuid not null,
  front text not null,
  back text not null,
  ai_generated boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.practice_questions (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  lecture_id uuid,
  class_id uuid not null,
  question text not null,
  answer text not null,
  options text[] default '{}'::text[] not null,
  type text default 'multiple_choice'::text not null,
  ai_generated boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.study_session_reviews (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  study_record_id uuid,
  class_id uuid not null,
  lecture_ids uuid[] default '{}'::uuid[] not null,
  ai_interactions jsonb default '[]'::jsonb not null,
  review_questions jsonb default '[]'::jsonb not null,
  self_assessment jsonb default '[]'::jsonb not null,
  proficiency_score numeric,
  coverage_percentage numeric,
  in_depth_score numeric,
  overall_score numeric,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.custom_tracks (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  title text not null,
  video_id text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.handbooks (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  class_id uuid not null,
  scope_key text not null,
  source_hash text not null,
  payload text not null,
  total_lectures numeric default 0 not null,
  generated_at timestamp with time zone default now() not null
);

create table public.system_state (
  id uuid default gen_random_uuid() not null,
  key text not null,
  value text
);


-- Constraints

alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);

alter table public.profiles add constraint profiles_role_check CHECK (role = ANY (ARRAY['admin'::text, 'user'::text]));

alter table public.credit_balances add constraint credit_balances_pkey PRIMARY KEY (id);

alter table public.credit_balances add constraint credit_balances_tier_check CHECK (tier = ANY (ARRAY['free'::text, 'student'::text, 'scholar'::text, 'unlimited'::text]));

alter table public.credit_balances add constraint credit_balances_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.credit_balances add constraint credit_balances_user_id_key UNIQUE (user_id);

alter table public.processed_stripe_events add constraint processed_stripe_events_anchor_id_key UNIQUE (anchor_id);

alter table public.processed_stripe_events add constraint processed_stripe_events_kind_check CHECK (kind = ANY (ARRAY['subscription_initial'::text, 'pack'::text, 'subscription_renewal'::text, 'tier_sync'::text, 'downgrade'::text, 'monthly_grant'::text]));

alter table public.processed_stripe_events add constraint processed_stripe_events_pkey PRIMARY KEY (id);

alter table public.processed_stripe_events add constraint processed_stripe_events_status_check CHECK (status = ANY (ARRAY['complete'::text, 'failed'::text]));

alter table public.processed_stripe_events add constraint processed_stripe_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.usage_events add constraint usage_events_pkey PRIMARY KEY (id);

alter table public.usage_events add constraint usage_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.semesters add constraint semesters_pkey PRIMARY KEY (id);

alter table public.semesters add constraint semesters_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.classes add constraint classes_course_code_length CHECK (course_code IS NULL OR char_length(course_code) <= 40);

alter table public.classes add constraint classes_pkey PRIMARY KEY (id);

alter table public.classes add constraint classes_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE CASCADE;

alter table public.classes add constraint classes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.lectures add constraint lectures_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

alter table public.lectures add constraint lectures_pkey PRIMARY KEY (id);

alter table public.lectures add constraint lectures_status_check CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'complete'::text]));

alter table public.lectures add constraint lectures_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.assignments add constraint assignments_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

alter table public.assignments add constraint assignments_coverage_scope_check CHECK (coverage_scope = ANY (ARRAY['cumulative'::text, 'since_last'::text, 'custom'::text]));

alter table public.assignments add constraint assignments_pkey PRIMARY KEY (id);

alter table public.assignments add constraint assignments_status_check CHECK (status = ANY (ARRAY['active'::text, 'completed'::text, 'archived'::text]));

alter table public.assignments add constraint assignments_type_check CHECK (type = ANY (ARRAY['exam'::text, 'quiz'::text, 'project'::text, 'assignment'::text]));

alter table public.assignments add constraint assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.notes add constraint notes_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

alter table public.notes add constraint notes_lecture_id_fkey FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE;

alter table public.notes add constraint notes_pkey PRIMARY KEY (id);

alter table public.notes add constraint notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.study_sessions add constraint study_sessions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE;

alter table public.study_sessions add constraint study_sessions_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

alter table public.study_sessions add constraint study_sessions_lecture_id_fkey FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE;

alter table public.study_sessions add constraint study_sessions_pkey PRIMARY KEY (id);

alter table public.study_sessions add constraint study_sessions_priority_check CHECK (priority = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text]));

alter table public.study_sessions add constraint study_sessions_session_type_check CHECK (session_type = ANY (ARRAY['study'::text, 'project'::text, 'review'::text]));

alter table public.study_sessions add constraint study_sessions_status_check CHECK (status = ANY (ARRAY['scheduled'::text, 'completed'::text, 'skipped'::text]));

alter table public.study_sessions add constraint study_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.study_records add constraint study_records_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

alter table public.study_records add constraint study_records_mode_check CHECK (mode = ANY (ARRAY['pomodoro'::text, 'simple'::text]));

alter table public.study_records add constraint study_records_pkey PRIMARY KEY (id);

alter table public.study_records add constraint study_records_study_mode_check CHECK (study_mode = ANY (ARRAY['deep'::text, 'sprint'::text, 'review'::text]));

alter table public.study_records add constraint study_records_study_type_check CHECK (study_type = ANY (ARRAY['in_app'::text, 'manual'::text]));

alter table public.study_records add constraint study_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.calendar_events add constraint calendar_events_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

alter table public.calendar_events add constraint calendar_events_pkey PRIMARY KEY (id);

alter table public.calendar_events add constraint calendar_events_recurrence_check CHECK (recurrence IS NULL OR (recurrence = ANY (ARRAY['none'::text, 'weekly'::text])));

alter table public.calendar_events add constraint calendar_events_shape_check CHECK (recurrence = 'weekly'::text AND date IS NULL AND recurrence_start_date IS NOT NULL AND recurrence_end_date IS NOT NULL AND recurrence_start_date <= recurrence_end_date AND COALESCE(cardinality(recurrence_days), 0) > 0 OR COALESCE(recurrence, 'none'::text) = 'none'::text AND date IS NOT NULL);

alter table public.calendar_events add constraint calendar_events_type_check CHECK (type = ANY (ARRAY['class'::text, 'custom'::text, 'study'::text, 'work'::text, 'appointment'::text, 'reminder'::text]));

alter table public.calendar_events add constraint calendar_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.class_attendance add constraint class_attendance_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

alter table public.class_attendance add constraint class_attendance_pkey PRIMARY KEY (id);

alter table public.class_attendance add constraint class_attendance_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.knowledge_coverage add constraint knowledge_coverage_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

alter table public.knowledge_coverage add constraint knowledge_coverage_lecture_id_fkey FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE;

alter table public.knowledge_coverage add constraint knowledge_coverage_pkey PRIMARY KEY (id);

alter table public.knowledge_coverage add constraint knowledge_coverage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.flashcards add constraint flashcards_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

alter table public.flashcards add constraint flashcards_lecture_id_fkey FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE;

alter table public.flashcards add constraint flashcards_pkey PRIMARY KEY (id);

alter table public.flashcards add constraint flashcards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.practice_questions add constraint practice_questions_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

alter table public.practice_questions add constraint practice_questions_lecture_id_fkey FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE;

alter table public.practice_questions add constraint practice_questions_pkey PRIMARY KEY (id);

alter table public.practice_questions add constraint practice_questions_type_check CHECK (type = ANY (ARRAY['multiple_choice'::text, 'short_answer'::text]));

alter table public.practice_questions add constraint practice_questions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.study_session_reviews add constraint study_session_reviews_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

alter table public.study_session_reviews add constraint study_session_reviews_pkey PRIMARY KEY (id);

alter table public.study_session_reviews add constraint study_session_reviews_study_record_id_fkey FOREIGN KEY (study_record_id) REFERENCES study_records(id) ON DELETE CASCADE;

alter table public.study_session_reviews add constraint study_session_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.custom_tracks add constraint custom_tracks_pkey PRIMARY KEY (id);

alter table public.custom_tracks add constraint custom_tracks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.handbooks add constraint handbooks_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

alter table public.handbooks add constraint handbooks_pkey PRIMARY KEY (id);

alter table public.handbooks add constraint handbooks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.system_state add constraint system_state_key_key UNIQUE (key);

alter table public.system_state add constraint system_state_pkey PRIMARY KEY (id);


-- Indexes

CREATE INDEX assignments_class_idx ON public.assignments USING btree (class_id);

CREATE INDEX assignments_user_idx ON public.assignments USING btree (user_id);

CREATE INDEX calendar_events_class_idx ON public.calendar_events USING btree (class_id);

CREATE INDEX calendar_events_user_idx ON public.calendar_events USING btree (user_id);

CREATE INDEX class_attendance_class_idx ON public.class_attendance USING btree (class_id);

CREATE INDEX class_attendance_user_idx ON public.class_attendance USING btree (user_id);

CREATE INDEX classes_semester_idx ON public.classes USING btree (semester_id);

CREATE INDEX classes_user_idx ON public.classes USING btree (user_id);

CREATE UNIQUE INDEX credit_balances_stripe_customer_idx ON public.credit_balances USING btree (stripe_customer_id) WHERE (stripe_customer_id IS NOT NULL);

CREATE INDEX custom_tracks_user_idx ON public.custom_tracks USING btree (user_id);

CREATE INDEX flashcards_class_idx ON public.flashcards USING btree (class_id);

CREATE INDEX flashcards_lecture_idx ON public.flashcards USING btree (lecture_id);

CREATE INDEX flashcards_user_idx ON public.flashcards USING btree (user_id);

CREATE INDEX handbooks_class_idx ON public.handbooks USING btree (class_id);

CREATE UNIQUE INDEX handbooks_class_scope_idx ON public.handbooks USING btree (class_id, scope_key);

CREATE INDEX handbooks_user_idx ON public.handbooks USING btree (user_id);

CREATE INDEX knowledge_coverage_class_idx ON public.knowledge_coverage USING btree (class_id);

CREATE INDEX knowledge_coverage_lecture_idx ON public.knowledge_coverage USING btree (lecture_id);

CREATE INDEX knowledge_coverage_user_idx ON public.knowledge_coverage USING btree (user_id);

CREATE INDEX lectures_class_idx ON public.lectures USING btree (class_id);

CREATE INDEX lectures_user_idx ON public.lectures USING btree (user_id);

CREATE INDEX notes_class_idx ON public.notes USING btree (class_id);

CREATE INDEX notes_lecture_idx ON public.notes USING btree (lecture_id);

CREATE INDEX notes_user_idx ON public.notes USING btree (user_id);

CREATE INDEX practice_questions_class_idx ON public.practice_questions USING btree (class_id);

CREATE INDEX practice_questions_lecture_idx ON public.practice_questions USING btree (lecture_id);

CREATE INDEX practice_questions_user_idx ON public.practice_questions USING btree (user_id);

CREATE INDEX processed_stripe_events_user_idx ON public.processed_stripe_events USING btree (user_id);

CREATE INDEX semesters_user_idx ON public.semesters USING btree (user_id);

CREATE INDEX study_records_class_idx ON public.study_records USING btree (class_id);

CREATE INDEX study_records_user_idx ON public.study_records USING btree (user_id);

CREATE INDEX study_session_reviews_class_idx ON public.study_session_reviews USING btree (class_id);

CREATE INDEX study_session_reviews_record_idx ON public.study_session_reviews USING btree (study_record_id);

CREATE INDEX study_session_reviews_user_idx ON public.study_session_reviews USING btree (user_id);

CREATE INDEX study_sessions_assignment_idx ON public.study_sessions USING btree (assignment_id);

CREATE INDEX study_sessions_class_idx ON public.study_sessions USING btree (class_id);

CREATE INDEX study_sessions_lecture_idx ON public.study_sessions USING btree (lecture_id);

CREATE INDEX study_sessions_user_idx ON public.study_sessions USING btree (user_id);

CREATE INDEX usage_events_occurred_idx ON public.usage_events USING btree (occurred_at);

CREATE INDEX usage_events_user_idx ON public.usage_events USING btree (user_id);


-- Row-level security

alter table public.assignments enable row level security;

alter table public.calendar_events enable row level security;

alter table public.class_attendance enable row level security;

alter table public.classes enable row level security;

alter table public.credit_balances enable row level security;

alter table public.custom_tracks enable row level security;

alter table public.flashcards enable row level security;

alter table public.handbooks enable row level security;

alter table public.knowledge_coverage enable row level security;

alter table public.lectures enable row level security;

alter table public.notes enable row level security;

alter table public.practice_questions enable row level security;

alter table public.processed_stripe_events enable row level security;

alter table public.profiles enable row level security;

alter table public.semesters enable row level security;

alter table public.study_records enable row level security;

alter table public.study_session_reviews enable row level security;

alter table public.study_sessions enable row level security;

alter table public.system_state enable row level security;

alter table public.usage_events enable row level security;


-- Policies

create policy "delete own rows" on public.assignments as PERMISSIVE for DELETE to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "insert own rows" on public.assignments as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "select own rows" on public.assignments as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "update own rows" on public.assignments as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "delete own rows" on public.calendar_events as PERMISSIVE for DELETE to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "insert own rows" on public.calendar_events as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "select own rows" on public.calendar_events as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "update own rows" on public.calendar_events as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "delete own rows" on public.class_attendance as PERMISSIVE for DELETE to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "insert own rows" on public.class_attendance as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "select own rows" on public.class_attendance as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "update own rows" on public.class_attendance as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "delete own rows" on public.classes as PERMISSIVE for DELETE to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "insert own rows" on public.classes as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "select own rows" on public.classes as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "update own rows" on public.classes as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "select own balance" on public.credit_balances as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "delete own rows" on public.custom_tracks as PERMISSIVE for DELETE to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "insert own rows" on public.custom_tracks as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "select own rows" on public.custom_tracks as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "update own rows" on public.custom_tracks as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "delete own rows" on public.flashcards as PERMISSIVE for DELETE to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "insert own rows" on public.flashcards as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "select own rows" on public.flashcards as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "update own rows" on public.flashcards as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "select own handbooks" on public.handbooks as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "delete own rows" on public.knowledge_coverage as PERMISSIVE for DELETE to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "insert own rows" on public.knowledge_coverage as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "select own rows" on public.knowledge_coverage as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "update own rows" on public.knowledge_coverage as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "delete own rows" on public.lectures as PERMISSIVE for DELETE to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "insert own rows" on public.lectures as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "select own rows" on public.lectures as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "update own rows" on public.lectures as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "delete own rows" on public.notes as PERMISSIVE for DELETE to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "insert own rows" on public.notes as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "select own rows" on public.notes as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "update own rows" on public.notes as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "delete own rows" on public.practice_questions as PERMISSIVE for DELETE to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "insert own rows" on public.practice_questions as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "select own rows" on public.practice_questions as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "update own rows" on public.practice_questions as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "select own events" on public.processed_stripe_events as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "select own profile" on public.profiles as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = id));

create policy "update own profile" on public.profiles as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = id)) with check ((( SELECT auth.uid() AS uid) = id));

create policy "delete own rows" on public.semesters as PERMISSIVE for DELETE to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "insert own rows" on public.semesters as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "select own rows" on public.semesters as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "update own rows" on public.semesters as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "delete own rows" on public.study_records as PERMISSIVE for DELETE to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "insert own rows" on public.study_records as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "select own rows" on public.study_records as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "update own rows" on public.study_records as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "delete own rows" on public.study_session_reviews as PERMISSIVE for DELETE to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "insert own rows" on public.study_session_reviews as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "select own rows" on public.study_session_reviews as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "update own rows" on public.study_session_reviews as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "delete own rows" on public.study_sessions as PERMISSIVE for DELETE to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "insert own rows" on public.study_sessions as PERMISSIVE for INSERT to authenticated with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "select own rows" on public.study_sessions as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));

create policy "update own rows" on public.study_sessions as PERMISSIVE for UPDATE to authenticated using ((( SELECT auth.uid() AS uid) = user_id)) with check ((( SELECT auth.uid() AS uid) = user_id));

create policy "select own usage" on public.usage_events as PERMISSIVE for SELECT to authenticated using ((( SELECT auth.uid() AS uid) = user_id));


-- API grants

grant DELETE, INSERT, SELECT, UPDATE on table public.assignments to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.assignments to service_role;

grant DELETE, INSERT, SELECT, UPDATE on table public.calendar_events to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.calendar_events to service_role;

grant DELETE, INSERT, SELECT, UPDATE on table public.class_attendance to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.class_attendance to service_role;

grant DELETE, INSERT, SELECT, UPDATE on table public.classes to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.classes to service_role;

grant SELECT on table public.credit_balances to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.credit_balances to service_role;

grant DELETE, INSERT, SELECT, UPDATE on table public.custom_tracks to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.custom_tracks to service_role;

grant DELETE, INSERT, SELECT, UPDATE on table public.flashcards to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.flashcards to service_role;

grant SELECT on table public.handbooks to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.handbooks to service_role;

grant DELETE, INSERT, SELECT, UPDATE on table public.knowledge_coverage to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.knowledge_coverage to service_role;

grant DELETE, INSERT, SELECT, UPDATE on table public.lectures to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.lectures to service_role;

grant DELETE, INSERT, SELECT, UPDATE on table public.notes to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.notes to service_role;

grant DELETE, INSERT, SELECT, UPDATE on table public.practice_questions to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.practice_questions to service_role;

grant SELECT on table public.processed_stripe_events to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.processed_stripe_events to service_role;

grant SELECT on table public.profiles to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.profiles to service_role;

grant DELETE, INSERT, SELECT, UPDATE on table public.semesters to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.semesters to service_role;

grant DELETE, INSERT, SELECT, UPDATE on table public.study_records to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.study_records to service_role;

grant DELETE, INSERT, SELECT, UPDATE on table public.study_session_reviews to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.study_session_reviews to service_role;

grant DELETE, INSERT, SELECT, UPDATE on table public.study_sessions to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.study_sessions to service_role;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.system_state to service_role;

grant SELECT on table public.usage_events to authenticated;

grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.usage_events to service_role;

grant UPDATE (avatar_url, full_name) on table public.profiles to authenticated;


-- Functions

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.profiles (id, role)
  values (new.id, 'user');

  insert into public.credit_balances (
    user_id, tier, subscription_credits, purchased_credits,
    lifetime_granted, period_key, last_grant_date
  )
  values (
    new.id, 'free', 20, 0, 20,
    pg_catalog.to_char(pg_catalog.now(), 'YYYY-MM'),
    pg_catalog.now()::date
  );

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;

revoke all on function public.set_updated_at() from public, anon, authenticated;


-- Triggers

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON semesters FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON classes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON lectures FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON assignments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON study_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON study_records FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON class_attendance FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON knowledge_coverage FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON flashcards FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON practice_questions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON study_session_reviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON custom_tracks FOR EACH ROW EXECUTE FUNCTION set_updated_at();

