alter table public.profiles
  add column if not exists bio text,
  add column if not exists avatar_emoji text,
  add column if not exists total_played_hours integer not null default 0,
  add column if not exists total_games integer not null default 0,
  add column if not exists total_wins integer not null default 0,
  add column if not exists total_losses integer not null default 0;

create policy "profiles_select_public" on public.profiles
  for select using (true);
