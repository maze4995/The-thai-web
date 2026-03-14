import { supabase } from '@/lib/supabase'
import { ScheduleBoard } from '@/components/ScheduleBoard'
import { getBusinessDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const today = getBusinessDate(new Date())

  const [therapistsRes, attendanceRes, slotsRes] = await Promise.all([
    supabase.from('therapists').select('*').eq('is_active', true).order('display_order').order('name'),
    supabase.from('daily_attendance').select('*').eq('work_date', today),
    supabase.from('schedule_slots').select('*').eq('work_date', today),
  ])

  return (
    <ScheduleBoard
      initialTherapists={therapistsRes.data ?? []}
      initialAttendance={attendanceRes.data ?? []}
      initialSlots={slotsRes.data ?? []}
      initialDate={today}
    />
  )
}
