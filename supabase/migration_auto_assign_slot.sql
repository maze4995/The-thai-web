-- Auto-assign schedule slots in a stable left-to-right order.
-- This function is used only for automatic reservation placement.
-- Manual duplicate reservation_id slots are still allowed elsewhere.
--
-- Important:
-- Older versions of this project created an overloaded function with the same
-- name but a different argument list. Drop the legacy version first so only
-- the latest server-side assignment logic remains active.

DROP FUNCTION IF EXISTS public.auto_assign_schedule_slot(
  UUID, DATE, UUID, UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TIME, TEXT, TEXT, INTEGER
);

DROP TRIGGER IF EXISTS reservations_auto_assign_schedule_slot ON public.reservations;
DROP FUNCTION IF EXISTS public.reservations_auto_assign_schedule_slot();

CREATE OR REPLACE FUNCTION public.auto_assign_schedule_slot(
  p_store_id UUID,
  p_work_date DATE,
  p_reservation_id UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_service_name TEXT,
  p_service_price INTEGER,
  p_room_number INTEGER,
  p_reserved_time TIME,
  p_payment_type TEXT,
  p_memo TEXT
)
RETURNS TABLE(
  created_slot_id UUID,
  inserted BOOLEAN,
  assigned_therapist_id UUID,
  assigned_slot_order INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_slot_id UUID;
  v_existing_therapist_id UUID;
  v_existing_slot_order INTEGER;
  v_created_slot_id UUID;
  v_therapist_id UUID;
  v_therapist_name TEXT;
  v_slot_order INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('schedule_slot_auto_assign:' || p_store_id::text || ':' || p_work_date::text));

  SELECT id, therapist_id, COALESCE(slot_order, 0)
  INTO v_existing_slot_id, v_existing_therapist_id, v_existing_slot_order
  FROM public.schedule_slots
  WHERE store_id = p_store_id
    AND reservation_id = p_reservation_id
  LIMIT 1;

  IF v_existing_slot_id IS NOT NULL THEN
    RETURN QUERY SELECT v_existing_slot_id, false, v_existing_therapist_id, v_existing_slot_order;
    RETURN;
  END IF;

  WITH present_staff AS (
    SELECT
      att.therapist_id,
      att.display_order,
      th.name
    FROM public.daily_attendance att
    JOIN public.therapists th
      ON th.id = att.therapist_id
     AND th.store_id = att.store_id
    WHERE att.store_id = p_store_id
      AND att.work_date = p_work_date
      AND att.is_present = true
  ),
  slot_stats AS (
    SELECT
      ps.therapist_id,
      ps.name,
      ps.display_order,
      COUNT(ss.id) AS slot_count,
      COALESCE(MAX(ss.slot_order), 0) AS max_slot_order
    FROM present_staff ps
    LEFT JOIN public.schedule_slots ss
      ON ss.store_id = p_store_id
     AND ss.work_date = p_work_date
     AND ss.therapist_id = ps.therapist_id
    GROUP BY ps.therapist_id, ps.name, ps.display_order
  )
  SELECT
    therapist_id,
    name,
    max_slot_order + 1
  INTO v_therapist_id, v_therapist_name, v_slot_order
  FROM slot_stats
  WHERE slot_count < 7
  ORDER BY slot_count ASC, display_order ASC
  LIMIT 1;

  IF v_therapist_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, false, NULL::UUID, NULL::INTEGER;
    RETURN;
  END IF;

  INSERT INTO public.schedule_slots (
    store_id,
    therapist_id,
    therapist_name,
    work_date,
    reservation_id,
    customer_name,
    customer_phone,
    service_name,
    service_price,
    room_number,
    reserved_time,
    check_in_time,
    check_out_time,
    payment_type,
    memo,
    slot_order
  )
  VALUES (
    p_store_id,
    v_therapist_id,
    v_therapist_name,
    p_work_date,
    p_reservation_id,
    p_customer_name,
    p_customer_phone,
    p_service_name,
    p_service_price,
    p_room_number,
    p_reserved_time,
    NULL,
    NULL,
    p_payment_type,
    p_memo,
    v_slot_order
  )
  RETURNING id INTO v_created_slot_id;

  RETURN QUERY SELECT v_created_slot_id, true, v_therapist_id, v_slot_order;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_assign_schedule_slot(
  UUID, DATE, UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, TIME, TEXT, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.auto_assign_schedule_slot(
  UUID, DATE, UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, TIME, TEXT, TEXT
) TO authenticated;

CREATE OR REPLACE FUNCTION public.reservations_auto_assign_schedule_slot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_work_date DATE;
  v_service_id UUID;
  v_service_code TEXT;
  v_service_price INTEGER := 0;
  v_auto_memo TEXT := '';
  v_combined_memo TEXT := '';
BEGIN
  IF NEW.store_id IS NULL OR NEW.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.status, '') <> '예약확정' THEN
    RETURN NEW;
  END IF;

  IF NEW.reserved_date IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.customer_name IS NOT NULL AND NEW.customer_name LIKE '%New%' AND NEW.customer_name LIKE '%로드%' THEN
    v_auto_memo := '신규로드';
  ELSIF NEW.customer_name IS NOT NULL AND NEW.customer_name LIKE '%New%' AND NEW.customer_name LIKE '%마통%' THEN
    v_auto_memo := '마통신규';
  ELSIF NEW.customer_name IS NOT NULL AND NEW.customer_name LIKE '%New%' AND (NEW.customer_name LIKE '%하이%' OR NEW.customer_name LIKE '%하이타이%') THEN
    v_auto_memo := '하이신규';
  ELSIF NEW.customer_name IS NOT NULL AND NEW.customer_name LIKE '%New%' AND NEW.customer_name LIKE '%마맵%' THEN
    v_auto_memo := '마맵신규';
  ELSIF NEW.customer_name IS NOT NULL AND NEW.customer_name LIKE '%New%' THEN
    v_auto_memo := '신규';
  ELSIF NEW.customer_name IS NOT NULL AND NEW.customer_name LIKE '%로드%' THEN
    v_auto_memo := '기존로드';
  END IF;

  IF NEW.customer_name IS NOT NULL AND NEW.customer_name LIKE '%CM%' THEN
    v_auto_memo := CONCAT_WS(' ', v_auto_memo, 'CM');
  END IF;

  SELECT sc.id, sc.code
  INTO v_service_id, v_service_code
  FROM public.service_catalog sc
  WHERE sc.store_id = NEW.store_id
    AND sc.is_active = true
    AND (sc.code = NEW.service_name OR sc.name = NEW.service_name)
  ORDER BY sc.sort_order NULLS LAST, sc.name
  LIMIT 1;

  IF v_service_id IS NOT NULL THEN
    SELECT sp.amount
    INTO v_service_price
    FROM public.service_prices sp
    LEFT JOIN public.lookup_items li
      ON li.id = sp.lookup_item_id
    WHERE sp.store_id = NEW.store_id
      AND sp.service_id = v_service_id
      AND sp.is_active = true
      AND (
        (NEW.customer_name LIKE '%로드%' AND li.code = 'road_member')
        OR
        (NEW.customer_name NOT LIKE '%로드%' AND li.code = 'app_member')
      )
    ORDER BY sp.display_order
    LIMIT 1;

    IF v_service_price IS NULL THEN
      SELECT sp.amount
      INTO v_service_price
      FROM public.service_prices sp
      LEFT JOIN public.lookup_items li
        ON li.id = sp.lookup_item_id
      WHERE sp.store_id = NEW.store_id
        AND sp.service_id = v_service_id
        AND sp.is_active = true
        AND (li.code = 'app_member' OR li.code IS NULL)
      ORDER BY sp.display_order
      LIMIT 1;
    END IF;
  END IF;

  v_work_date := NEW.reserved_date;

  IF NEW.reserved_time IS NOT NULL AND NEW.reserved_time < TIME '06:00:00' THEN
    v_work_date := NEW.reserved_date - INTERVAL '1 day';
  END IF;

  v_combined_memo := CONCAT_WS(' ', NULLIF(v_auto_memo, ''), NULLIF(COALESCE(NEW.memo, ''), ''));

  PERFORM public.auto_assign_schedule_slot(
    NEW.store_id,
    v_work_date,
    NEW.id,
    NEW.customer_name,
    NEW.customer_phone,
    COALESCE(v_service_code, NEW.service_name),
    COALESCE(v_service_price, 0),
    1,
    NEW.reserved_time,
    'cash',
    v_combined_memo
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER reservations_auto_assign_schedule_slot
AFTER INSERT OR UPDATE OF status, reserved_date, reserved_time, customer_name, customer_phone, service_name, memo
ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.reservations_auto_assign_schedule_slot();
