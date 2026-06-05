-- 2026-06-05_signup_autocreate_client.sql
-- handle_new_user() now also creates a clients row on signup so self-signup
-- patients can fill intake (intake_submissions is client_id-keyed).
-- Defensive: profile insert unchanged; client insert is NOT EXISTS-guarded and
-- wrapped so it can never block account creation. Re-runnable.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_profile_id uuid;
begin
  insert into profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  begin
    select id into v_profile_id from profiles where user_id = new.id;
    if v_profile_id is not null then
      insert into clients (profile_id, email, package_type)
      select v_profile_id, new.email, 'app_testing'
      where not exists (select 1 from clients where profile_id = v_profile_id);
    end if;
  exception when others then
    null;
  end;

  return new;
end;
$function$;
