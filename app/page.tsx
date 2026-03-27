import { createSupabaseServerClient } from '@/lib/supabase-server'
import { ScheduleBoard } from '@/components/ScheduleBoard'
import { getBusinessDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const today = getBusinessDate(new Date())
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let storeId: string | null = null
  if (user) {
    const { data: membership } = await supabase
      .from('store_members')
      .select('store_id')
      .eq('user_id', user.id)
      .single()
    storeId = membership?.store_id ?? null
  }

  const [therapistsRes, attendanceRes, slotsRes] = storeId
    ? await Promise.all([
        supabase
          .from('therapists')
          .select('*')
          .eq('store_id', storeId)
          .eq('is_active', true)
          .order('display_order')
          .order('name'),
        supabase
          .from('daily_attendance')
          .select('*')
          .eq('store_id', storeId)
          .eq('work_date', today),
        supabase
          .from('schedule_slots')
          .select('*')
          .eq('store_id', storeId)
          .eq('work_date', today),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]

  return (
    <ScheduleBoard
      initialTherapists={therapistsRes.data ?? []}
      initialAttendance={attendanceRes.data ?? []}
      initialSlots={slotsRes.data ?? []}
      initialDate={today}
    />
  )
}
