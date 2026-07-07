-- Top-down support: balance snapshots + remove hard depth ceiling

-- 1) Remove category depth upper bound (allow unbounded hierarchy depth)
alter table public.categories drop constraint if exists categories_depth_check;
alter table public.categories
  add constraint categories_depth_check check (depth >= 0);

-- 2) Balance snapshots for top-down baseline tracking
create table if not exists public.diary_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  diary_id uuid not null references public.diaries(id) on delete cascade,
  snapshot_date date not null,
  balance numeric(14, 2) not null,
  note text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (diary_id, snapshot_date)
);

create index if not exists diary_balance_snapshots_diary_date_idx
  on public.diary_balance_snapshots (diary_id, snapshot_date desc);

alter table public.diary_balance_snapshots enable row level security;

grant select on table public.diary_balance_snapshots to anon, authenticated;
grant insert, update, delete on table public.diary_balance_snapshots to authenticated;
grant all privileges on table public.diary_balance_snapshots to service_role;

create policy "snapshots_select_public_or_member"
on public.diary_balance_snapshots
for select
using (
  exists (
    select 1 from public.diaries d
    where d.id = diary_id
      and (d.is_public = true or public.is_diary_member(d.id))
  )
);

create policy "snapshots_write_owner_or_manager"
on public.diary_balance_snapshots
for all
to authenticated
using (
  public.has_diary_role(diary_id, array['owner', 'manager']::public.diary_role[])
)
with check (
  public.has_diary_role(diary_id, array['owner', 'manager']::public.diary_role[])
);

alter default privileges in schema public grant all on tables to service_role;
