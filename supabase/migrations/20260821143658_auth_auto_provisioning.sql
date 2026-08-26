-- Reconstructed profile and signup provisioning boundary.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('admin','user')),
  avatar_url text, full_name text, created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "select own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role) values (new.id, 'user');
  insert into public.credit_balances (user_id,tier,subscription_credits,purchased_credits,lifetime_granted,period_key,last_grant_date)
  values (new.id,'free',20,0,20,to_char(now(),'YYYY-MM'),current_date);
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
