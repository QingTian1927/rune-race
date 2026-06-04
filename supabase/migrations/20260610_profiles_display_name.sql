alter table public.profiles
  add column if not exists display_name text;

-- Backfill from auth metadata when users already set a custom in-game name.
update public.profiles p
set display_name = nullif(trim(u.raw_user_meta_data->>'display_name'), '')
from auth.users u
where p.id = u.id
  and p.display_name is null
  and coalesce(p.is_anon, false) = false
  and nullif(trim(u.raw_user_meta_data->>'display_name'), '') is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone, is_anon, full_name, display_name)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'phone', ''),
    coalesce((new.raw_user_meta_data->>'is_anon')::boolean, false),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'display_name'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
