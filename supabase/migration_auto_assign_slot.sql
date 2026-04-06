-- Prevent duplicate auto-created schedule slots for the same reservation.
-- Manual duplicate slots are still allowed because this function is only used
-- by the auto-assignment flow in the web app.

CREATE OR REPLACE FUNCTION public.auto_assign_schedule_slot(
  p_store_id UUID,
  p_work_date DATE,
  p_reservation_id UUID,
  p_therapist_id UUID,
  p_therapist_name TEXT,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_service_name TEXT,
  p_service_price INTEGER,
  p_room_number INTEGER,
  p_reserved_time TIME,
  p_payment_type TEXT,
  p_memo TEXT,
  p_slot_order INTEGER
)
RETURNS TABLE(created_slot_id UUID, inserted BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_slot_id UUID;
  v_created_slot_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('schedule_slot_auto:' || p_reservation_id::text));

  SELECT id
  INTO v_existing_slot_id
  FROM public.schedule_slots
  WHERE store_id = p_store_id
    AND reservation_id = p_reservation_id
  LIMIT 1;

  IF v_existing_slot_id IS NOT NULL THEN
    RETURN QUERY SELECT v_existing_slot_id, false;
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
    p_therapist_id,
    p_therapist_name,
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
    p_slot_order
  )
  RETURNING id INTO v_created_slot_id;

  RETURN QUERY SELECT v_created_slot_id, true;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_assign_schedule_slot(
  UUID, DATE, UUID, UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TIME, TEXT, TEXT, INTEGER
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.auto_assign_schedule_slot(
  UUID, DATE, UUID, UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TIME, TEXT, TEXT, INTEGER
) TO authenticated;
