-- Initial schema for TopDownBudget (fresh database bootstrap)

create extension if not exists "pgcrypto";

create type public.diary_role as enum ('owner', 'manager', 'viewer');
create type public.entry_type as enum ('income', 'expense');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create table public.diaries (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  title text not null,
  is_public boolean not null default false,
  base_currency text not null default 'KRW',
  created_at timestamptz not null default now(),
  constraint diaries_base_currency_check check (char_length(base_currency) between 3 and 10)
);

create table public.diary_memberships (
  id uuid primary key default gen_random_uuid(),
  diary_id uuid not null references public.diaries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.diary_role not null,
  created_at timestamptz not null default now(),
  unique (diary_id, user_id)
);

create table public.diary_subscriptions (
  id uuid primary key default gen_random_uuid(),
  diary_id uuid not null references public.diaries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (diary_id, user_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  diary_id uuid not null references public.diaries(id) on delete cascade,
  name text not null,
  parent_category_id uuid references public.categories(id) on delete cascade,
  depth smallint not null default 0,
  sort_order integer not null default 0,
  parent_amount numeric(14, 2),
  created_at timestamptz not null default now(),
  constraint categories_depth_check check (depth >= 0 and depth <= 10)
);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  diary_id uuid not null references public.diaries(id) on delete cascade,
  entry_type public.entry_type not null,
  amount numeric(14, 2) not null,
  currency text not null default 'KRW',
  category_id uuid references public.categories(id) on delete set null,
  memo text,
  entry_date date not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint entries_amount_check check (amount >= 0),
  constraint entries_currency_check check (char_length(currency) between 3 and 10)
);

create index entries_diary_date_idx on public.entries (diary_id, entry_date desc);
create index entries_diary_category_date_idx on public.entries (diary_id, category_id, entry_date desc);
create index entries_diary_currency_idx on public.entries (diary_id, currency);
create index diary_memberships_diary_user_idx on public.diary_memberships (diary_id, user_id);
create index diary_subscriptions_diary_idx on public.diary_subscriptions (diary_id);
create index diary_subscriptions_user_idx on public.diary_subscriptions (user_id);
create index diaries_is_public_idx on public.diaries (is_public);

create or replace view public.v_category_summary_with_other as
with child_sum as (
  select
    c.parent_category_id,
    sum(e.amount) filter (where e.entry_type = 'expense') as children_sum
  from public.categories c
  left join public.entries e on e.category_id = c.id
  group by c.parent_category_id
)
select
  p.id as category_id,
  p.diary_id,
  p.name,
  p.parent_amount,
  coalesce(cs.children_sum, 0) as children_sum,
  coalesce(p.parent_amount, 0) - coalesce(cs.children_sum, 0) as other_amount,
  (coalesce(p.parent_amount, 0) - coalesce(cs.children_sum, 0) < 0) as is_over_allocated
from public.categories p
left join child_sum cs on cs.parent_category_id = p.id;

alter table public.profiles enable row level security;
alter table public.diaries enable row level security;
alter table public.diary_memberships enable row level security;
alter table public.diary_subscriptions enable row level security;
alter table public.categories enable row level security;
alter table public.entries enable row level security;

create or replace function public.is_diary_member(target_diary_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.diary_memberships dm
    where dm.diary_id = target_diary_id
      and dm.user_id = auth.uid()
  );
$$;

create or replace function public.has_diary_role(target_diary_id uuid, allowed_roles public.diary_role[])
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.diary_memberships dm
    where dm.diary_id = target_diary_id
      and dm.user_id = auth.uid()
      and dm.role = any(allowed_roles)
  );
$$;

create policy "profiles_select_self"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "diaries_select_public_or_member"
on public.diaries
for select
using (
  is_public = true
  or public.is_diary_member(id)
);

create policy "diaries_insert_authenticated"
on public.diaries
for insert
to authenticated
with check (
  owner_user_id = auth.uid()
);

create policy "diaries_update_owner_only"
on public.diaries
for update
to authenticated
using (
  public.has_diary_role(id, array['owner']::public.diary_role[])
)
with check (
  public.has_diary_role(id, array['owner']::public.diary_role[])
);

create policy "diaries_delete_owner_only"
on public.diaries
for delete
to authenticated
using (
  public.has_diary_role(id, array['owner']::public.diary_role[])
);

create policy "memberships_select_member_or_public_diary"
on public.diary_memberships
for select
to authenticated
using (
  public.is_diary_member(diary_id)
  or exists (
    select 1 from public.diaries d
    where d.id = diary_id and d.is_public = true
  )
);

create policy "memberships_insert_owner_or_manager"
on public.diary_memberships
for insert
to authenticated
with check (
  public.has_diary_role(diary_id, array['owner', 'manager']::public.diary_role[])
);

create policy "memberships_update_owner_only"
on public.diary_memberships
for update
to authenticated
using (
  public.has_diary_role(diary_id, array['owner']::public.diary_role[])
)
with check (
  public.has_diary_role(diary_id, array['owner']::public.diary_role[])
);

create policy "memberships_delete_owner_only"
on public.diary_memberships
for delete
to authenticated
using (
  public.has_diary_role(diary_id, array['owner']::public.diary_role[])
);

create policy "categories_select_public_or_member"
on public.categories
for select
using (
  exists (
    select 1 from public.diaries d
    where d.id = diary_id
      and (d.is_public = true or public.is_diary_member(d.id))
  )
);

create policy "categories_write_owner_or_manager"
on public.categories
for all
to authenticated
using (
  public.has_diary_role(diary_id, array['owner', 'manager']::public.diary_role[])
)
with check (
  public.has_diary_role(diary_id, array['owner', 'manager']::public.diary_role[])
);

create policy "entries_select_public_or_member"
on public.entries
for select
using (
  exists (
    select 1 from public.diaries d
    where d.id = diary_id
      and (d.is_public = true or public.is_diary_member(d.id))
  )
);

create policy "entries_write_owner_or_manager"
on public.entries
for all
to authenticated
using (
  public.has_diary_role(diary_id, array['owner', 'manager']::public.diary_role[])
)
with check (
  public.has_diary_role(diary_id, array['owner', 'manager']::public.diary_role[])
);

create policy "subscriptions_select_owner_or_self"
on public.diary_subscriptions
for select
to authenticated
using (
  user_id = auth.uid()
  or public.has_diary_role(diary_id, array['owner']::public.diary_role[])
);

create policy "subscriptions_insert_self"
on public.diary_subscriptions
for insert
to authenticated
with check (
  user_id = auth.uid()
);

create policy "subscriptions_delete_self_or_owner"
on public.diary_subscriptions
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.has_diary_role(diary_id, array['owner']::public.diary_role[])
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
