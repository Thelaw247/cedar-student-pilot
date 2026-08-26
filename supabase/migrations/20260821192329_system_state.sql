-- Reconstructed server-only operational state.
create table public.system_state (id uuid primary key default gen_random_uuid(),key text not null unique,value text);
grant all on public.system_state to service_role;
