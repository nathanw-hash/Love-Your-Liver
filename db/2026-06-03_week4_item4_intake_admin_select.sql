-- =============================================================================
-- LYL - Week-4 item 4: admin-all SELECT on intake_submissions
-- Applied live, Supabase project pkootwezezmqwopveigu, 2026-06-03.
--
-- Adds admin read across all clients' intake submissions so the admin client
-- picker can open any client's intake in the provider-only read-only view.
-- Provider SELECT (intake_select_provider) and the self policies already exist;
-- this adds ONLY admin SELECT. No admin INSERT/UPDATE - writing a client's
-- intake is the separate "intake-for-a-client (TBD)" decision.
--
-- Re-runnable (drop-if-exists then create), wrapped in a transaction.
-- Assumes is_admin() already exists.
-- =============================================================================

begin;

drop policy if exists intake_select_admin on public.intake_submissions;
create policy intake_select_admin on public.intake_submissions
  as permissive for select to authenticated
  using ( is_admin() );

commit;
