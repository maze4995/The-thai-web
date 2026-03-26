-- ============================================================
-- 근무일지 (work_logs) 테이블 생성
-- Supabase Dashboard > SQL Editor 에서 실행하세요
-- ============================================================

CREATE TABLE IF NOT EXISTS work_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  log_date         DATE NOT NULL,
  hygiene          TEXT NOT NULL DEFAULT '',
  therapist_notes  TEXT NOT NULL DEFAULT '',
  customer_items   JSONB NOT NULL DEFAULT '["","","","","","","","","",""]',
  customer_over    TEXT NOT NULL DEFAULT '',
  customer_handoff TEXT NOT NULL DEFAULT '',
  customer_receive TEXT NOT NULL DEFAULT '',
  manager_notes    TEXT NOT NULL DEFAULT '',
  other_notes      TEXT NOT NULL DEFAULT '',
  memo             TEXT NOT NULL DEFAULT '',
  tomorrow_plans   TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, log_date)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS work_logs_store_date_idx ON work_logs(store_id, log_date);

-- RLS 활성화
ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;

-- RLS 정책
DROP POLICY IF EXISTS "소속 매장 work_logs" ON work_logs;
CREATE POLICY "소속 매장 work_logs" ON work_logs
  FOR ALL USING (
    store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );
