-- ============================================================
-- 일정 관리 (calendar_events) 테이블 생성
-- Supabase Dashboard > SQL Editor 에서 실행하세요
-- ============================================================

CREATE TABLE IF NOT EXISTS calendar_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  event_date   DATE NOT NULL,
  title        TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT '기타', -- '휴무' | '급여' | '기타'
  therapist_id UUID REFERENCES therapists(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS calendar_events_store_date_idx ON calendar_events(store_id, event_date);

-- RLS 활성화
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- RLS 정책
DROP POLICY IF EXISTS "소속 매장 calendar_events" ON calendar_events;
CREATE POLICY "소속 매장 calendar_events" ON calendar_events
  FOR ALL USING (
    store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );
