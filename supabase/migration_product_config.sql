-- ============================================================
-- Product configuration bootstrap for commercial MVP
-- Adds store-scoped settings, feature flags, lookup codes,
-- and service catalog tables without breaking legacy stores.
-- ============================================================

CREATE TABLE IF NOT EXISTS store_settings (
  store_id                     UUID PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  brand_name                   TEXT NOT NULL DEFAULT 'The Thai',
  app_display_name             TEXT NOT NULL DEFAULT 'The Thai',
  contact_prefix               TEXT NOT NULL DEFAULT '매장',
  locale                       TEXT NOT NULL DEFAULT 'ko-KR',
  timezone                     TEXT NOT NULL DEFAULT 'Asia/Seoul',
  currency_code                TEXT NOT NULL DEFAULT 'KRW',
  staff_label                  TEXT NOT NULL DEFAULT '관리사',
  customer_label_template      TEXT NOT NULL DEFAULT '{prefix}-{grade}-{source}{special}{memo}({day})({night}){phone_last4}',
  reservation_time_interval    INTEGER NOT NULL DEFAULT 30,
  visit_day_starts_at_hour     INTEGER NOT NULL DEFAULT 6,
  visit_day_ends_at_hour       INTEGER NOT NULL DEFAULT 18,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT store_settings_interval_chk CHECK (reservation_time_interval > 0),
  CONSTRAINT store_settings_visit_day_start_chk CHECK (
    visit_day_starts_at_hour >= 0 AND visit_day_starts_at_hour <= 23
  ),
  CONSTRAINT store_settings_visit_day_end_chk CHECK (
    visit_day_ends_at_hour >= 0 AND visit_day_ends_at_hour <= 24
  )
);

CREATE TABLE IF NOT EXISTS store_features (
  store_id                   UUID PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  legacy_mode                BOOLEAN NOT NULL DEFAULT true,
  settings_enabled           BOOLEAN NOT NULL DEFAULT false,
  wallet_enabled             BOOLEAN NOT NULL DEFAULT false,
  onboarding_enabled         BOOLEAN NOT NULL DEFAULT false,
  phone_integration_enabled  BOOLEAN NOT NULL DEFAULT true,
  contact_sync_enabled       BOOLEAN NOT NULL DEFAULT true,
  schedule_board_enabled     BOOLEAN NOT NULL DEFAULT true,
  worklog_enabled            BOOLEAN NOT NULL DEFAULT true,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lookup_groups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  code         TEXT NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  is_system    BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, code)
);

CREATE TABLE IF NOT EXISTS lookup_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id       UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  group_id       UUID NOT NULL REFERENCES lookup_groups(id) ON DELETE CASCADE,
  code           TEXT NOT NULL,
  label          TEXT NOT NULL,
  description    TEXT,
  color          TEXT,
  display_order  INTEGER NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  is_default     BOOLEAN NOT NULL DEFAULT false,
  meta           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, group_id, code)
);

CREATE TABLE IF NOT EXISTS service_catalog (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  name            TEXT NOT NULL,
  category        TEXT,
  duration_min    INTEGER,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, code)
);

CREATE TABLE IF NOT EXISTS service_prices (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  service_id            UUID NOT NULL REFERENCES service_catalog(id) ON DELETE CASCADE,
  lookup_item_id        UUID REFERENCES lookup_items(id) ON DELETE SET NULL,
  price_type            TEXT NOT NULL DEFAULT 'default',
  amount                INTEGER NOT NULL,
  currency_code         TEXT NOT NULL DEFAULT 'KRW',
  display_order         INTEGER NOT NULL DEFAULT 0,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_prices_amount_chk CHECK (amount >= 0),
  UNIQUE(store_id, service_id, price_type, lookup_item_id)
);

CREATE INDEX IF NOT EXISTS store_settings_brand_name_idx
  ON store_settings(brand_name);

CREATE INDEX IF NOT EXISTS lookup_groups_store_code_idx
  ON lookup_groups(store_id, code);

CREATE INDEX IF NOT EXISTS lookup_items_store_group_order_idx
  ON lookup_items(store_id, group_id, display_order, label);

CREATE INDEX IF NOT EXISTS service_catalog_store_active_idx
  ON service_catalog(store_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS service_prices_store_service_idx
  ON service_prices(store_id, service_id, is_active, display_order);

ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE lookup_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE lookup_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "소속 매장 store_settings" ON store_settings;
CREATE POLICY "소속 매장 store_settings" ON store_settings
  FOR ALL USING (
    store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "소속 매장 store_features" ON store_features;
CREATE POLICY "소속 매장 store_features" ON store_features
  FOR ALL USING (
    store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "소속 매장 lookup_groups" ON lookup_groups;
CREATE POLICY "소속 매장 lookup_groups" ON lookup_groups
  FOR ALL USING (
    store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "소속 매장 lookup_items" ON lookup_items;
CREATE POLICY "소속 매장 lookup_items" ON lookup_items
  FOR ALL USING (
    store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "소속 매장 service_catalog" ON service_catalog;
CREATE POLICY "소속 매장 service_catalog" ON service_catalog
  FOR ALL USING (
    store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "소속 매장 service_prices" ON service_prices;
CREATE POLICY "소속 매장 service_prices" ON service_prices
  FOR ALL USING (
    store_id IN (SELECT store_id FROM store_members WHERE user_id = auth.uid())
  );

-- ============================================================
-- Bootstrap defaults for all existing stores
-- ============================================================

INSERT INTO store_settings (
  store_id,
  brand_name,
  app_display_name,
  contact_prefix
)
SELECT
  s.id,
  COALESCE(NULLIF(TRIM(s.name), ''), 'The Thai'),
  COALESCE(NULLIF(TRIM(s.name), ''), 'The Thai'),
  COALESCE(NULLIF(TRIM(s.name), ''), '매장')
FROM stores s
WHERE NOT EXISTS (
  SELECT 1 FROM store_settings ss WHERE ss.store_id = s.id
);

INSERT INTO store_features (
  store_id
)
SELECT s.id
FROM stores s
WHERE NOT EXISTS (
  SELECT 1 FROM store_features sf WHERE sf.store_id = s.id
);

INSERT INTO lookup_groups (store_id, code, name, description, is_system)
SELECT s.id, v.code, v.name, v.description, true
FROM stores s
CROSS JOIN (
  VALUES
    ('customer_source', '고객 유입 경로', '기존/로드/제휴 앱 등 고객 유입 채널'),
    ('member_type', '회원 유형', '가격/혜택 계산에 쓰이는 회원 분류'),
    ('reservation_status', '예약 상태', '예약 처리 상태값'),
    ('visit_type', '방문 유형', '시간대 기반 방문 분류'),
    ('payment_type', '결제 수단', '현금/카드/이체/쿠폰 등 정산 수단'),
    ('staff_label', '직원 직책 라벨', '매장별 직무 명칭')
) AS v(code, name, description)
WHERE NOT EXISTS (
  SELECT 1
  FROM lookup_groups lg
  WHERE lg.store_id = s.id
    AND lg.code = v.code
);

INSERT INTO lookup_items (
  store_id,
  group_id,
  code,
  label,
  color,
  display_order,
  is_active,
  is_default,
  meta
)
SELECT
  lg.store_id,
  lg.id,
  item.code,
  item.label,
  item.color,
  item.display_order,
  true,
  item.is_default,
  item.meta::jsonb
FROM lookup_groups lg
JOIN (
  VALUES
    ('customer_source', 'road', '로드', '#f97316', 10, true, '{}'),
    ('customer_source', 'existing', '기존', '#64748b', 20, false, '{}'),
    ('customer_source', 'mattong', '마통', '#8b5cf6', 30, false, '{}'),
    ('customer_source', 'haitai', '하이타이', '#06b6d4', 40, false, '{}'),
    ('customer_source', 'mamap', '마맵', '#22c55e', 50, false, '{}'),
    ('customer_source', 'band', '밴드', '#eab308', 60, false, '{}'),
    ('member_type', 'road_member', '로드회원', '#f97316', 10, true, '{}'),
    ('member_type', 'app_member', '어플회원', '#06b6d4', 20, false, '{}'),
    ('reservation_status', 'confirmed', '예약확정', '#22c55e', 10, true, '{}'),
    ('reservation_status', 'cancelled', '취소', '#ef4444', 20, false, '{}'),
    ('reservation_status', 'noshow', '노쇼', '#f59e0b', 30, false, '{}'),
    ('visit_type', 'day', '주간', '#0ea5e9', 10, true, '{"start_hour":6,"end_hour":18}'),
    ('visit_type', 'night', '야간', '#8b5cf6', 20, false, '{"start_hour":18,"end_hour":6}'),
    ('payment_type', 'cash', '현금', '#22c55e', 10, true, '{}'),
    ('payment_type', 'card', '카드', '#3b82f6', 20, false, '{}'),
    ('payment_type', 'transfer', '이체', '#a855f7', 30, false, '{}'),
    ('payment_type', 'coupon', '쿠폰', '#f59e0b', 40, false, '{}'),
    ('payment_type', 'mixed', '복합', '#64748b', 50, false, '{}'),
    ('staff_label', 'therapist', '관리사', '#d4a574', 10, true, '{}')
) AS item(group_code, code, label, color, display_order, is_default, meta)
  ON lg.code = item.group_code
WHERE NOT EXISTS (
  SELECT 1
  FROM lookup_items li
  WHERE li.store_id = lg.store_id
    AND li.group_id = lg.id
    AND li.code = item.code
);

INSERT INTO service_catalog (
  store_id,
  code,
  name,
  category,
  duration_min,
  sort_order,
  is_active,
  metadata
)
SELECT
  s.id,
  svc.code,
  svc.name,
  svc.category,
  svc.duration_min,
  svc.sort_order,
  true,
  svc.metadata::jsonb
FROM stores s
CROSS JOIN (
  VALUES
    ('T60', '타이 60분', 'thai', 60, 10, '{}'),
    ('T90', '타이 90분', 'thai', 90, 20, '{}'),
    ('A60', '아로마 60분', 'aroma', 60, 30, '{}'),
    ('A90', '아로마 90분', 'aroma', 90, 40, '{}'),
    ('C60', '크림 60분', 'cream', 60, 50, '{}'),
    ('C90', '크림 90분', 'cream', 90, 60, '{}'),
    ('S60', '스웨디시 60분', 'swedish', 60, 70, '{}'),
    ('S90', '스웨디시 90분', 'swedish', 90, 80, '{}')
) AS svc(code, name, category, duration_min, sort_order, metadata)
WHERE NOT EXISTS (
  SELECT 1
  FROM service_catalog sc
  WHERE sc.store_id = s.id
    AND sc.code = svc.code
);

INSERT INTO service_prices (
  store_id,
  service_id,
  lookup_item_id,
  price_type,
  amount,
  currency_code,
  display_order,
  is_active
)
SELECT
  sc.store_id,
  sc.id,
  li.id,
  'member_type',
  price.amount,
  'KRW',
  price.display_order,
  true
FROM service_catalog sc
JOIN lookup_groups lg
  ON lg.store_id = sc.store_id
 AND lg.code = 'member_type'
JOIN lookup_items li
  ON li.group_id = lg.id
 AND li.store_id = lg.store_id
JOIN (
  VALUES
    ('T60', 'road_member', 60000, 10),
    ('T90', 'road_member', 80000, 20),
    ('A60', 'road_member', 70000, 30),
    ('A90', 'road_member', 90000, 40),
    ('C60', 'road_member', 80000, 50),
    ('C90', 'road_member', 100000, 60),
    ('S60', 'road_member', 80000, 70),
    ('S90', 'road_member', 100000, 80),
    ('T60', 'app_member', 40000, 110),
    ('T90', 'app_member', 60000, 120),
    ('A60', 'app_member', 50000, 130),
    ('A90', 'app_member', 70000, 140),
    ('C60', 'app_member', 60000, 150),
    ('C90', 'app_member', 80000, 160),
    ('S60', 'app_member', 70000, 170),
    ('S90', 'app_member', 90000, 180)
) AS price(service_code, lookup_code, amount, display_order)
  ON price.service_code = sc.code
 AND price.lookup_code = li.code
WHERE NOT EXISTS (
  SELECT 1
  FROM service_prices sp
  WHERE sp.store_id = sc.store_id
    AND sp.service_id = sc.id
    AND sp.price_type = 'member_type'
    AND COALESCE(sp.lookup_item_id, '00000000-0000-0000-0000-000000000000'::uuid) =
        COALESCE(li.id, '00000000-0000-0000-0000-000000000000'::uuid)
);
