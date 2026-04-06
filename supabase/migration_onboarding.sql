-- ============================================================
-- Onboarding bootstrap for commercial MVP
-- Allows an authenticated user without store membership
-- to create their first store and seed initial config.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_store_onboarding(
  p_store_name TEXT,
  p_brand_name TEXT DEFAULT NULL,
  p_contact_prefix TEXT DEFAULT NULL,
  p_staff_label TEXT DEFAULT '직원',
  p_reservation_time_interval INTEGER DEFAULT 30,
  p_visit_day_starts_at_hour INTEGER DEFAULT 6,
  p_visit_day_ends_at_hour INTEGER DEFAULT 18
)
RETURNS TABLE(created_store_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_store_id UUID;
  v_store_name TEXT;
  v_brand_name TEXT;
  v_contact_prefix TEXT;
  v_staff_label TEXT;
  v_reservation_time_interval INTEGER;
  v_visit_day_starts_at_hour INTEGER;
  v_visit_day_ends_at_hour INTEGER;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요한 작업입니다.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.store_members
    WHERE user_id = v_user_id
  ) THEN
    RAISE EXCEPTION '이미 매장에 연결된 계정입니다.';
  END IF;

  v_store_name := NULLIF(BTRIM(p_store_name), '');
  v_brand_name := COALESCE(NULLIF(BTRIM(p_brand_name), ''), v_store_name);
  v_contact_prefix := COALESCE(NULLIF(BTRIM(p_contact_prefix), ''), v_store_name);
  v_staff_label := COALESCE(NULLIF(BTRIM(p_staff_label), ''), '직원');
  v_reservation_time_interval := GREATEST(COALESCE(p_reservation_time_interval, 30), 5);
  v_visit_day_starts_at_hour := LEAST(GREATEST(COALESCE(p_visit_day_starts_at_hour, 6), 0), 23);
  v_visit_day_ends_at_hour := LEAST(GREATEST(COALESCE(p_visit_day_ends_at_hour, 18), 0), 24);

  IF v_store_name IS NULL THEN
    RAISE EXCEPTION '매장 이름은 필수입니다.';
  END IF;

  INSERT INTO public.stores (name)
  VALUES (v_store_name)
  RETURNING id INTO v_store_id;

  INSERT INTO public.store_members (store_id, user_id, role)
  VALUES (v_store_id, v_user_id, 'owner');

  IF to_regclass('public.store_settings') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO public.store_settings (
        store_id,
        brand_name,
        app_display_name,
        contact_prefix,
        staff_label,
        reservation_time_interval,
        visit_day_starts_at_hour,
        visit_day_ends_at_hour
      )
      VALUES ($1, $2, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (store_id) DO NOTHING
    $sql$
    USING
      v_store_id,
      v_brand_name,
      v_contact_prefix,
      v_staff_label,
      v_reservation_time_interval,
      v_visit_day_starts_at_hour,
      v_visit_day_ends_at_hour;
  END IF;

  IF to_regclass('public.store_features') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO public.store_features (
        store_id,
        legacy_mode,
        settings_enabled,
        wallet_enabled,
        onboarding_enabled,
        phone_integration_enabled,
        contact_sync_enabled,
        schedule_board_enabled,
        worklog_enabled
      )
      VALUES ($1, false, true, false, true, false, false, true, true)
      ON CONFLICT (store_id) DO NOTHING
    $sql$
    USING v_store_id;
  END IF;

  IF to_regclass('public.lookup_groups') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO public.lookup_groups (store_id, code, name, description, is_system)
      VALUES
        ($1, 'customer_source', '고객 유입 경로', '기존/로드/플랫폼별 고객 유입 구분', true),
        ($1, 'member_type', '회원 유형', '가격 정책에 사용하는 고객 유형', true),
        ($1, 'reservation_status', '예약 상태', '예약 처리 상태값', true),
        ($1, 'visit_type', '방문 유형', '주간/야간 등 방문 분류', true),
        ($1, 'payment_type', '결제 수단', '정산에 사용하는 결제 수단', true),
        ($1, 'staff_label', '직원 라벨', '매장별 직무 명칭', true)
      ON CONFLICT (store_id, code) DO NOTHING
    $sql$
    USING v_store_id;

    EXECUTE $sql$
      INSERT INTO public.lookup_items (
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
      FROM public.lookup_groups lg
      JOIN (
        VALUES
          ('customer_source', 'road', '로드', '#f97316', 10, true, '{}'),
          ('customer_source', 'existing', '기존', '#64748b', 20, false, '{}'),
          ('customer_source', 'app', '앱', '#06b6d4', 30, false, '{}'),
          ('reservation_status', 'confirmed', '예약확정', '#22c55e', 10, true, '{}'),
          ('reservation_status', 'cancelled', '취소', '#ef4444', 20, false, '{}'),
          ('reservation_status', 'noshow', '노쇼', '#f59e0b', 30, false, '{}'),
          ('member_type', 'road_member', '로드회원', '#f97316', 10, true, '{}'),
          ('member_type', 'app_member', '앱회원', '#06b6d4', 20, false, '{}'),
          ('visit_type', 'day', '주간', '#0ea5e9', 10, true, '{"start_hour":6,"end_hour":18}'),
          ('visit_type', 'night', '야간', '#8b5cf6', 20, false, '{"start_hour":18,"end_hour":6}'),
          ('payment_type', 'cash', '현금', '#22c55e', 10, true, '{}'),
          ('payment_type', 'card', '카드', '#3b82f6', 20, false, '{}'),
          ('payment_type', 'transfer', '이체', '#a855f7', 30, false, '{}'),
          ('payment_type', 'coupon', '쿠폰', '#f59e0b', 40, false, '{}'),
          ('payment_type', 'mixed', '복합', '#64748b', 50, false, '{}'),
          ('staff_label', 'primary', $2, '#d4a574', 10, true, '{}')
      ) AS item(group_code, code, label, color, display_order, is_default, meta)
        ON lg.code = item.group_code
      WHERE lg.store_id = $1
        AND NOT EXISTS (
          SELECT 1
          FROM public.lookup_items li
          WHERE li.store_id = lg.store_id
            AND li.group_id = lg.id
            AND li.code = item.code
        )
    $sql$
    USING v_store_id, v_staff_label;
  END IF;

  IF to_regclass('public.service_catalog') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO public.service_catalog (
        store_id,
        code,
        name,
        category,
        duration_min,
        sort_order,
        is_active,
        metadata
      )
      VALUES
        ($1, 'T60', '타이 60분', 'thai', 60, 10, true, '{}'::jsonb),
        ($1, 'T90', '타이 90분', 'thai', 90, 20, true, '{}'::jsonb),
        ($1, 'A60', '아로마 60분', 'aroma', 60, 30, true, '{}'::jsonb),
        ($1, 'A90', '아로마 90분', 'aroma', 90, 40, true, '{}'::jsonb)
      ON CONFLICT (store_id, code) DO NOTHING
    $sql$
    USING v_store_id;
  END IF;

  IF to_regclass('public.service_prices') IS NOT NULL
     AND to_regclass('public.service_catalog') IS NOT NULL
     AND to_regclass('public.lookup_groups') IS NOT NULL
     AND to_regclass('public.lookup_items') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO public.service_prices (
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
      FROM public.service_catalog sc
      JOIN public.lookup_groups lg
        ON lg.store_id = sc.store_id
       AND lg.code = 'member_type'
      JOIN public.lookup_items li
        ON li.group_id = lg.id
       AND li.store_id = lg.store_id
      JOIN (
        VALUES
          ('T60', 'road_member', 60000, 10),
          ('T90', 'road_member', 80000, 20),
          ('A60', 'road_member', 70000, 30),
          ('A90', 'road_member', 90000, 40),
          ('T60', 'app_member', 40000, 110),
          ('T90', 'app_member', 60000, 120),
          ('A60', 'app_member', 50000, 130),
          ('A90', 'app_member', 70000, 140)
      ) AS price(service_code, lookup_code, amount, display_order)
        ON price.service_code = sc.code
       AND price.lookup_code = li.code
      WHERE sc.store_id = $1
        AND NOT EXISTS (
          SELECT 1
          FROM public.service_prices sp
          WHERE sp.store_id = sc.store_id
            AND sp.service_id = sc.id
            AND sp.price_type = 'member_type'
            AND COALESCE(sp.lookup_item_id, '00000000-0000-0000-0000-000000000000'::uuid) =
                COALESCE(li.id, '00000000-0000-0000-0000-000000000000'::uuid)
        )
    $sql$
    USING v_store_id;
  END IF;

  RETURN QUERY SELECT v_store_id AS created_store_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_store_onboarding(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_store_onboarding(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER) TO authenticated;
