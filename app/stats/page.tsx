import { createSupabaseServerClient } from '@/lib/supabase-server'
import { WeeklyStats } from '@/components/WeeklyStats'
import { toDateString } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

export default async function StatsPage() {
  const monday = getMonday(new Date())
  const weekStart = toDateString(monday)
  const supabase = await createSupabaseServerClient()

  const therapistsRes = await supabase
    .from('therapists')
    .select('*')
    .eq('is_active', true)
    .order('display_order')
    .order('name')

  return (
    <WeeklyStats
      initialTherapists={therapistsRes.data ?? []}
      initialWeekStart={weekStart}
    />
  )
}
