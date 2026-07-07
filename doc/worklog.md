# TopDownBudget 작업 로그

> 마지막 갱신: 2026-07-07 (생성/조회 권한 이슈 해결 반영)

## 오늘까지 한 일
- Supabase 초기 마이그레이션 기준선 생성 및 원격 DB와 정렬 완료
- 로그인 / 회원가입 플로우 추가
- 홈 화면에서 접근 가능한 가계부 목록 조회 연결
- 로그인 / 회원가입 화면 UI를 미니멀 톤으로 정리
- Supabase Auth URL 설정 관련 주의사항을 문서에 반영
- Git push 실패 원인을 브랜치명 `main` / `master` 차이로 확인
- 홈 하이라키 그리드를 샘플이 아닌 DB(categories, entries) 기반 미리보기로 전환
- 가계부 생성 시 `permission denied` / `RLS` 에러 원인 파악 및 서버 액션 쓰기 경로 안정화
- 생성 직후 상세 404 이슈 해결 (명시적 접근 검사 방식으로 조회 안정화)
- 홈 카드 미노출 이슈 해결 (홈 목록 조회를 동일한 접근 검사 방식으로 정리)
- 권한 관련 후속 마이그레이션 추가

## 만든 페이지
- `/` 메인 홈
- `/login` 로그인
- `/signup` 회원가입
- `/new` 새 가계부 생성
- `/diary/[id]` 가계부 상세

## 만든 주요 파일
- `actions/auth-actions.ts`
- `actions/diary-actions.ts`
- `app/layout.tsx`
- `app/page.tsx`
- `app/login/page.tsx`
- `app/signup/page.tsx`
- `app/new/page.tsx`
- `app/diary/[id]/page.tsx`
- `lib/auth/permissions.ts`
- `lib/diary/queries.ts`
- `lib/supabase/config.ts`
- `lib/supabase/admin.ts`
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `supabase/migrations/202607060001_init_top_down_budget.sql`
- `supabase/migrations/202607070002_fix_grants_and_membership_insert.sql`
- `supabase/migrations/202607070003_grant_service_role_privileges.sql`

## 현재 상태
- 로그인/회원가입 모두 성공 확인됨
- 회원가입 redirect 설정 재확인 완료
- Supabase URL 값은 `/rest/v1/`가 아니라 프로젝트 origin만 쓰도록 정리됨
- `env/.env.local`의 `NEXT_PUBLIC_SITE_URL=http://localhost:3000` 반영 상태 기준으로 동작 확인
- 홈에서 최신 가계부 기준 하이라키 요약이 실제 DB 데이터로 표시됨(읽기 전용)
- 가계부 생성 후 상세 페이지 진입 가능 확인
- 홈 가계부 카드 노출 정상 확인

## 다음 할 일
1. 상세 페이지(`/diary/[id]`)에서 entries/categories 목록 + 필터 기본형 연결
2. `edit` 페이지 생성 및 owner/manager 권한 가드 연결
3. 하이라키 그리드 편집값을 DB에 저장하는 Server Action 설계/연결
4. 로그인/회원가입 에러 UX 다듬기(필드 단위 검증 포함)

## 메모
- Supabase URL 예시는 `https://<project-ref>.supabase.co` 형태를 쓴다.
- Redirect URL은 `http://localhost:3000/login`처럼 정확한 경로를 넣는 편이 안전하다.
- 브랜치 푸시는 `main` 기준으로 수행한다.
