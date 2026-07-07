alter table public.entries
  add column if not exists sort_order integer not null default 0;

with ranked as (
  select
    id,
    row_number() over (
      partition by diary_id, parent_entry_id
      order by created_at asc, id asc
    ) - 1 as next_sort_order
  from public.entries
)
update public.entries e
set sort_order = ranked.next_sort_order
from ranked
where ranked.id = e.id;

create index if not exists entries_diary_parent_sort_idx
  on public.entries (diary_id, parent_entry_id, sort_order asc, created_at asc);
