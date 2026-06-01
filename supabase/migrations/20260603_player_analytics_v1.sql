create table if not exists public.player_session_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  event_type text not null,
  player_id uuid references public.profiles (id) on delete set null,
  lobby_id uuid,
  game_id uuid,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_player_session_events_occurred_at
  on public.player_session_events (occurred_at desc);

create index if not exists idx_player_session_events_player_occurred
  on public.player_session_events (player_id, occurred_at desc);

create index if not exists idx_player_session_events_type_occurred
  on public.player_session_events (event_type, occurred_at desc);

create table if not exists public.player_metrics_hourly (
  bucket_start timestamptz primary key,
  unique_players integer not null default 0,
  games_started integer not null default 0,
  games_finished integer not null default 0,
  total_play_seconds bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_live_counters (
  id boolean primary key default true,
  online_now integer not null default 0,
  active_lobbies integer not null default 0,
  active_games integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint analytics_live_counters_singleton check (id = true)
);

insert into public.analytics_live_counters (id, online_now, active_lobbies, active_games)
values (true, 0, 0, 0)
on conflict (id) do nothing;

alter table public.player_session_events enable row level security;
alter table public.player_metrics_hourly enable row level security;
alter table public.analytics_live_counters enable row level security;
