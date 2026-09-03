-- Lecture intelligence (3 Sep 2026): a deeper analysis of every recording,
-- the professor's own materials attached to a lecture, and a real to-do list.
--
-- 1. lectures.ai_enrichment — the second analysis pass over the transcript
--    (outline, concept cards with transcript anchors and search queries,
--    formulas with variables and a verification flag, examples, exam radar,
--    suggested to-dos). One jsonb column rather than a dozen new array
--    columns: the shape is owned by server/lib/lectureEnrichment.js, which
--    validates it on the way in and out, and it will keep growing.
--    The existing ai_* columns are untouched — every current reader keeps
--    working and the enrichment is purely additive.
--
-- 2. lecture_materials — PDFs/notes the professor handed out, uploaded to
--    R2 under the owner's prefix and stored here with their extracted text.
--    The enrichment pass treats that text as the authoritative source: a
--    formula or definition that matches it is marked verified, so a chopped
--    transcription of "sigma equals F over A" cannot become the version the
--    student studies from. Rows are written by the API (after it has verified
--    the object in R2 and extracted the text); the client may only read and
--    the API deletes the object and the row together.
--
-- 3. todos — the checklist. Items come from the enrichment pass (source
--    'lecture', linked to the lecture that produced them) and from the
--    student (source 'manual'). Fully client-writable under the usual
--    owner policies, like assignments.

alter table public.lectures
  add column if not exists ai_enrichment jsonb not null default '{}'::jsonb,
  add column if not exists enriched_at timestamp with time zone;

comment on column public.lectures.ai_enrichment is
  'Second-pass analysis (outline, concept cards, formulas, examples, exam radar, suggested to-dos). Shape owned by server/lib/lectureEnrichment.js; {} until the pass has run.';
comment on column public.lectures.enriched_at is
  'When ai_enrichment was last written; null until the enrichment pass has run for this lecture.';

-- ---------------------------------------------------------------------------
create table if not exists public.lecture_materials (
  id uuid default gen_random_uuid() not null primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  lecture_id uuid not null references public.lectures(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  file_name text not null check (char_length(file_name) between 1 and 255),
  content_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  storage_ref text not null,
  extracted_text text,
  page_count integer,
  extraction_status text not null default 'pending'
    check (extraction_status = any (array['pending'::text, 'ready'::text, 'failed'::text, 'unsupported'::text])),
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

comment on table public.lecture_materials is
  'Professor-supplied files (slides, handouts, problem sets) attached to a lecture. The API uploads, extracts text and deletes; the enrichment pass reads extracted_text as the source of truth for formulas and definitions.';

create index if not exists lecture_materials_lecture_id_idx on public.lecture_materials (lecture_id);
create index if not exists lecture_materials_class_id_idx on public.lecture_materials (class_id);
create index if not exists lecture_materials_user_id_idx on public.lecture_materials (user_id);

drop trigger if exists set_updated_at on public.lecture_materials;
create trigger set_updated_at before update on public.lecture_materials
  for each row execute function public.set_updated_at();

alter table public.lecture_materials enable row level security;
revoke all privileges on table public.lecture_materials from anon, authenticated;
grant select on table public.lecture_materials to authenticated;

drop policy if exists "select own rows" on public.lecture_materials;
create policy "select own rows" on public.lecture_materials
  for select to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
create table if not exists public.todos (
  id uuid default gen_random_uuid() not null primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  lecture_id uuid references public.lectures(id) on delete set null,
  title text not null check (char_length(title) between 1 and 500),
  detail text check (detail is null or char_length(detail) <= 2000),
  kind text not null default 'task'
    check (kind = any (array['task'::text, 'read'::text, 'practice'::text, 'submit'::text, 'review'::text, 'prepare'::text])),
  due_date date,
  done boolean not null default false,
  done_at timestamp with time zone,
  source text not null default 'manual'
    check (source = any (array['manual'::text, 'lecture'::text])),
  position integer not null default 0,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

comment on table public.todos is
  'The student''s checklist. source=lecture rows are suggested by the enrichment pass and point at the lecture that mentioned them; source=manual rows are the student''s own.';

create index if not exists todos_user_id_done_due_idx on public.todos (user_id, done, due_date);
create index if not exists todos_lecture_id_idx on public.todos (lecture_id);
create index if not exists todos_class_id_idx on public.todos (class_id);

drop trigger if exists set_updated_at on public.todos;
create trigger set_updated_at before update on public.todos
  for each row execute function public.set_updated_at();

alter table public.todos enable row level security;
revoke all privileges on table public.todos from anon, authenticated;
grant select, insert, update, delete on table public.todos to authenticated;

drop policy if exists "select own rows" on public.todos;
drop policy if exists "insert own rows" on public.todos;
drop policy if exists "update own rows" on public.todos;
drop policy if exists "delete own rows" on public.todos;
create policy "select own rows" on public.todos
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own rows" on public.todos
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own rows" on public.todos
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own rows" on public.todos
  for delete to authenticated using ((select auth.uid()) = user_id);
