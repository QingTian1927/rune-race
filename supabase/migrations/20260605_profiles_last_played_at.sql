-- Ensure profiles.last_played_at exists for deployments that missed prior migrations.
alter table public.profiles
  add column if not exists last_played_at timestamptz;
