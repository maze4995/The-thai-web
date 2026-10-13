-- 조판지 매장/날짜 조회 인덱스: 로컬 준비 파일이며 운영 DB에는 자동 적용되지 않습니다.
-- 2026-10-14 KST에 공유된 운영 진단에서 아래 두 인덱스가 없는 것을 확인했습니다.
-- 중요: SQL Editor에서 아래 CREATE INDEX 문을 하나씩 선택해 별도로 Run 하세요.
-- 파일 전체를 한 번에 실행하거나 BEGIN/COMMIT으로 묶지 마세요.
-- CONCURRENTLY는 트랜잭션 블록 안에서 실행할 수 없습니다.
-- 기존 데이터, 열, RLS 정책은 변경하지 않습니다. 두 개의 비고유 인덱스를 추가합니다.
-- 효과는 실제 조회의 적용 전후 실행 시간으로 검증해야 합니다.

-- 1. 이 문장만 선택해 실행하고 성공을 확인합니다.
CREATE INDEX CONCURRENTLY IF NOT EXISTS schedule_slots_store_date_idx
  ON public.schedule_slots (store_id, work_date);

-- 2. 이 문장만 별도로 선택해 실행합니다.
CREATE INDEX CONCURRENTLY IF NOT EXISTS daily_attendance_store_date_idx
  ON public.daily_attendance (store_id, work_date);

-- daily_settings는 이미 (store_id, work_date) 기본키 인덱스가 있습니다.
-- therapists 약 9행, store_members 약 4행: 추가 인덱스는 이번 단계에서 제외합니다.
-- 실행 후 verify_schedule_performance_indexes.sql로 실제 정의와 valid/ready를 확인하세요.
-- IF NOT EXISTS는 같은 이름의 존재만 확인하며 정의나 유효성까지 보장하지 않습니다.
-- 참고: https://www.postgresql.org/docs/17/sql-createindex.html
