import { createSupabaseServerClient } from '@/lib/supabase-server'
import { WeeklyStats } from '@/components/WeeklyStats'
import { toDateString } from '@/lib/utils'
import { redirect } from 'next/navigation'

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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: membership } = await supabase
    .from('store_members')
    .select('store_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  const storeId = membership?.store_id ?? null

  if (!storeId) {
    redirect('/onboarding')
  }

  const therapistsRes = await supabase
    .from('therapists')
    .select('*')
    .eq('store_id', storeId)
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
