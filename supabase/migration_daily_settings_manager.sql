-- ============================================================
-- daily_settings.manager 컬럼 추가
-- 조판지 상단 "담당자명"을 저장하기 위한 컬럼.
-- 컬럼이 없으면 ScheduleBoard 의 upsert / select 가 조용히 실패해
-- 담당자명을 입력해도 새로고침 시 초기화되는 문제가 발생함.
-- (idempotent: 이미 있으면 아무 동작 안 함)
-- ============================================================

ALTER TABLE daily_settings
  ADD COLUMN IF NOT EXISTS manager TEXT;
