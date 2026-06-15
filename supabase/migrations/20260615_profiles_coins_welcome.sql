-- coins may already exist on remote Supabase; keep migration idempotent.
alter table public.profiles
  add column if not exists coins integer not null default 0;

alter table public.profiles
  add column if not exists welcome_coins_granted boolean not null default false;

-- One-time welcome grant for profiles that existed when this migration first runs.
update public.profiles
set
  coins = coins + 2000,
  welcome_coins_granted = true
where welcome_coins_granted = false;

-- New profiles after this migration should not receive the welcome grant again.
alter table public.profiles
  alter column welcome_coins_granted set default true;

create table if not exists public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles (id) on delete cascade,
  game_id uuid not null,
  capture_coins integer not null default 0,
  finish_coins integer not null default 0,
  total_coins integer not null,
  balance_after integer not null,
  created_at timestamptz not null default now(),
  constraint coin_transactions_player_game_unique unique (player_id, game_id)
);

create index if not exists idx_coin_transactions_player_created
  on public.coin_transactions (player_id, created_at desc);

alter table public.coin_transactions enable row level security;

drop policy if exists "coin_transactions_deny_all" on public.coin_transactions;
create policy "coin_transactions_deny_all"
  on public.coin_transactions
  for all
  to authenticated, anon
  using (false)
  with check (false);
