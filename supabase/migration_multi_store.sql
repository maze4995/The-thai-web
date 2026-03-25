-- ============================================================
-- 멀티 매장 마이그레이션
-- Supabase Dashboard > SQL Editor 에서 순서대로 실행하세요
-- ============================================================

-- ============================================================
-- STEP 1. stores 테이블 생성 + 현재 매장 등록
-- ============================================================
CREATE TABLE IF NOT EXISTS stores (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 기존 매장 이름을 원하는 이름으로 변경하세요
INSERT INTO stores (name) VALUES ('1호점');

-- ============================================================
-- STEP 2. store_members 테이블 생성
-- ============================================================
CREATE TABLE IF NOT EXISTS store_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'staff', -- 'owner' | 'staff'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, user_id)
);

-- ============================================================
-- STEP 3. 기존 테이블에 store_id 컬럼 추가 (nullable로 먼저)
-- ============================================================
ALTER TABLE therapists       ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id);
ALTER TABLE daily_attendance ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id);
ALTER TABLE schedule_slots   ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id);
ALTER TABLE daily_settings   ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id);
ALTER TABLE reservations     ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id);
ALTER TABLE customers        ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id);
ALTER TABLE visit_history    ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id);

-- ============================================================
-- STEP 4. 기존 데이터 전부 첫 번째 매장으로 할당
-- ============================================================
DO $$
DECLARE
  first_store_id UUID;
BEGIN
  SELECT id INTO first_store_id FROM stores ORDER BY created_at LIMIT 1;

  UPDATE therapists       SET store_id = first_store_id WHERE store_id IS NULL;
  UPDATE daily_attendance SET store_id = first_store_id WHERE store_id IS NULL;
  UPDATE schedule_slots   SET store_id = first_store_id WHERE store_id IS NULL;
  UPDATE daily_settings   SET store_id = first_store_id WHERE store_id IS NULL;
  UPDATE reservations     SET store_id = first_store_id WHERE store_id IS NULL;
  UPDATE customers        SET store_id = first_store_id WHERE store_id IS NULL;
  UPDATE visit_history    SET store_id = first_store_id WHERE store_id IS NULL;

  RAISE NOTICE 'store_id 백필 완료: %', first_store_id;
END $$;

-- ============================================================
-- STEP 5. 백필 확인 (모두 0이어야 함)
-- ============================================================
SELECT 'therapists'       AS tbl, COUNT(*) AS null_count FROM therapists       WHERE store_id IS NULL
UNION ALL
SELECT 'daily_attendance' AS tbl, COUNT(*) AS null_count FROM daily_attendance WHERE store_id IS NULL
UNION ALL
SELECT 'schedule_slots'   AS tbl, COUNT(*) AS null_count FROM schedule_slots   WHERE store_id IS NULL
UNION ALL
SELECT 'daily_settings'   AS tbl, COUNT(*) AS null_count FROM daily_settings   WHERE store_id IS NULL
UNION ALL
SELECT 'reservations'     AS tbl, COUNT(*) AS null_count FROM reservations     WHERE store_id IS NULL
UNION ALL
SELECT 'customers'        AS tbl, COUNT(*) AS null_count FROM customers        WHERE store_id IS NULL
UNION ALL
SELECT 'visit_history'    AS tbl, COUNT(*) AS null_count FROM visit_history    WHERE store_id IS NULL;

-- ============================================================
-- STEP 6. NULL 없음 확인 후 NOT NULL 제약 추가
-- ============================================================
ALTER TABLE therapists       ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE daily_attendance ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE schedule_slots   ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE daily_settings   ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE reservations     ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE customers        ALTER COLUMN store_id SET NOT NULL;
ALTER TABLE visit_history    ALTER COLUMN store_id SET NOT NULL;

-- ============================================================
-- STEP 7. RLS (Row Level Security) 활성화
-- ============================================================
ALTER TABLE stores           ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapists       ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_slots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_history    ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 8. RLS 정책 설정
-- (로그인한 유저는 자신이 속한 매장 데이터만 접근 가능)
-- ============================================================

-- 기존 정책 제거 (재실행 시 충돌 방지)
DROP POLICY IF EXISTS "소속 매장만 조회"        ON stores;
DROP POLICY IF EXISTS "본인 store_members 조회" ON store_members;
DROP POLICY IF EXISTS "소속 매장 therapists"    ON therapists;
DROP POLICY IF EXISTS "소속 매장 daily_attendance" ON daily_attendance;
DROP POLICY IF EXISTS "소속 매장 schedule_slots"   ON schedule_slots;
DROP POLICY IF EXISTS "소속 매장 daily_settings"   ON daily_settings;
DROP POLICY IF EXISTS "소속 매장 reservations"     ON reservations;
DROP POLICY IF EXISTS "소속 매장 customers"        ON customers;
DROP POLICY IF EXISTS "소속 매장 visit_history"    ON visit_history;

-- stores: 자신이 속한 매장만 조회
CREATE POLICY "소속 매장만 조회" ON stores
  FOR SELECT USING (
    id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- store_members: 자신의 레코드만 조회
CREATE POLICY "본인 store_members 조회" ON store_members
  FOR SELECT USING (user_id = auth.uid());

-- therapists
CREATE POLICY "소속 매장 therapists" ON therapists
  FOR ALL USING (
    store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- daily_attendance
CREATE POLICY "소속 매장 daily_attendance" ON daily_attendance
  FOR ALL USING (
    store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- schedule_slots
CREATE POLICY "소속 매장 schedule_slots" ON schedule_slots
  FOR ALL USING (
    store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- daily_settings
CREATE POLICY "소속 매장 daily_settings" ON daily_settings
  FOR ALL USING (
    store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- reservations
CREATE POLICY "소속 매장 reservations" ON reservations
  FOR ALL USING (
    store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- customers
CREATE POLICY "소속 매장 customers" ON customers
  FOR ALL USING (
    store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- visit_history
CREATE POLICY "소속 매장 visit_history" ON visit_history
  FOR ALL USING (
    store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- ============================================================
-- STEP 9. daily_settings unique constraint 변경
-- (work_date 단독 → store_id + work_date 복합 유니크)
-- ============================================================
ALTER TABLE daily_settings DROP CONSTRAINT IF EXISTS daily_settings_work_date_key;
ALTER TABLE daily_settings ADD CONSTRAINT daily_settings_store_work_date_key UNIQUE (store_id, work_date);

-- ============================================================
-- 완료! 다음 단계:
-- 1. Supabase Dashboard > Authentication > Users 에서
--    첫 번째 매장 오너 계정 생성 (이메일/비밀번호)
-- 2. 생성된 user_id를 store_members에 등록:
--    INSERT INTO store_members (store_id, user_id, role)
--    VALUES ('<stores 테이블의 id>', '<auth.users의 id>', 'owner');
-- ============================================================
