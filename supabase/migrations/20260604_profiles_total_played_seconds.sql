-- Ensure profiles.total_played_seconds exists for deployments that missed prior migrations.
alter table public.profiles
  add column if not exists total_played_seconds bigint not null default 0;

update public.profiles
set total_played_seconds = 0
where total_played_seconds is null;
