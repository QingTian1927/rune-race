-- Optional: align legacy `profiles` (total_played_hours) with v2 API (total_played_seconds).
-- Safe to run on DBs that already have v2 columns.

alter table public.profiles
  add column if not exists total_played_seconds bigint;

alter table public.profiles
  add column if not exists last_played_at timestamptz;

update public.profiles
set total_played_seconds = round(coalesce(total_played_hours, 0) * 3600)::bigint
where total_played_seconds is null
  and total_played_hours is not null;

update public.profiles
set total_played_seconds = 0
where total_played_seconds is null;
