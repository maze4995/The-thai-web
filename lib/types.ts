export type PaymentType = 'cash' | 'card' | 'transfer' | 'coupon'

export interface Therapist {
  id: string
  name: string
  is_active: boolean
  display_order: number
}

export interface DailyAttendance {
  id: string
  therapist_id: string
  work_date: string
  is_present: boolean
}

export interface ScheduleSlot {
  id: string
  reservation_id: string | null
  therapist_id: string
  room_number: number
  reserved_time: string | null
  check_in_time: string | null
  check_out_time: string | null
  work_date: string
  payment_type: PaymentType
  customer_name: string
  customer_phone: string
  service_name: string
  service_price: number
  memo: string
}

export interface Reservation {
  id: string
  customer_name: string
  customer_phone: string
  reserved_date: string
  reserved_time: string
  service_name: string
  source: string
  status: string | null
  memo: string | null
}

export interface TherapistWithAttendance extends Therapist {
  is_present: boolean
  attendance_id: string | null
}

export interface TherapistWithSlots extends TherapistWithAttendance {
  slots: ScheduleSlot[]
}
