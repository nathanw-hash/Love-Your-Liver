-- db/2026-06-08_consultations_table.sql
-- Milestone 3, slice 1: consultation workspace storage.
--
-- One row per consult/visit, keyed to a client. Holds the section-based
-- clinical note (mirrors the Labs Tracker structure), the free-text discussion
-- notes, and a frozen snapshot of the inputs + engine output captured at
-- finalize. Supplement selections arrive in a later slice
-- (consultation_supplements).
--
-- Run the whole file at once in the Supabase SQL editor. DDL is transactional,
-- so if any statement fails the entire migration rolls back with nothing left
-- half-applied.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.consultations (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients(id) on delete cascade,
  author_id        uuid references public.profiles(id) on delete set null,
  consult_date     date not null default current_date,
  status           text not null default 'draft' check (status in ('draft','final')),

  -- Subjective opening: notes from answering the client's questions.
  discussion_notes text,

  -- Section-based clinical note, stored flexibly so adding/removing/reordering
  -- a section never needs a migration. Each element:
  --   { "key":"vitamin_a", "label":"Vitamin A",
  --     "impression":"", "changes":"", "retest":"" }
  -- App seeds the standard sections (Vitamin A, Iron, Copper/Zinc, Toxics) when
  -- it creates a draft.
  sections         jsonb not null default '[]'::jsonb,

  -- Frozen at finalize so a signed note never changes when labs, the CMS, or
  -- the engine change later. NULL while draft. Shape:
  --   { "profile": {...}, "blood": {...}, "hair": {...},
  --     "engine": { "findings":[...], "actions":[...], "doses":[...] } }
  snapshot         jsonb,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  finalized_at     timestamptz,

  -- A finalized consult must carry its snapshot and finalize time. Drafts need
  -- neither. Guarantees no 'final' row can exist without its frozen record.
  constraint consultations_final_has_snapshot
    check (status = 'draft'
           or (snapshot is not null and finalized_at is not null))
);

create index if not exists consultations_client_date_idx
  on public.consultations (client_id, consult_date desc);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.consultations_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists consultations_set_updated_at on public.consultations;
create trigger consultations_set_updated_at
  before update on public.consultations
  for each row
  execute function public.consultations_set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
--   Provider/admin only for now (authoring lives in the testing app). Patient
--   visibility, if added later, comes when the companion surfaces consults.
--   Finalized consults are immutable: editable/deletable only while 'draft'.
--   The UPDATE USING clause tests the pre-update row, so the draft->final
--   transition is allowed, but once final the row can never be updated again.
-- ---------------------------------------------------------------------------
alter table public.consultations enable row level security;

create policy consultations_select_admin on public.consultations
  for select
  using (public.is_admin());

create policy consultations_insert_admin on public.consultations
  for insert
  with check (public.is_admin());

create policy consultations_update_draft_admin on public.consultations
  for update
  using (public.is_admin() and status = 'draft')
  with check (public.is_admin());

create policy consultations_delete_draft_admin on public.consultations
  for delete
  using (public.is_admin() and status = 'draft');
