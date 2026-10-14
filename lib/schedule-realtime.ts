import type { ScheduleSlot } from './types'

export const SLOT_COLUMNS = 'id,store_id,reservation_id,therapist_id,therapist_name,room_number,reserved_time,check_in_time,check_out_time,work_date,payment_type,customer_name,customer_phone,service_name,service_price,memo,slot_order'

// Only complete rows from this store can take the fast path. Partial payloads
// (including unchanged TOAST values) and deletes still use the normal reread.
export function slotFromRealtime(storeId: string, payload: {
  eventType: string
  new: Record<string, unknown>
}): ScheduleSlot | null {
  if (payload.eventType !== 'INSERT' && payload.eventType !== 'UPDATE') return null
  const row = payload.new
  if (row.store_id !== storeId || SLOT_COLUMNS.split(',').some(key => !(key in row))) return null
  for (const key of ['id', 'therapist_id', 'customer_name', 'service_name', 'memo']) {
    if (typeof row[key] !== 'string') return null
  }
  if (typeof row.work_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.work_date)) return null
  for (const key of ['reservation_id', 'therapist_name', 'customer_phone', 'reserved_time', 'check_in_time', 'check_out_time']) {
    if (row[key] !== null && typeof row[key] !== 'string') return null
  }
  for (const key of ['room_number', 'service_price', 'slot_order']) {
    if (typeof row[key] !== 'number' || !Number.isFinite(row[key])) return null
  }
  if (!['cash', 'card', 'transfer', 'coupon', 'mixed'].includes(String(row.payment_type))) return null
  return row as unknown as ScheduleSlot
}
