create table if not exists public.app_settings (
  key text primary key,
  setting_value jsonb not null default 'true'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, setting_value)
values ('account_nudge_enabled', 'true'::jsonb)
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_deny_all" on public.app_settings;
create policy "app_settings_deny_all"
  on public.app_settings
  for all
  to authenticated, anon
  using (false)
  with check (false);

create or replace function public.set_app_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at
before update on public.app_settings
for each row execute procedure public.set_app_settings_updated_at();
