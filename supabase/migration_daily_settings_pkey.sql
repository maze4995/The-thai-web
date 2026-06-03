-- ============================================================
-- daily_settings 기본키를 (store_id, work_date) 복합키로 변경
--
-- [문제]
-- 멀티매장 이전 구조에서 daily_settings 의 기본키가 work_date 단독이라,
-- 다른 매장이 같은 날짜의 daily_settings 행을 이미 만들어 두면
-- 이 매장의 upsert(onConflict: store_id,work_date)가
-- work_date 기본키 충돌(SQLSTATE 23505)로 실패함.
-- → 담당자명 저장 실패 / 새로고침 시 초기화의 실제 원인.
--
-- [해결]
-- 레거시 단독 기본키를 제거하고 (store_id, work_date) 복합 기본키로 변경.
-- multi_store 마이그레이션에서 만든 동일 컬럼 유니크 제약은 기본키로 대체되므로 제거.
-- (store_id 는 이미 NOT NULL, (store_id, work_date) 는 이미 유니크하므로 안전)
-- ============================================================

-- 1) 레거시 단독 기본키 제거
ALTER TABLE daily_settings DROP CONSTRAINT IF EXISTS daily_settings_pkey;

-- 2) 동일 컬럼 복합 유니크 제약 제거(있으면) — 기본키로 대체
ALTER TABLE daily_settings DROP CONSTRAINT IF EXISTS daily_settings_store_work_date_key;

-- 3) (store_id, work_date) 복합 기본키 설정
ALTER TABLE daily_settings ADD PRIMARY KEY (store_id, work_date);
