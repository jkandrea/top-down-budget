# TopDownBudget 작업 로그

> 마지막 갱신: 2026-07-24 (entries 편집/정산 UX 반영)

## 오늘까지 정리
- 인증 흐름(로그인/회원가입/로그아웃) 및 권한 기반 접근(owner/manager/viewer/guest) 안정화
- 가계부 홈/상세/수정/내역 페이지 기본 흐름 연결 완료
- Supabase 권한 이슈(RLS, grant, redirect URL, URL origin) 정리 및 서버 액션 경로 안정화
- 내역을 트리 노드로 취급하는 데이터 모델 확장 완료
- 내역 등록 로직을 부호 기반(+ 수입 / - 지출)으로 통일
- 홈 카드 클릭 동작 개선:
	- owner/manager는 카드 클릭 시 상세가 아니라 내역 페이지로 바로 진입
- 내역 페이지 UX 개편:
	- 상단 기본 등록 폼은 항상 루트 내역 추가
	- 트리 구조 변경은 드래그앤드롭(moveEntryAction)으로 처리
- entries 접근 UX 개선:
	- 접근 불가 시 404 대신 안내 화면으로 이동(로그인 유도/홈 이동)
- 트리 편집 UX 확장:
	- 금액 인라인 수정 + 포커스 아웃 자동 저장
	- 총액 정산, 잔액 정산(기타 자동 생성/업데이트)
	- 행 단위 삭제 + 인앱 확인 모달

## 다음에 바로 이어서 할 일
1. 모바일 DnD 대안 검토
	 - 터치 환경에서 포인터 기반 정렬 UX 설계
2. 내역 수정 범위 확장
	 - 내용/분류/메모/날짜 인라인 수정
3. 정산/삭제 UX 보강
	 - 정산 성공/실패 토스트 및 히스토리 표시
	 - 삭제 모달 접근성(키보드 포커스 트랩) 강화
4. 상세 페이지 고도화
	 - 필터 URL 동기화, 정렬/페이지네이션

## 일자별 주요 작업 이력

### 2026-07-02
- 백엔드 스택 Supabase 중심으로 확정(Auth/Postgres/Storage)
- 프로젝트 개념/구성 문서 정리 시작

### 2026-07-03
- 권한 모델(owner/manager/viewer)과 공개/비공개 접근 규칙 정리
- 가계부 트리 기반 도메인 방향(탑다운) 확정

### 2026-07-06
- 초기 스키마/정책 마이그레이션 정리
	- 202607060001_init_top_down_budget.sql
- Supabase CLI 연동 및 원격 상태 정렬

### 2026-07-07
- 인증/리다이렉트 이슈 정리, 로그인/회원가입 성공 확인
- 가계부 생성/조회 경로에서 permission denied, RLS 이슈 수정
- 홈 카드/상세 404/목록 미노출 이슈 해결
- 내역 트리 전환 단계 진행
	- 202607070005_entry_tree_nodes.sql (entries.parent_entry_id, entries.content)
	- 내역 생성 시 부호 금액 기반 수입/지출 판별
- UX 재개편
	- owner/manager 홈 카드 클릭 시 entries로 직접 진입
	- 내역 등록 상단 고정 루트 입력 + DnD 기반 관계 재구성
	- moveEntryAction 추가
	- 202607070006_entry_sort_order.sql 추가

### 2026-07-24
- 접근 UX 수정
	- `/diary/[id]`, `/diary/[id]/entries` 접근 실패 시 404 대신 안내 화면 렌더링
- DnD 개선
	- 드래그 핸들(6-dot) 기반으로 안정화
	- 드래그 중 DOM 변형 제거로 중간/하단 항목 드래그 이슈 해결
	- 위/자식/아래 드롭 프리뷰를 동일 행 내부 점선 하이라이트로 통일
- entries 편집/정산 기능 추가
	- 금액 인라인 입력 및 onBlur 자동 저장
	- 총액 정산: 하위 합계로 부모 금액 자동 업데이트
	- 잔액 정산: `기타` 제외 합계를 기준으로 차액을 `기타`에 반영
	- `기타` 기존 항목이 있으면 업데이트, 없으면 생성
- 삭제 UX 개선
	- 행 단위 삭제 버튼 추가
	- 브라우저 confirm 제거, 인앱 모달 확인으로 대체
	- 하단 일괄 삭제 섹션 제거

## 이번 세션 주요 변경 파일
- actions/entry-actions.ts
- app/page.tsx
- app/diary/[id]/page.tsx
- app/diary/[id]/entries/page.tsx
- components/diary/entry-tree-dnd.tsx
- lib/diary/queries.ts
- supabase/migrations/202607070006_entry_sort_order.sql

## 메모
- Supabase URL은 프로젝트 origin만 사용한다.
- Redirect URL은 정확한 경로로 등록한다.
- 브랜치 푸시는 main 기준으로 수행한다.
