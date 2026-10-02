-- Student reviews (2 Oct 2026): a star rating and a short description, asked
-- for inside the app, that can become social proof on praelecta.ca.
--
-- One row per student (user_id is unique): the review they gave, or the
-- record that they chose "Don't ask again" (declined = true, rating null),
-- so the question is not repeated on another device.
--
-- The student owns the row — writes, edits and deletes it under the usual
-- owner policies — except approved_at, which only the API sets (the
-- owner-reviews route, admins only): the same split as profiles.role.
-- Nothing reaches the website unless the student ticked may_publish AND the
-- founder approved that exact wording. Editing the words, the name, the
-- course or the school, or ticking may_publish again, clears approved_at so
-- the new version is checked again (trigger below); unticking may_publish
-- hides the review at once, because the public read requires it.
--
-- The public read is the API's (GET /public/reviews, server/routes/
-- publicReviews.js): the approved, published rows, and an average over EVERY
-- rating — published or not — so the number on the homepage is the honest
-- one and not an average of the quotes that were picked.

create table if not exists public.app_reviews (
  id uuid default gen_random_uuid() not null primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  rating smallint check (rating between 1 and 5),
  body text check (body is null or char_length(body) <= 400),
  display_name text check (display_name is null or char_length(display_name) <= 40),
  detail text check (detail is null or char_length(detail) <= 60),
  school text check (school is null or char_length(school) <= 80),
  may_publish boolean not null default false,
  declined boolean not null default false,
  approved_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint app_reviews_rated_or_declined check (declined or rating is not null),
  constraint app_reviews_publishable check (
    not may_publish
    or (char_length(btrim(coalesce(body, ''))) > 0 and char_length(btrim(coalesce(display_name, ''))) > 0)
  )
);

comment on table public.app_reviews is
  'A student''s rating (1-5) and short description of Praelecta, or their "don''t ask again". Shown on praelecta.ca only when may_publish is true and approved_at is set; approved_at is written by the API alone and cleared by a trigger whenever the published wording changes.';
comment on column public.app_reviews.may_publish is
  'The student''s own consent to show the description with display_name, detail and school on praelecta.ca. Unticked by default.';
comment on column public.app_reviews.approved_at is
  'Set by the API (owner-reviews, admins only) when the founder has checked this wording. Not writable by the client; cleared by app_reviews_recheck_on_edit when the wording changes.';

drop trigger if exists set_updated_at on public.app_reviews;
create trigger set_updated_at before update on public.app_reviews
  for each row execute function public.set_updated_at();

-- A review that was checked and then edited is checked again.
create or replace function public.app_reviews_recheck_on_edit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.body is distinct from old.body
     or new.display_name is distinct from old.display_name
     or new.detail is distinct from old.detail
     or new.school is distinct from old.school
     or (new.may_publish and not old.may_publish) then
    new.approved_at := null;
  end if;
  return new;
end;
$$;

revoke all on function public.app_reviews_recheck_on_edit() from public, anon, authenticated;

drop trigger if exists recheck_on_edit on public.app_reviews;
create trigger recheck_on_edit before update on public.app_reviews
  for each row execute function public.app_reviews_recheck_on_edit();

alter table public.app_reviews enable row level security;
revoke all privileges on table public.app_reviews from anon, authenticated;
grant select, delete on table public.app_reviews to authenticated;
-- approved_at, id and the timestamps are deliberately absent: a student can
-- neither approve their own review nor backdate it.
grant insert (user_id, rating, body, display_name, detail, school, may_publish, declined)
  on table public.app_reviews to authenticated;
grant update (rating, body, display_name, detail, school, may_publish, declined)
  on table public.app_reviews to authenticated;

drop policy if exists "select own rows" on public.app_reviews;
drop policy if exists "insert own rows" on public.app_reviews;
drop policy if exists "update own rows" on public.app_reviews;
drop policy if exists "delete own rows" on public.app_reviews;
create policy "select own rows" on public.app_reviews
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own rows" on public.app_reviews
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own rows" on public.app_reviews
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own rows" on public.app_reviews
  for delete to authenticated using ((select auth.uid()) = user_id);
