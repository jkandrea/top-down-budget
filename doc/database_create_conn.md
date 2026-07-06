Updated todo list

할 일 순서대로만 정리하면, Supabase에서는 “프로젝트 생성 → DB/인증 기본 설정 → 키 복사 → Next 앱에 연결 → 스키마/정책 적용 → 동작 확인” 순서로 가면 됩니다.

**1. Supabase 프로젝트 만들기**
1. Supabase 대시보드에 로그인합니다.
2. `New project`를 누릅니다.
3. Organization을 고릅니다.
4. Project name은 `top-down-budget`처럼 명확하게 넣습니다.
5. Database Password를 설정합니다.
이건 나중에 직접 DB 접속할 때도 쓰이니 따로 저장해야 합니다.
6. Region은 한국 사용자 기준으로 가장 가까운 곳을 고릅니다.
보통 `Northeast Asia` 계열이 적절합니다.
7. Pricing은 일단 Free로 시작하면 됩니다.
8. `Create new project`를 누르고 완료될 때까지 기다립니다.

**2. 프로젝트 기본 정보 챙기기**
1. 프로젝트가 생성되면 `Project Settings`로 들어갑니다.
2. `Data API` 또는 `API` 섹션에서 아래 3개를 확보합니다.
`Project URL`
`anon public key`
`service_role key`
3. 이 중 프론트에 직접 쓰는 건 `anon public key`입니다.
4. `service_role key`는 서버 전용입니다.
브라우저에 노출되면 안 됩니다.
5. `Project URL`은 `https://<project-ref>.supabase.co` 형태의 원본 주소를 쓰고, `/rest/v1/` 같은 경로는 붙이지 않습니다.

**3. Auth 기본 설정**
1. 좌측 메뉴에서 `Authentication`으로 갑니다.
2. `Providers`에서 우선 `Email` 로그인을 켭니다.
3. 초반 MVP면 `Email + Password`만 먼저 켜는 게 맞습니다.
4. `URL Configuration`에서 Site URL을 설정합니다.
개발 중이면 `http://localhost:3000`
5. 나중에 배포하면 배포 URL도 추가합니다.
6. 이메일 인증을 바로 강제할지 결정합니다.
처음에는 개발 속도를 위해 완화해도 되지만, 서비스 전환 전에는 정책을 다시 조여야 합니다.
7. Redirect URL은 와일드카드보다 정확한 경로를 넣는 편이 안전합니다.
개발 중에는 `http://localhost:3000/login` 을 Additional Redirect URLs에 넣습니다.
`http://localhost:3000/**` 만 넣는 것보다 `/login`처럼 실제 이메일 확인 후 돌아오는 경로를 명시하는 쪽이 덜 헷갈립니다.

**4. DB 설계에서 한 가지 수정할 점**
기획서에는 `users` 테이블이 있지만, Supabase에서는 기본 사용자 테이블이 이미 `auth.users`에 있습니다. 그래서 보통은 직접 `users` 테이블을 만들지 않고 아래 둘 중 하나로 갑니다.

1. 사용자 정보가 로그인 식별만 필요하다면 `auth.users`만 사용
2. 닉네임, 아바타 같은 앱 전용 정보가 필요하면 `profiles` 테이블을 따로 만들고 `auth.users.id`를 참조

이 프로젝트는 우선 2번이 안전합니다.

**5. SQL Editor에서 MVP 스키마 만들기**
1. 좌측 `SQL Editor`로 갑니다.
2. `New query`를 누릅니다.
3. 아래 순서대로 SQL을 실행합니다.
처음부터 한 파일에 다 넣어도 되지만, 실패했을 때 찾기 쉽게 나눠서 실행하는 편이 낫습니다.

먼저 enum과 profiles:

```sql
create type public.diary_role as enum ('owner', 'manager', 'viewer');
create type public.entry_type as enum ('income', 'expense');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);
```

그다음 핵심 테이블:

```sql
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
```

인덱스도 바로 만듭니다.

```sql
create index entries_diary_date_idx on public.entries (diary_id, entry_date desc);
create index entries_diary_category_date_idx on public.entries (diary_id, category_id, entry_date desc);
create index entries_diary_currency_idx on public.entries (diary_id, currency);
create index diary_memberships_diary_user_idx on public.diary_memberships (diary_id, user_id);
create index diary_subscriptions_diary_idx on public.diary_subscriptions (diary_id);
create index diary_subscriptions_user_idx on public.diary_subscriptions (user_id);
create index diaries_is_public_idx on public.diaries (is_public);
```

**6. 기타 자동 계산용 뷰 만들기**
기획서 방향대로 먼저 기본 뷰를 만듭니다.

```sql
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
```

다만 이 뷰는 월 필터가 아직 없습니다. 그래서 MVP에서는 “기본 구조 확인용”으로 두고, 월별 통계 단계에서 RPC나 월 조건 버전 뷰로 확장하는 게 맞습니다.

**7. RLS 켜기**
각 테이블에 RLS를 켭니다.

```sql
alter table public.profiles enable row level security;
alter table public.diaries enable row level security;
alter table public.diary_memberships enable row level security;
alter table public.diary_subscriptions enable row level security;
alter table public.categories enable row level security;
alter table public.entries enable row level security;
```

**8. RLS 정책 만들기**
핵심은 “public 또는 멤버면 읽기 가능”, “owner/manager만 수정 가능”, “권한 변경은 owner만”입니다.

먼저 재사용용 함수를 두는 게 낫습니다.

```sql
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
```

그 다음 `diaries`:

```sql
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
```

`diary_memberships`:

```sql
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
```

`categories`와 `entries`는 같은 패턴입니다.

```sql
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
```

```sql
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
```

구독 테이블:

```sql
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
```

**9. 회원가입 시 profiles 자동 생성**
회원이 생길 때 `profiles`에 자동 행을 넣고 싶으면 트리거를 둡니다.

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
```

**10. Next.js 앱에 Supabase 연결**
지금 프로젝트는 아직 Supabase 패키지가 없습니다. package.json 기준으로 먼저 설치해야 합니다.

1. 터미널에서 아래를 실행합니다.

```bash
npm install @supabase/supabase-js @supabase/ssr
```

2. 프로젝트 루트에 `.env.local`을 만듭니다.
3. 아래 값을 넣습니다.

```env
NEXT_PUBLIC_SUPABASE_URL=여기에_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=여기에_anon_key
SUPABASE_SERVICE_ROLE_KEY=여기에_service_role_key
```

4. `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용으로만 쓰세요.

**11. Next 쪽 최소 파일 구조**
기획서 기준으로 최소 이 정도부터 시작하면 됩니다.

1. `lib/supabase/client.ts`
브라우저 클라이언트
2. `lib/supabase/server.ts`
서버 컴포넌트/서버 액션용
3. `lib/auth/permissions.ts`
owner, manager, viewer 판별
4. `lib/diary/queries.ts`
가계부 목록, 상세 조회
5. `actions/diary-actions.ts`
가계부 생성
6. `app/new/page.tsx`
생성 폼
7. `app/diary/[id]/page.tsx`
상세 조회

최소 연결 예시는 이런 식입니다.

브라우저용:

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

서버용은 Next 16 쿠키 접근 방식에 맞춰 따로 구성해야 합니다. 그 단계에서 내가 코드까지 같이 봐드릴 수 있습니다.

**12. 가장 먼저 만들 기능**
여기서 욕심내지 말고 이 3개만 먼저 끝내는 게 맞습니다.

1. 로그인
2. `/new`에서 가계부 생성
3. `/diary/[id]`에서 public/private 권한에 따라 상세 조회

이 3개가 되면 그 다음에야 현재 데모 그리드 hierarchy-budget-grid.tsx를 실제 DB 데이터에 붙일 수 있습니다.

**13. 생성 액션의 핵심 규칙**
가계부 생성 시에는 반드시 두 작업이 한 세트여야 합니다.

1. `diaries`에 row insert
2. 같은 `diary_id`로 `diary_memberships`에 owner row insert

즉, 생성 직후 owner 권한이 자동으로 잡혀야 합니다. 이건 기획서 권한 모델의 핵심입니다 project_concept.md.

**14. Supabase 대시보드에서 바로 검증하는 순서**
1. Authentication에서 테스트 계정 하나 생성
2. SQL Editor에서 해당 유저 id로 샘플 `diaries` 삽입
3. `diary_memberships`에 owner 추가
4. Table Editor에서 데이터 확인
5. public/private 한 개씩 만들어서 조회 정책 확인
6. private인데 멤버십 없는 계정으로 접근 시 차단되는지 확인

**15. 지금 단계에서 흔히 틀리는 부분**
1. `users` 테이블을 따로 만들고 `auth.users`와 이중 관리하는 것
2. `service_role key`를 클라이언트에 노출하는 것
3. diary 생성만 하고 membership owner 행을 안 넣는 것
4. RLS를 켜고도 insert 정책을 안 만들어서 생성이 안 되는 것
5. `public이면 누구나 조회`와 `편집은 owner/manager만`을 혼동하는 것
6. `기타`를 저장 컬럼으로 만들어버리는 것

여기까지 하면 Supabase 쪽 기반은 거의 끝입니다. 다음으로 자연스러운 단계는 둘 중 하나입니다.

1. 내가 바로 “이 프로젝트용 첫 마이그레이션 SQL”을 파일 단위로 정리해드리기
2. Next.js 쪽 `lib/supabase`, `app/new`, `app/diary/[id]` 구현 순서를 코드 수준으로 정리해드리기

**16. 9번까지 끝낸 뒤(이미 DB 수동 적용된 상태) 다음 단계**
지금부터 핵심은 "대시보드에서 수동으로 만든 스키마"를 "프로젝트 파일"로 고정하는 것입니다.

이 레포에는 초기 마이그레이션 파일을 추가해 두었습니다.

- `supabase/migrations/202607060001_init_top_down_budget.sql`

주의:
- 이미 같은 스키마가 올라간 원격 DB에 이 SQL을 다시 실행하면 중복 생성 오류가 날 수 있습니다.
- 이 파일은 "신규 DB를 같은 구조로 시작할 때" 기준선으로 사용하세요.

**17. 안전한 운영 흐름 (권장)**
1. 현재 운영/개발에 쓰는 원격 Supabase 프로젝트는 그대로 둡니다.
2. 앞으로 스키마 변경은 반드시 `supabase/migrations/*.sql` 파일로만 기록합니다.
3. 신규 환경(새 프로젝트, 테스트 DB)에는 마이그레이션 파일을 적용해 동일 상태를 재현합니다.

**18. Supabase CLI 기준 명령 순서**
CLI가 준비되면 아래 순서로 진행하면 됩니다.

```bash
# 1) CLI 준비
npm install -D supabase

# 2) 로그인
npx supabase login

# 3) 프로젝트 링크 (project ref 필요)
npx supabase link --project-ref <your-project-ref>

# 4) (선택) 원격 상태를 기준으로 pull 받아 현재 DB와 차이를 확인
npx supabase db pull
```

메모:
- `db pull`은 "현재 원격 DB 구조를 로컬 migration으로 가져오는" 방식입니다.
- 이미 레포에 기준선 SQL이 있다면, 둘 중 하나를 기준으로 정해서 하나만 유지하세요.

**19. 지금 이 프로젝트 기준 체크 포인트**
- 10~13번에 해당하는 Next 코드 최소 뼈대는 이미 들어가 있습니다.
  - `lib/supabase/client.ts`
  - `lib/supabase/server.ts`
  - `lib/auth/permissions.ts`
  - `lib/diary/queries.ts`
  - `actions/diary-actions.ts`
  - `app/new/page.tsx`
  - `app/diary/[id]/page.tsx`

즉, 지금 바로 할 일은 "DB 기준선 확정(마이그레이션 체계 정착)"과 "로그인 플로우 연결"입니다.