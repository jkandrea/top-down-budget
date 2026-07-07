-- Fix table privileges and bootstrap membership insert policy for diary creation

-- 1) Grants: allow roles to access public schema and tables (RLS still enforces row rules)
grant usage on schema public to anon, authenticated;

grant select on table public.diaries to anon, authenticated;
grant insert, update, delete on table public.diaries to authenticated;

grant select on table public.diary_memberships to authenticated;
grant insert, update, delete on table public.diary_memberships to authenticated;

grant select on table public.diary_subscriptions to authenticated;
grant insert, delete on table public.diary_subscriptions to authenticated;

grant select on table public.categories to anon, authenticated;
grant insert, update, delete on table public.categories to authenticated;

grant select on table public.entries to anon, authenticated;
grant insert, update, delete on table public.entries to authenticated;

grant select, update on table public.profiles to authenticated;

grant select on table public.v_category_summary_with_other to anon, authenticated;

grant execute on function public.is_diary_member(uuid) to anon, authenticated;
grant execute on function public.has_diary_role(uuid, public.diary_role[]) to anon, authenticated;

-- 2) Policy fix: allow creator to add initial owner membership right after diary creation
drop policy if exists "memberships_insert_owner_or_manager" on public.diary_memberships;

create policy "memberships_insert_owner_or_manager"
on public.diary_memberships
for insert
to authenticated
with check (
  public.has_diary_role(diary_id, array['owner', 'manager']::public.diary_role[])
  or exists (
    select 1
    from public.diaries d
    where d.id = diary_id
      and d.owner_user_id = auth.uid()
  )
);
