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

## 제품 의도와 개발 원칙

### 제품 의도

- 이 시스템의 본질은 `예약 기반 마사지샵/피부샵의 카운터 업무 자동화`다.
- 웹앱과 모바일앱은 서로 다른 제품이 아니라, 같은 현장 운영 시스템의 두 화면이다.
- 둘 다 `현장 실사용자용 도구`이며, 고객용 앱이나 관리자 전용 백오피스가 아니다.
- 핵심 목적은 카운터 직원의 반복 업무를 줄이고, 클릭 수와 입력 수를 줄이고, 실수를 줄이는 것이다.

### 웹앱의 역할

- 카운터에서 큰 화면으로 빠르게 처리해야 하는 업무 중심
- 조판지 확인 및 배정
- 출근/배치 관리
- 통계 확인
- 업무일지 및 인수인계

### 모바일앱의 역할

- 이동 중이거나 손에 들고 바로 처리해야 하는 업무 중심
- 고객 검색
- 예약 등록/수정/취소
- 쿠폰/방문 이력 확인
- 전화 응대 후 예약 연결

### 개발 원칙

- 빠른 반응 속도
- 적은 클릭 수
- 적은 입력 수
- 실시간 동기화
- 기존 매장 운영 흐름을 깨지 않는 점진적 개선
- 하드코딩된 매장 규칙은 설정값으로 이동
- 중요한 비즈니스 로직은 가능한 서버/DB가 단일 진실 원천을 가지도록 설계

## 의도 기준 코드 리스크 분해

### 1. 가장 위험한 영역: 인증 기준 불일치

- 웹에서 인증 기준이 서버와 클라이언트로 나뉘어 있다.
- [app/page.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/app/page.tsx), [app/stats/page.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/app/stats/page.tsx)는 서버 세션 기준으로 동작한다.
- [components/StoreProvider.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/components/StoreProvider.tsx), [app/therapists/page.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/app/therapists/page.tsx), [app/worklog/page.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/app/worklog/page.tsx)는 클라이언트 상태 비중이 크다.
- 결과적으로 세션이 어긋나면 조판지/통계는 안 보이고 다른 페이지는 보이는 현상이 생길 수 있다.
- 현장 도구 관점에서 이 문제는 치명적이다. 직원은 "왜 어떤 화면만 안 열리는지"를 이해하기 어렵다.

### 2. 가장 위험한 영역: 매장 필터 누락 가능성

- [app/therapists/page.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/app/therapists/page.tsx)는 `therapists`, `daily_attendance` 조회 시 `store_id` 필터가 없다.
- 멀티스토어 구조가 커질수록 다른 매장 데이터가 섞이거나, RLS에만 과도하게 의존하는 형태가 된다.
- 현장 카운터 도구는 "다른 매장 데이터가 보이지 않는 것"이 기본 전제여야 하므로, 모든 화면에서 `store_id`를 명시적으로 거는 것이 안전하다.

### 3. 조판지: 반응성보다 전체 재조회 비중이 큼

- [components/ScheduleBoard.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/components/ScheduleBoard.tsx)는 슬롯 하나 변경, 출근 하나 변경에도 당일 데이터를 통으로 다시 읽는 구조다.
- realtime 이벤트가 올 때마다 `schedule_slots`, `daily_attendance`, `daily_settings`를 다시 읽는다.
- 드래그/드롭, 슬롯 수정이 잦은 현장 화면에서는 부분 갱신보다 전체 재조회가 많아질수록 체감이 무거워진다.
- 현재는 데이터량이 적으면 버티지만, 예약/슬롯 수가 늘수록 가장 먼저 느려질 가능성이 높은 화면이다.

### 4. 통계: 현장용 도구인데 계산이 클라이언트 편중

- [components/WeeklyStats.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/components/WeeklyStats.tsx)는 기간별 `schedule_slots`를 전부 가져온 뒤 브라우저에서 매출, 신규, 쿠폰, 특가, 커미션을 계산한다.
- 데이터가 늘수록 페이지 진입이 느려지고, 기기 성능에 따라 체감 차이도 커진다.
- 현장 도구는 "들어가면 바로 숫자가 보여야" 하므로, 통계 계산은 서버 집계나 RPC 쪽으로 옮기는 것이 맞다.

### 5. 업무 규칙이 웹/모바일/DB에 분산

- 웹의 [lib/utils.ts](C:/Users/rlgus/Desktop/workspace/The-thai-web/lib/utils.ts)
- 웹의 [supabase/migration_auto_assign_slot.sql](C:/Users/rlgus/Desktop/workspace/The-thai-web/supabase/migration_auto_assign_slot.sql)
- 모바일의 [supabase_service.dart](C:/Users/rlgus/Desktop/workspace/the_thai_app/lib/services/supabase_service.dart)
- 모바일의 [reservation_screen.dart](C:/Users/rlgus/Desktop/workspace/the_thai_app/lib/screens/reservation_screen.dart)

- 위 파일들에 서비스명 매핑, 로드/기존 고객 구분, 주간/야간 분기, 가격 규칙, 예약 상태 문자열이 분산되어 있다.
- 같은 업무 규칙이 여러 군데 흩어져 있으면, 한 군데를 바꿨는데 다른 화면은 옛 규칙을 따르는 문제가 생긴다.
- 현장 운영 자동화 시스템에서는 규칙이 한 번 바뀌면 웹/모바일/DB가 동시에 같아야 하므로, 중장기적으로 가장 위험한 구조다.

### 6. 모바일 고객 조회는 데이터가 커질수록 무거워질 구조

- [supabase_service.dart](C:/Users/rlgus/Desktop/workspace/the_thai_app/lib/services/supabase_service.dart)는 전체 고객을 페이지 단위로 반복 조회하거나, 일부 기능은 사실상 전체 목록을 만든 뒤 처리한다.
- 전화번호 인덱스 생성, 쿠폰 고객 목록, 검색 준비 로직이 커질수록 느려질 수 있다.
- 카운터 직원은 고객을 "즉시" 찾아야 하므로, 장기적으로는 서버 검색 최적화와 인덱스 전략이 필요하다.

### 7. 모바일 인증 상태는 전역 메모리 의존이 큼

- [auth_service.dart](C:/Users/rlgus/Desktop/workspace/the_thai_app/lib/services/auth_service.dart)는 `storeId`, `storeName`을 static 변수로 유지한다.
- 앱 생명주기, 세션 갱신, 강제 로그아웃, 매장 전환이 복잡해질수록 상태 꼬임 가능성이 있다.
- 웹에서 봤던 "세션은 남아 있는데 컨텍스트는 틀리는" 문제가 모바일에서도 비슷하게 생길 수 있다.

### 8. 전화 연동은 제품 강점이지만 플랫폼 의존성이 큼

- [phone_service.dart](C:/Users/rlgus/Desktop/workspace/the_thai_app/lib/services/phone_service.dart)는 현장 자동화 목적과 매우 잘 맞는다.
- 다만 권한, 기기 제조사 정책, OS 버전에 따라 동작 차이가 생길 수 있다.
- 이 기능은 핵심 강점이지만, 실패 시 대체 흐름이 반드시 있어야 한다.

### 9. 업무일지는 자동저장 빈도가 높음

- [app/worklog/page.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/app/worklog/page.tsx)는 입력 후 300ms마다 upsert를 시도한다.
- 작성 경험은 좋지만, 네트워크가 불안정하거나 여러 기기에서 동시 수정 시 충돌 가능성이 있다.
- 현장용 도구에서는 "자동저장"이 중요하지만, 저장 빈도와 충돌 처리도 같이 설계해야 한다.

## 우선순위 제안

### 지금 바로 손봐야 할 것

- 웹 전 페이지 `store_id` 필터 점검 및 누락 제거
- 인증 기준 통일 또는 만료 시 강제 재로그인 흐름 일원화
- 조판지 부분 갱신 전략 정리

### 다음 단계에서 손봐야 할 것

- 통계 계산 서버 집계화
- 웹/모바일/DB에 분산된 업무 규칙 공통화
- 모바일 고객 검색 성능 개선

### 중장기 과제

- 예약/고객/방문/쿠폰 규칙을 코드값 기반으로 완전히 전환
- 현장 운영 로그와 장애 복구 흐름 강화
- 전화 연동 실패 시 대체 UX 표준화

### 세션 만료 안내 및 자동 슬롯 서비스 코드 정규화

- [StoreProvider.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/components/StoreProvider.tsx)
  - 기존 로그인 사용자가 세션 만료로 비로그인 상태가 되면 `authNotice = 'expired'`를 기록
- [AppShell.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/components/AppShell.tsx)
  - 세션 만료 감지 시 `/login?expired=1`로 이동
- [login/page.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/app/login/page.tsx)
  - 로그인 화면에 `세션이 만료되었습니다. 다시 로그인해 주세요.` 안내 표시
- [migration_auto_assign_slot.sql](C:/Users/rlgus/Desktop/workspace/The-thai-web/supabase/migration_auto_assign_slot.sql)
  - 자동 생성 슬롯의 `service_name`을 `service_catalog` 기준으로 코드(`T60`, `A90` 등)로 정규화
  - 자동 생성 슬롯의 `service_price`도 `service_prices`에서 매장별 가격으로 계산
## 2026-04-09 보완

### 업무일지 날짜 깜빡임 완화

- [worklog/page.tsx](C:/Users/rlgus/Desktop/workspace/The-thai-web/app/worklog/page.tsx)
  - `today` 값을 ref로 고정
  - 자동저장 후 `id`가 같으면 `log` 상태를 다시 쓰지 않도록 변경
  - 자동저장 안내 타이머를 별도 ref로 관리해 불필요한 재렌더를 줄임

### 신규 고객 유입경로 자동 메모 규칙 보강

- [utils.ts](C:/Users/rlgus/Desktop/workspace/The-thai-web/lib/utils.ts)
  - 고객명에 `New`가 포함된 경우 유입경로에 따라 `마통신규`, `하이신규`, `마맵신규`, `신규로드` 메모 생성
- [migration_auto_assign_slot.sql](C:/Users/rlgus/Desktop/workspace/The-thai-web/supabase/migration_auto_assign_slot.sql)
  - DB 자동 슬롯 생성 시에도 같은 신규 메모 규칙을 적용
