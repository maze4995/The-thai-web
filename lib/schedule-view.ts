import type { DailyAttendance, ScheduleSlot, Therapist, TherapistWithSlots } from './types'

export function businessMinutes(time: string | null): number {
  if (!time) return 9999
  const [hour, minute] = time.slice(0, 5).split(':').map(Number)
  return (hour * 60 + minute - 360 + 1440) % 1440
}

export function buildScheduleColumns(therapists: Therapist[], attendance: DailyAttendance[], slots: ScheduleSlot[]): TherapistWithSlots[] {
  const attendanceById = new Map<string, DailyAttendance>()
  for (const row of attendance) {
    if (!attendanceById.has(row.therapist_id)) attendanceById.set(row.therapist_id, row)
  }
  const historicalNames = new Map<string, string | null>()
  const slotsById = new Map<string, ScheduleSlot[]>()
  for (const slot of slots) {
    if (!historicalNames.has(slot.therapist_id)) historicalNames.set(slot.therapist_id, slot.therapist_name)
    const group = slotsById.get(slot.therapist_id)
    if (group) group.push(slot)
    else slotsById.set(slot.therapist_id, [slot])
  }
  for (const group of slotsById.values()) {
    group.sort((a, b) => (a.slot_order ?? businessMinutes(a.check_in_time)) -
      (b.slot_order ?? businessMinutes(b.check_in_time)) ||
      businessMinutes(a.check_in_time) - businessMinutes(b.check_in_time))
  }
  const columns: TherapistWithSlots[] = []
  const knownIds = new Set(therapists.map(therapist => therapist.id))
  for (const therapist of therapists) {
    const row = attendanceById.get(therapist.id)
    if (!row?.is_present) continue
    columns.push({ ...therapist, display_order: row.display_order ?? therapist.display_order,
      is_present: true, attendance_id: row.id, slots: slotsById.get(therapist.id) ?? [] })
  }
  // Historical slots retain their name after a therapist is deactivated/deleted.
  for (const [id, group] of slotsById) {
    if (!id || knownIds.has(id)) continue
    const row = attendanceById.get(id)
    columns.push({ id, name: historicalNames.get(id) ?? '(삭제됨)', is_active: false,
      display_order: row?.display_order ?? 999, is_present: true,
      attendance_id: row?.id ?? null, slots: group })
  }
  return columns.sort((a, b) => a.display_order - b.display_order)
}
