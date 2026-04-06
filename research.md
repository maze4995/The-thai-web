# 작업 기록

## 2026-04-05

### 1. 상용화용 설정 계층 추가

- 기존 운영 매장을 깨지 않도록 새 설정 테이블만 추가하는 방향으로 [migration_product_config.sql](C:/Users/rlgus/Desktop/workspace/The-thai-web/supabase/migration_product_config.sql)을 작성했다.
- 추가한 핵심 테이블:
  - `store_settings`
  - `store_features`
  - `lookup_groups`
  - `lookup_items`
  - `service_catalog`
  - `service_prices`
- 기존 매장은 기본적으로 레거시 모드로 동작하도록 보수적인 seed를 넣는 구조로 잡았다.

### 2. 브랜드 및 설정 fallback 구조

- [branding.ts](C:/Users/rlgus/Desktop/workspace/The-thai-web/lib/branding.ts)를 추가해서 브랜드명을 한 곳에서 관리하게 정리했다.
- [store-config.ts](C:/Users/rlgus/Desktop/workspace/The-thai-web/lib/store-config.ts)에서 매장 설정 기본값과 feature flag 기본값을 분리했다.
- [StoreProvider.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/components/StoreProvider.tsx)가 `store_settings`, `store_features`를 읽도록 확장했다.
- 설정 테이블이 아직 없거나 비어 있어도 기존 매장은 fallback 값으로 계속 동작하도록 구현했다.

### 3. 웹 UI에 설정값 연결

- [AppShell.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/components/AppShell.tsx), [Sidebar.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/components/Sidebar.tsx), [login/page.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/app/login/page.tsx)에서 브랜드 하드코딩을 공통 fallback 구조로 옮겼다.
- `staffLabel`을 일부 화면에 반영했다.
  - [therapists/page.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/app/therapists/page.tsx)
  - [worklog/page.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/app/worklog/page.tsx)
  - [ScheduleBoard.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/components/ScheduleBoard.tsx)
- 기능 플래그도 일부 연결했다.
  - `worklogEnabled`
  - `scheduleBoardEnabled`

### 4. 인증, 회원가입, 온보딩 흐름

- [signup/page.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/app/signup/page.tsx)를 추가해서 신규 계정 생성 흐름을 만들었다.
- [onboarding/page.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/app/onboarding/page.tsx)를 추가해서 첫 매장 생성 화면을 만들었다.
- [migration_onboarding.sql](C:/Users/rlgus/Desktop/workspace/The-thai-web/supabase/migration_onboarding.sql)에 `create_store_onboarding` 함수를 추가했다.
- [migration_onboarding_update.sql](C:/Users/rlgus/Desktop/workspace/The-thai-web/supabase/migration_onboarding_update.sql)에 `update_store_onboarding` 함수를 추가했다.
- 기존 온보딩 완료 사용자도 `/onboarding`에서 매장 설정을 다시 수정할 수 있게 바꿨다.
- [proxy.ts](C:/Users/rlgus/Desktop/workspace/The-thai-web/proxy.ts)로 Next 16 라우팅 규칙을 맞췄다.

### 5. 서비스 설정 기반 읽기 1차

- [service-config.ts](C:/Users/rlgus/Desktop/workspace/The-thai-web/lib/service-config.ts)를 추가했다.
- 서비스명, 가격, 시간, 커미션을 `service_catalog`, `service_prices`, `lookup_items`에서 읽을 수 있게 만들었다.
- 설정이 없으면 기존 하드코딩 서비스 목록으로 fallback 하도록 유지했다.
- 아래 화면들이 설정 기반 서비스를 읽도록 연결했다.
  - [SlotModal.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/components/SlotModal.tsx)
  - [ScheduleBoard.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/components/ScheduleBoard.tsx)
  - [SummaryFooter.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/components/SummaryFooter.tsx)
  - [WeeklyStats.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/components/WeeklyStats.tsx)

### 6. 온보딩 확장: 운영 시간과 예약 간격

- 온보딩에서 아래 항목을 저장할 수 있게 확장했다.
  - 예약 간격
  - 영업 시작 시간
  - 영업 종료 시간
- 생성/수정 RPC 모두 위 값을 저장하도록 SQL 시그니처를 확장했다.

### 7. 온보딩 확장: 서비스 가격표 직접 수정

- [onboarding/page.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/app/onboarding/page.tsx)를 확장해서 서비스 가격표를 직접 수정할 수 있게 만들었다.
- 사용자가 바로 편집 가능한 항목:
  - 서비스명
  - 서비스 코드
  - 소요 시간
  - 앱 가격
  - 로드 가격
  - 커미션
- 서비스 추가/삭제도 같은 화면에서 가능하도록 구현했다.

추가 구현:

- [service-admin.ts](C:/Users/rlgus/Desktop/workspace/The-thai-web/lib/service-admin.ts)
  - `syncStoreServices(storeId, services)` 유틸 추가
  - `service_catalog`를 upsert
  - 화면에서 제거된 서비스는 `is_active = false` 처리
  - `member_type` lookup을 읽어서 `service_prices`를 다시 저장
  - `app_member`, `road_member` 가격표를 매장별로 갱신

검증 규칙:

- 서비스는 최소 1개 이상 있어야 함
- 서비스명과 서비스 코드는 비어 있으면 안 됨
- 서비스 코드는 중복되면 안 됨

저장 흐름:

- 기본 정보 저장 RPC 실행
  - 신규 매장: `create_store_onboarding`
  - 기존 매장 수정: `update_store_onboarding`
- RPC 결과의 `created_store_id` 또는 `updated_store_id`를 기준으로 `syncStoreServices()` 실행
- 기본 정보 저장은 성공했지만 서비스 설정 저장이 실패하면 별도 오류 메시지로 안내

### 8. 현재 테스트 전제 조건

- 실제 저장까지 확인하려면 아래 SQL이 Supabase에 적용되어 있어야 한다.
  - [migration_product_config.sql](C:/Users/rlgus/Desktop/workspace/The-thai-web/supabase/migration_product_config.sql)
  - [migration_onboarding.sql](C:/Users/rlgus/Desktop/workspace/The-thai-web/supabase/migration_onboarding.sql)
  - [migration_onboarding_update.sql](C:/Users/rlgus/Desktop/workspace/The-thai-web/supabase/migration_onboarding_update.sql)

### 9. 검증 결과

- 아래 파일은 lint 기준으로 통과했다.
  - [app/onboarding/page.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/app/onboarding/page.tsx)
  - [lib/service-admin.ts](C:/Users/rlgus/Desktop/workspace/The-thai-web/lib/service-admin.ts)
- 실행한 명령:
  - `npx eslint app/onboarding/page.tsx lib/service-admin.ts`

### 10. 남아 있는 하드코딩 범위

- 영업시간의 실제 화면/로직 적용
- 고객등급 lookup 완전 전환
- 로드/어플 고객 구분 및 신규/기존 카운팅 로직
- 쿠폰 구조 재설계
- 모바일 앱 쪽 설정 연동

### 11. 특정 기기 로그인 직후 로그아웃 문제 완화

- 특정 기기에서 로그인 직후 세션이 풀리는 현상을 완화하기 위해, 인증/매장 조회 흐름에서 과도한 재조회와 `406` 응답 가능성을 줄였다.

수정 내용:

- [StoreProvider.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/components/StoreProvider.tsx)
  - `auth.getUser()` 대신 `auth.getSession()` 기반으로 세션 확인
  - `TOKEN_REFRESHED` 이벤트 때마다 무조건 `loadStore()`를 다시 호출하지 않도록 조정
  - 이미 같은 사용자 세션이면 재조회하지 않도록 `lastUserIdRef` 추가
  - 중복 호출 방지를 위해 `loadingRef` 추가
  - `store_members` 조회를 `limit(1).maybeSingle()`로 변경해 0건/다건 응답에서 `406` 발생 가능성을 줄임
- [app/page.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/app/page.tsx)
  - `store_members` 조회를 `limit(1).maybeSingle()`로 변경
- [proxy.ts](C:/Users/rlgus/Desktop/workspace/The-thai-web/proxy.ts)
  - `store_members` 조회를 `limit(1).maybeSingle()`로 변경
- [ScheduleBoard.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/components/ScheduleBoard.tsx)
  - `daily_settings` 조회를 `maybeSingle()`로 변경해 설정 행이 없는 날짜에서 `406`이 나지 않도록 수정

의도:

- `store_members`가 비어 있거나 여러 건일 때 발생하던 `406`을 줄이기
- 세션 refresh 이벤트가 짧은 시간에 연속으로 겹치면서 `refresh_token` 요청이 과도하게 발생하는 상황을 완화하기

검증:

- `npx eslint components/StoreProvider.tsx`
- `npx eslint app/page.tsx`
- `npx eslint proxy.ts`

위 세 파일은 통과했다.

- `npx eslint components/ScheduleBoard.tsx`
  - 기존에 있던 `autoAssignReservation` dependency warning 1건만 남아 있다.
## 2026-04-06 추가

### 예약 자동 슬롯 생성 서버화

- 예약 자동 슬롯 생성 책임을 브라우저 realtime 구독에서 DB 트리거로 옮겼다.
- [ScheduleBoard.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/components/ScheduleBoard.tsx)
  - `reservations` INSERT 구독 제거
  - 화면은 `schedule_slots`, `daily_attendance` 변경만 구독
- [migration_auto_assign_slot.sql](C:/Users/rlgus/Desktop/workspace/The-thai-web/supabase/migration_auto_assign_slot.sql)
  - `reservations_auto_assign_schedule_slot()` 트리거 함수 추가
  - 예약 INSERT 또는 주요 필드 UPDATE 시 DB가 직접 자동 슬롯 생성
- 기대 효과
  - 여러 탭, 여러 기기, 로컬/배포 환경이 동시에 열려 있어도 자동 슬롯 생성은 DB에서 한 번만 실행
  - 클라이언트 중복 구독으로 인한 이중 생성 가능성 제거
