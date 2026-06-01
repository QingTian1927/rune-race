-- Fix deployments that created app_settings.value (PostgREST can choke on column name "value").
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'app_settings'
      and column_name = 'value'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'app_settings'
      and column_name = 'setting_value'
  ) then
    alter table public.app_settings rename column value to setting_value;
  end if;
end $$;

-- Ensure default row exists after rename.
insert into public.app_settings (key, setting_value)
values ('account_nudge_enabled', 'true'::jsonb)
on conflict (key) do nothing;
