-- Do not auto-create profiles for anonymous auth users (avoids rows for visitors who never play).
-- Anon profiles are created lazily on the server when the player joins a lobby or earns stats.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_anon_user boolean;
begin
  is_anon_user := coalesce((new.raw_user_meta_data->>'is_anon')::boolean, false);

  if is_anon_user then
    return new;
  end if;

  insert into public.profiles (id, phone, is_anon, full_name, display_name)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'phone', ''),
    false,
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'display_name'), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
