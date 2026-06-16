alter table public.profiles
  add column if not exists equipped_house_id text not null default 'house_default';

create table if not exists public.player_cosmetics (
  player_id uuid not null references public.profiles (id) on delete cascade,
  cosmetic_id text not null,
  acquired_at timestamptz not null default now(),
  primary key (player_id, cosmetic_id)
);

create index if not exists idx_player_cosmetics_player
  on public.player_cosmetics (player_id);

create table if not exists public.coin_spend_transactions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  cosmetic_id text,
  amount integer not null,
  balance_after integer not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_coin_spend_player_created
  on public.coin_spend_transactions (player_id, created_at desc);

alter table public.player_cosmetics enable row level security;
alter table public.coin_spend_transactions enable row level security;

drop policy if exists "player_cosmetics_deny_all" on public.player_cosmetics;
create policy "player_cosmetics_deny_all"
  on public.player_cosmetics
  for all
  to authenticated, anon
  using (false)
  with check (false);

drop policy if exists "coin_spend_transactions_deny_all" on public.coin_spend_transactions;
create policy "coin_spend_transactions_deny_all"
  on public.coin_spend_transactions
  for all
  to authenticated, anon
  using (false)
  with check (false);
