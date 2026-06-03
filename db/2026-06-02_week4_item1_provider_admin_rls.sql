-- =============================================================================
-- LYL - Week-4 item 1: provider/admin client-record RLS
-- Captured live state, Supabase project pkootwezezmqwopveigu, 2026-06-02.
--
-- Reconstructed from the live database (pg_policies + pg_get_functiondef) so
-- this file matches exactly what is deployed. Re-runnable: each policy is
-- dropped-if-exists then created, and the helper uses CREATE OR REPLACE.
-- Wrapped in a transaction so a replay is atomic.
--
-- SCOPE - captures ONLY the item-1 additions:
--   * blood_tests / hair_tests / events: provider-scoped + admin-all policies
--     for SELECT / INSERT / UPDATE (no DELETE - kept self-only).
--   * clients: clients_select_admin (admin lists every client; drives the picker).
--   * profiles: provider/admin SELECT + UPDATE of their clients' profiles.
--   * is_my_client_profile(uuid) SECURITY DEFINER - breaks the
--     profiles -> clients -> clients_select_self -> profiles RLS recursion (42P17).
--
-- NOT included (pre-existing, intentionally untouched): self policies; old
-- share-model SELECT policies (share_with_provider + is_provider_user()); and
-- other clients_* policies (select_self / select_provider / insert_provider /
-- update_provider) from earlier provider scaffolding.
--
-- Assumes these already exist: is_admin(), is_provider(), current_provider_id(),
-- and the providers / client_provider_links tables.
-- =============================================================================

begin;

create or replace function public.is_my_client_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from clients c
    where c.profile_id = p_profile_id
      and ( c.primary_provider_id = current_provider_id()
            or c.id in ( select cpl.client_id
                         from client_provider_links cpl
                         where cpl.provider_id = current_provider_id() ) )
  );
$function$;

-- blood_tests ---------------------------------------------------------------
drop policy if exists blood_tests_select_admin on public.blood_tests;
create policy blood_tests_select_admin on public.blood_tests
  as permissive for select to authenticated
  using ( is_admin() );

drop policy if exists blood_tests_select_provider on public.blood_tests;
create policy blood_tests_select_provider on public.blood_tests
  as permissive for select to authenticated
  using (
    is_provider()
    and user_id in (
      select pr.user_id
      from clients c
      join profiles pr on pr.id = c.profile_id
      where c.primary_provider_id = current_provider_id()
         or c.id in ( select cpl.client_id
                      from client_provider_links cpl
                      where cpl.provider_id = current_provider_id() )
    )
  );

drop policy if exists blood_tests_insert_admin on public.blood_tests;
create policy blood_tests_insert_admin on public.blood_tests
  as permissive for insert to authenticated
  with check ( is_admin() );

drop policy if exists blood_tests_insert_provider on public.blood_tests;
create policy blood_tests_insert_provider on public.blood_tests
  as permissive for insert to authenticated
  with check (
    is_provider()
    and user_id in (
      select pr.user_id
      from clients c
      join profiles pr on pr.id = c.profile_id
      where c.primary_provider_id = current_provider_id()
         or c.id in ( select cpl.client_id
                      from client_provider_links cpl
                      where cpl.provider_id = current_provider_id() )
    )
  );

drop policy if exists blood_tests_update_admin on public.blood_tests;
create policy blood_tests_update_admin on public.blood_tests
  as permissive for update to authenticated
  using ( is_admin() )
  with check ( is_admin() );

drop policy if exists blood_tests_update_provider on public.blood_tests;
create policy blood_tests_update_provider on public.blood_tests
  as permissive for update to authenticated
  using (
    is_provider()
    and user_id in (
      select pr.user_id
      from clients c
      join profiles pr on pr.id = c.profile_id
      where c.primary_provider_id = current_provider_id()
         or c.id in ( select cpl.client_id
                      from client_provider_links cpl
                      where cpl.provider_id = current_provider_id() )
    )
  )
  with check (
    is_provider()
    and user_id in (
      select pr.user_id
      from clients c
      join profiles pr on pr.id = c.profile_id
      where c.primary_provider_id = current_provider_id()
         or c.id in ( select cpl.client_id
                      from client_provider_links cpl
                      where cpl.provider_id = current_provider_id() )
    )
  );

-- hair_tests ----------------------------------------------------------------
drop policy if exists hair_tests_select_admin on public.hair_tests;
create policy hair_tests_select_admin on public.hair_tests
  as permissive for select to authenticated
  using ( is_admin() );

drop policy if exists hair_tests_select_provider on public.hair_tests;
create policy hair_tests_select_provider on public.hair_tests
  as permissive for select to authenticated
  using (
    is_provider()
    and user_id in (
      select pr.user_id
      from clients c
      join profiles pr on pr.id = c.profile_id
      where c.primary_provider_id = current_provider_id()
         or c.id in ( select cpl.client_id
                      from client_provider_links cpl
                      where cpl.provider_id = current_provider_id() )
    )
  );

drop policy if exists hair_tests_insert_admin on public.hair_tests;
create policy hair_tests_insert_admin on public.hair_tests
  as permissive for insert to authenticated
  with check ( is_admin() );

drop policy if exists hair_tests_insert_provider on public.hair_tests;
create policy hair_tests_insert_provider on public.hair_tests
  as permissive for insert to authenticated
  with check (
    is_provider()
    and user_id in (
      select pr.user_id
      from clients c
      join profiles pr on pr.id = c.profile_id
      where c.primary_provider_id = current_provider_id()
         or c.id in ( select cpl.client_id
                      from client_provider_links cpl
                      where cpl.provider_id = current_provider_id() )
    )
  );

drop policy if exists hair_tests_update_admin on public.hair_tests;
create policy hair_tests_update_admin on public.hair_tests
  as permissive for update to authenticated
  using ( is_admin() )
  with check ( is_admin() );

drop policy if exists hair_tests_update_provider on public.hair_tests;
create policy hair_tests_update_provider on public.hair_tests
  as permissive for update to authenticated
  using (
    is_provider()
    and user_id in (
      select pr.user_id
      from clients c
      join profiles pr on pr.id = c.profile_id
      where c.primary_provider_id = current_provider_id()
         or c.id in ( select cpl.client_id
                      from client_provider_links cpl
                      where cpl.provider_id = current_provider_id() )
    )
  )
  with check (
    is_provider()
    and user_id in (
      select pr.user_id
      from clients c
      join profiles pr on pr.id = c.profile_id
      where c.primary_provider_id = current_provider_id()
         or c.id in ( select cpl.client_id
                      from client_provider_links cpl
                      where cpl.provider_id = current_provider_id() )
    )
  );

-- events --------------------------------------------------------------------
drop policy if exists events_select_admin on public.events;
create policy events_select_admin on public.events
  as permissive for select to authenticated
  using ( is_admin() );

drop policy if exists events_select_provider on public.events;
create policy events_select_provider on public.events
  as permissive for select to authenticated
  using (
    is_provider()
    and user_id in (
      select pr.user_id
      from clients c
      join profiles pr on pr.id = c.profile_id
      where c.primary_provider_id = current_provider_id()
         or c.id in ( select cpl.client_id
                      from client_provider_links cpl
                      where cpl.provider_id = current_provider_id() )
    )
  );

drop policy if exists events_insert_admin on public.events;
create policy events_insert_admin on public.events
  as permissive for insert to authenticated
  with check ( is_admin() );

drop policy if exists events_insert_provider on public.events;
create policy events_insert_provider on public.events
  as permissive for insert to authenticated
  with check (
    is_provider()
    and user_id in (
      select pr.user_id
      from clients c
      join profiles pr on pr.id = c.profile_id
      where c.primary_provider_id = current_provider_id()
         or c.id in ( select cpl.client_id
                      from client_provider_links cpl
                      where cpl.provider_id = current_provider_id() )
    )
  );

drop policy if exists events_update_admin on public.events;
create policy events_update_admin on public.events
  as permissive for update to authenticated
  using ( is_admin() )
  with check ( is_admin() );

drop policy if exists events_update_provider on public.events;
create policy events_update_provider on public.events
  as permissive for update to authenticated
  using (
    is_provider()
    and user_id in (
      select pr.user_id
      from clients c
      join profiles pr on pr.id = c.profile_id
      where c.primary_provider_id = current_provider_id()
         or c.id in ( select cpl.client_id
                      from client_provider_links cpl
                      where cpl.provider_id = current_provider_id() )
    )
  )
  with check (
    is_provider()
    and user_id in (
      select pr.user_id
      from clients c
      join profiles pr on pr.id = c.profile_id
      where c.primary_provider_id = current_provider_id()
         or c.id in ( select cpl.client_id
                      from client_provider_links cpl
                      where cpl.provider_id = current_provider_id() )
    )
  );

-- clients (only clients_select_admin is item-1) -----------------------------
drop policy if exists clients_select_admin on public.clients;
create policy clients_select_admin on public.clients
  as permissive for select to authenticated
  using ( is_admin() );

-- profiles ------------------------------------------------------------------
drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin on public.profiles
  as permissive for select to authenticated
  using ( is_admin() );

drop policy if exists profiles_select_provider on public.profiles;
create policy profiles_select_provider on public.profiles
  as permissive for select to authenticated
  using ( is_provider() and is_my_client_profile(id) );

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  as permissive for update to authenticated
  using ( is_admin() )
  with check ( is_admin() );

drop policy if exists profiles_update_provider on public.profiles;
create policy profiles_update_provider on public.profiles
  as permissive for update to authenticated
  using ( is_provider() and is_my_client_profile(id) )
  with check ( is_provider() and is_my_client_profile(id) );

commit;
