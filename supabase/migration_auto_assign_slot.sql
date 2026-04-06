-- Auto-assign schedule slots in a stable left-to-right order.
-- This function is used only for automatic reservation placement.
-- Manual duplicate reservation_id slots are still allowed elsewhere.

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
