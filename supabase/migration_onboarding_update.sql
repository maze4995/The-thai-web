-- ============================================================
-- Onboarding update support for existing stores
-- Allows a store owner to update the onboarding fields later.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_store_onboarding(
  p_store_name TEXT,
  p_brand_name TEXT DEFAULT NULL,
  p_contact_prefix TEXT DEFAULT NULL,
  p_staff_label TEXT DEFAULT '직원',
  p_reservation_time_interval INTEGER DEFAULT 30,
  p_visit_day_starts_at_hour INTEGER DEFAULT 6,
  p_visit_day_ends_at_hour INTEGER DEFAULT 18
)
RETURNS TABLE(updated_store_id UUID)
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

  SELECT sm.store_id
  INTO v_store_id
  FROM public.store_members sm
  WHERE sm.user_id = v_user_id
    AND sm.role = 'owner'
  LIMIT 1;

  IF v_store_id IS NULL THEN
    RAISE EXCEPTION '수정 권한이 있는 매장을 찾지 못했습니다.';
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

  UPDATE public.stores
  SET name = v_store_name
  WHERE id = v_store_id;

  IF to_regclass('public.store_settings') IS NOT NULL THEN
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
    VALUES (
      v_store_id,
      v_brand_name,
      v_brand_name,
      v_contact_prefix,
      v_staff_label,
      v_reservation_time_interval,
      v_visit_day_starts_at_hour,
      v_visit_day_ends_at_hour
    )
    ON CONFLICT (store_id) DO UPDATE
    SET
      brand_name = EXCLUDED.brand_name,
      app_display_name = EXCLUDED.app_display_name,
      contact_prefix = EXCLUDED.contact_prefix,
      staff_label = EXCLUDED.staff_label,
      reservation_time_interval = EXCLUDED.reservation_time_interval,
      visit_day_starts_at_hour = EXCLUDED.visit_day_starts_at_hour,
      visit_day_ends_at_hour = EXCLUDED.visit_day_ends_at_hour,
      updated_at = now();
  END IF;

  IF to_regclass('public.lookup_groups') IS NOT NULL
     AND to_regclass('public.lookup_items') IS NOT NULL THEN
    UPDATE public.lookup_items li
    SET label = v_staff_label,
        updated_at = now()
    FROM public.lookup_groups lg
    WHERE lg.id = li.group_id
      AND lg.store_id = v_store_id
      AND lg.code = 'staff_label'
      AND li.code = 'primary';
  END IF;

  RETURN QUERY SELECT v_store_id AS updated_store_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_store_onboarding(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_store_onboarding(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER) TO authenticated;
