-- Treat each entry as a hierarchy node (top-down record tree)

alter table public.entries
  add column if not exists parent_entry_id uuid references public.entries(id) on delete cascade,
  add column if not exists content text;

update public.entries
set content = coalesce(content, memo, '')
where content is null;

alter table public.entries
  alter column content set not null;

create index if not exists entries_diary_parent_idx
  on public.entries (diary_id, parent_entry_id, entry_date desc);
