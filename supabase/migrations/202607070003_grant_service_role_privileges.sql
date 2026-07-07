-- Grant privileges to service_role for server-side admin operations

grant usage on schema public to service_role;

grant all privileges on table public.diaries to service_role;
grant all privileges on table public.diary_memberships to service_role;
grant all privileges on table public.diary_subscriptions to service_role;
grant all privileges on table public.categories to service_role;
grant all privileges on table public.entries to service_role;
grant all privileges on table public.profiles to service_role;

grant select on table public.v_category_summary_with_other to service_role;

grant execute on function public.is_diary_member(uuid) to service_role;
grant execute on function public.has_diary_role(uuid, public.diary_role[]) to service_role;

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all functions in schema public to service_role;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;
