-- 2026-06-04  intake-for-a-client: admin write on intake_submissions
--
-- Reverses the 2026-06-02 locked decision (admin = SELECT-only here). Adds
-- admin INSERT/UPDATE so an admin can create or edit a client's intake on
-- their behalf via the Client Intake tab. Scope = is_admin() (admin-all),
-- matching intake_select_admin. No admin DELETE. Self/provider policies
-- unchanged. Re-runnable: drop-if-exists then create, in a transaction.

begin;

drop policy if exists intake_insert_admin on public.intake_submissions;
create policy intake_insert_admin on public.intake_submissions
  for insert to authenticated with check (is_admin());

drop policy if exists intake_update_admin on public.intake_submissions;
create policy intake_update_admin on public.intake_submissions
  for update to authenticated using (is_admin()) with check (is_admin());

commit;
