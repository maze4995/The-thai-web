'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { ScheduleSlot, Therapist } from '@/lib/types'
import { formatPrice, toDateString, getServiceCommission, resolveCustomerType, formatPhone, parseMixedEntries } from '@/lib/utils'
import { resolveServiceCommission, useStoreServices } from '@/lib/service-config'
import { useStore } from './StoreProvider'

interface Props {
  initialTherapists: Therapist[]
  initialWeekStart: string
}

type ViewMode = 'week' | 'month'

function getMonday(dateStr: string): Date {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function getWeekDates(mondayStr: string): string[] {
  const dates: string[] = []
  const d = new Date(mondayStr + 'T00:00:00')
  for (let i = 0; i < 7; i++) {
    dates.push(toDateString(d))
    d.setDate(d.getDate() + 1)
  }
  return dates
}

function getMonthDates(monthStart: string): string[] {
  const dates: string[] = []
  const d = new Date(monthStart + 'T00:00:00')
  const month = d.getMonth()
  while (d.getMonth() === month) {
    dates.push(toDateString(d))
    d.setDate(d.getDate() + 1)
  }
  return dates
}

function getThisMonthStart(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
}

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']

export function WeeklyStats({ initialTherapists, initialWeekStart }: Props) {
  const { storeId } = useStore()
  const { serviceOptions } = useStoreServices(storeId)
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [weekStart, setWeekStart] = useState(initialWeekStart)
  const [monthStart, setMonthStart] = useState(getThisMonthStart)
  const [slots, setSlots] = useState<ScheduleSlot[]>([])
  const [therapists] = useState(initialTherapists)
  const [loading, setLoading] = useState(true)

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])
  const monthDates = useMemo(() => getMonthDates(monthStart), [monthStart])
  const periodDates = useMemo(
    () => (viewMode === 'week' ? weekDates : monthDates),
    [monthDates, viewMode, weekDates]
  )

  const fetchPeriodData = useCallback(async (start: string, end: string) => {
    if (!storeId) {
      setSlots([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data } = await supabase
      .from('schedule_slots')
      .select('*')
      .eq('store_id', storeId)
      .gte('work_date', start)
      .lte('work_date', end)

    setSlots(data ?? [])
    setLoading(false)
  }, [storeId])

  useEffect(() => {
    if (periodDates.length === 0) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      fetchPeriodData(periodDates[0], periodDates[periodDates.length - 1])
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchPeriodData, periodDates])

  const navigate = (delta: number) => {
    if (viewMode === 'week') {
      const d = new Date(weekStart + 'T00:00:00')
      d.setDate(d.getDate() + delta * 7)
      setWeekStart(toDateString(d))
    } else {
      const d = new Date(monthStart + 'T00:00:00')
      d.setMonth(d.getMonth() + delta)
      setMonthStart(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`)
    }
  }

  const goThisWeek = () => {
    const monday = getMonday(toDateString(new Date()))
    setWeekStart(toDateString(monday))
  }

  const toggleViewMode = () => {
    if (viewMode === 'week') {
      setViewMode('month')
      setMonthStart(getThisMonthStart())
    } else {
      setViewMode('week')
      goThisWeek()
    }
  }

  // --- Calculations ---
  const isSpecial = (s: ScheduleSlot) => s.memo?.includes('스페셜')
  const isCoupon = (s: ScheduleSlot) => /cm/i.test(s.memo ?? '')
  const isSmsDiscount = (s: ScheduleSlot) => s.memo?.includes('문자할인')

  const getMixedAmount = (slot: ScheduleSlot, label: string) =>
    parseMixedEntries(slot.memo ?? '').find(e => e.label === label)?.amount ?? 0
  const revenueSlots = slots.filter(s => {
    if (s.payment_type === 'mixed') return true
    return !isCoupon(s) || isSpecial(s)
  })
  const totalRevenue = revenueSlots.reduce((sum, s) => {
    if (s.payment_type === 'mixed') return sum + s.service_price - getMixedAmount(s, '쿠폰')
    return sum + s.service_price
  }, 0)

  const cashTotal = revenueSlots.reduce((sum, s) => {
    if (s.payment_type === 'cash') return sum + s.service_price
    if (s.payment_type === 'mixed') return sum + getMixedAmount(s, '현금')
    return sum
  }, 0)
  const cardTotal = revenueSlots.reduce((sum, s) => {
    if (s.payment_type === 'card') return sum + s.service_price
    if (s.payment_type === 'mixed') return sum + getMixedAmount(s, '카드')
    return sum
  }, 0)
  const transferTotal = revenueSlots.reduce((sum, s) => {
    if (s.payment_type === 'transfer') return sum + s.service_price
    if (s.payment_type === 'mixed') return sum + getMixedAmount(s, '이체')
    return sum
  }, 0)
  const couponCount = slots.filter(s => isCoupon(s) || (s.payment_type === 'mixed' && getMixedAmount(s, '쿠폰') > 0)).length
  const specialSlots = slots.filter(s => isSpecial(s))
  const specialCount = specialSlots.length
  const specialRevenue = specialSlots.reduce((sum, s) => sum + s.service_price, 0)
  const smsDiscountSlots = slots.filter(s => isSmsDiscount(s))
  const resolveType = (s: ScheduleSlot) => resolveCustomerType(s.customer_name, s.customer_phone, s.memo ?? '')
  const phonePattern = /^010-\d{4}-\d{4}$/
  const newAllSlots = [
    ...slots.filter(s => resolveType(s) === '신규'),
    ...slots.filter(s => resolveType(s) === '신규로드' && (!s.customer_phone || phonePattern.test(s.customer_phone))),
  ]
  const totalCustomers = slots.length

  // Daily breakdown
  const dailyData = periodDates.map((date, i) => {
    const daySlots = slots.filter(s => s.work_date === date)
    const nonCoupon = daySlots.filter(s => {
      if (s.payment_type === 'mixed') return true
      return !isCoupon(s) || isSpecial(s)
    })
    return {
      date,
      label: viewMode === 'week' ? DAY_LABELS[i] : getDayLabel(date),
      total: nonCoupon.reduce((sum, s) => s.payment_type === 'mixed' ? sum + s.service_price - getMixedAmount(s, '쿠폰') : sum + s.service_price, 0),
      cash: nonCoupon.reduce((sum, s) => s.payment_type === 'cash' ? sum + s.service_price : s.payment_type === 'mixed' ? sum + getMixedAmount(s, '현금') : sum, 0),
      card: nonCoupon.reduce((sum, s) => s.payment_type === 'card' ? sum + s.service_price : s.payment_type === 'mixed' ? sum + getMixedAmount(s, '카드') : sum, 0),
      transfer: nonCoupon.reduce((sum, s) => s.payment_type === 'transfer' ? sum + s.service_price : s.payment_type === 'mixed' ? sum + getMixedAmount(s, '이체') : sum, 0),
      coupon: daySlots.filter(s => isCoupon(s) || (s.payment_type === 'mixed' && getMixedAmount(s, '쿠폰') > 0)).length,
      special: daySlots.filter(s => isSpecial(s)).length,
      customers: daySlots.length,
    }
  })

  // Commission per therapist
  const commissions = therapists
    .map(t => {
      const tSlots = slots.filter(s => s.therapist_id === t.id)
      const commission = tSlots.reduce(
        (sum, s) => sum + (resolveServiceCommission(s.service_name, serviceOptions) || getServiceCommission(s.service_name)),
        0
      )
      return { name: t.name, commission, count: tSlots.length }
    })
    .filter(c => c.count > 0)
    .sort((a, b) => b.commission - a.commission)

  const formatShort = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  const isThisWeek = weekStart === toDateString(getMonday(toDateString(new Date())))
  const isThisMonth = monthStart === getThisMonthStart()
  const isCurrent = viewMode === 'week' ? isThisWeek : isThisMonth

  // Period display text
  const periodLabel = viewMode === 'week'
    ? `${formatShort(weekDates[0])} ~ ${formatShort(weekDates[6])}`
    : (() => { const d = new Date(monthStart + 'T00:00:00'); return `${d.getFullYear()}년 ${d.getMonth() + 1}월` })()

  // Bar chart max for scaling
  const maxDailyTotal = Math.max(...dailyData.map(d => d.total), 1)

  // Payment percentages
  const paymentPcts = totalRevenue > 0 ? {
    cash: Math.round((cashTotal / totalRevenue) * 100),
    card: Math.round((cardTotal / totalRevenue) * 100),
    transfer: Math.round((transferTotal / totalRevenue) * 100),
  } : { cash: 0, card: 0, transfer: 0 }

  return (
    <div className="flex-1 overflow-y-auto bg-[#0f1117]">
      <div className="px-8 pt-8 pb-12 space-y-8">
        {/* Page Header */}
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">통계</h2>
            <p className="text-slate-400 text-sm">매출 및 관리사 성과를 확인합니다.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="w-8 h-8 rounded-lg bg-[#1a2035] hover:bg-[#252d40] border border-slate-700/30 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button
              onClick={toggleViewMode}
              className={`px-3 h-8 rounded-lg text-xs font-bold transition-colors ${
                isCurrent ? 'bg-[#D4A574] text-white' : 'bg-[#1a2035] hover:bg-[#252d40] border border-slate-700/30 text-slate-300'
              }`}
            >
              {viewMode === 'week' ? '주간' : '월간'}
            </button>
            <span className="text-[#D4A574] font-bold text-sm">{periodLabel}</span>
            <button
              onClick={() => navigate(1)}
              className="w-8 h-8 rounded-lg bg-[#1a2035] hover:bg-[#252d40] border border-slate-700/30 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
            {!isCurrent && (
              <button
                onClick={() => viewMode === 'week' ? goThisWeek() : setMonthStart(getThisMonthStart())}
                className="px-3 h-8 rounded-lg bg-[#D4A574] hover:bg-[#c4955a] text-white text-xs font-bold transition-colors"
              >
                {viewMode === 'week' ? '이번주' : '이번달'}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-500">로딩중...</div>
        ) : (
          <>
            {/* Summary Bento Grid */}
            <section className="grid grid-cols-4 gap-4">
              {/* Total Revenue - highlight card */}
              <div className="relative overflow-hidden bg-[#0c0e18] p-6 rounded-xl border border-slate-700/20">
                <div className="relative z-10">
                  <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">총매출</p>
                  <h3 className="text-3xl font-bold text-[#D4A574] tracking-tight">{formatPrice(totalRevenue)}</h3>
                  <p className="text-xs text-slate-500 mt-2">총 {totalCustomers}건</p>
                </div>
                <div className="absolute -right-4 -bottom-4 opacity-5">
                  <svg className="w-24 h-24 text-[#D4A574]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.94s4.18 1.36 4.18 3.85c0 1.89-1.44 2.98-3.12 3.19z" />
                  </svg>
                </div>
              </div>

              {/* Total Bookings */}
              <div className="bg-[#0c0e18] p-6 rounded-xl border border-slate-700/20 border-l-4 border-l-[#D4A574]">
                <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">예약 건수</p>
                <h3 className="text-3xl font-bold text-white tracking-tight">{totalCustomers}</h3>
                <p className="text-xs text-slate-500 mt-2">일 평균 {periodDates.length > 0 ? Math.round(totalCustomers / periodDates.length) : 0}건</p>
              </div>

              {/* New Customers */}
              <div className="bg-[#0c0e18] p-6 rounded-xl border border-slate-700/20">
                <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">신규 고객</p>
                <h3 className="text-3xl font-bold text-white tracking-tight">{newAllSlots.length}</h3>
                <p className="text-xs text-emerald-400 mt-2">{totalCustomers > 0 ? Math.round((newAllSlots.length / totalCustomers) * 100) : 0}% of total</p>
              </div>

              {/* Coupon / Special */}
              <div className="bg-[#0c0e18] p-6 rounded-xl border border-slate-700/20">
                <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">쿠폰 / 스페셜</p>
                <div className="flex items-baseline gap-3 mt-1">
                  <div>
                    <span className="text-2xl font-bold text-amber-400">{couponCount}</span>
                    <span className="text-xs text-slate-500 ml-1">쿠폰</span>
                  </div>
                  <div>
                    <span className="text-2xl font-bold text-pink-400">{specialCount}</span>
                    <span className="text-xs text-slate-500 ml-1">스페셜</span>
                  </div>
                </div>
                {specialRevenue > 0 && (
                  <p className="text-xs text-pink-400 mt-2">{formatPrice(specialRevenue)}</p>
                )}
              </div>
            </section>

            {/* Charts Row */}
            <section className="grid grid-cols-3 gap-6">
              {/* Daily Sales Bar Chart */}
              <div className="col-span-2 bg-[#0c0e18] p-6 rounded-xl border border-slate-700/20">
                <div className="flex justify-between items-end mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-white">일별 매출</h3>
                    <p className="text-xs text-slate-500">일일 매출 추이</p>
                  </div>
                </div>
                <div className="flex items-end gap-1 border-b border-slate-700/20 pb-2" style={{ height: 208 }}>
                  {dailyData.map((day) => {
                    const ratio = maxDailyTotal > 0 ? day.total / maxDailyTotal : 0
                    const barH = Math.max(ratio * 180, 4)
                    return (
                      <div key={day.date} className="flex-1 flex flex-col items-center justify-end h-full group">
                        <span className="text-[10px] font-bold text-[#D4A574] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap mb-1">
                          {formatPrice(day.total)}
                        </span>
                        <div
                          className="w-full max-w-[40px] mx-auto rounded-t bg-emerald-600 group-hover:bg-[#D4A574] transition-all cursor-default"
                          style={{ height: barH }}
                        />
                      </div>
                    )
                  })}
                </div>
                <div className="flex gap-1 mt-2">
                  {dailyData.map(day => (
                    <div key={day.date} className="flex-1 text-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      {viewMode === 'week' ? day.label : formatShort(day.date)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Breakdown */}
              <div className="bg-[#0c0e18] p-6 rounded-xl border border-slate-700/20">
                <h3 className="text-lg font-bold text-white mb-6">결제수단 비율</h3>
                <div className="space-y-5">
                  {/* Cash */}
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-sm text-slate-300">현금</span>
                      <span className="text-sm font-bold text-emerald-400">{formatPrice(cashTotal)}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${paymentPcts.cash}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 text-right">{paymentPcts.cash}%</p>
                  </div>
                  {/* Card */}
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-sm text-slate-300">카드</span>
                      <span className="text-sm font-bold text-blue-400">{formatPrice(cardTotal)}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${paymentPcts.card}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 text-right">{paymentPcts.card}%</p>
                  </div>
                  {/* Transfer */}
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-sm text-slate-300">이체</span>
                      <span className="text-sm font-bold text-purple-400">{formatPrice(transferTotal)}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full transition-all duration-500" style={{ width: `${paymentPcts.transfer}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 text-right">{paymentPcts.transfer}%</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Daily Breakdown Table */}
            <section className="bg-[#0c0e18] rounded-xl border border-slate-700/20 overflow-hidden">
              <div className="px-6 py-4 flex items-center justify-between border-b border-slate-700/20">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-[#D4A574]">{viewMode === 'week' ? '일별 상세' : '월별 일일 상세'}</span>
                  <div className="h-4 w-px bg-slate-700/40" />
                  <span className="text-xs text-slate-500">매출 내역</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-[10px] text-slate-500 uppercase tracking-widest">
                    <tr className="border-b border-slate-700/10">
                      <th className="px-6 py-3 font-semibold">날짜</th>
                      <th className="px-6 py-3 font-semibold text-right">총매출</th>
                      <th className="px-6 py-3 font-semibold text-right">현금</th>
                      <th className="px-6 py-3 font-semibold text-right">카드</th>
                      <th className="px-6 py-3 font-semibold text-right">이체</th>
                      <th className="px-6 py-3 font-semibold text-right">쿠폰</th>
                      <th className="px-6 py-3 font-semibold text-right">스페셜</th>
                      <th className="px-6 py-3 font-semibold text-right">고객</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/10 text-xs">
                    {dailyData.map(day => (
                      <tr key={day.date} className="hover:bg-[#1a2035] transition-colors">
                        <td className="px-6 py-3 text-slate-300 font-medium">
                          <span className="text-slate-500 mr-1.5">{day.label}</span>
                          {formatShort(day.date)}
                        </td>
                        <td className="px-6 py-3 text-right font-bold text-white">{formatPrice(day.total)}</td>
                        <td className="px-6 py-3 text-right text-emerald-400">{formatPrice(day.cash)}</td>
                        <td className="px-6 py-3 text-right text-blue-400">{formatPrice(day.card)}</td>
                        <td className="px-6 py-3 text-right text-purple-400">{formatPrice(day.transfer)}</td>
                        <td className="px-6 py-3 text-right text-amber-400">{day.coupon > 0 ? `${day.coupon}건` : '-'}</td>
                        <td className="px-6 py-3 text-right text-pink-400">{day.special > 0 ? `${day.special}건` : '-'}</td>
                        <td className="px-6 py-3 text-right text-slate-300">{day.customers}명</td>
                      </tr>
                    ))}
                    {/* Total row */}
                    <tr className="bg-[#1a2035] font-bold border-t-2 border-slate-600">
                      <td className="px-6 py-3 text-white">합계</td>
                      <td className="px-6 py-3 text-right text-[#D4A574]">{formatPrice(totalRevenue)}</td>
                      <td className="px-6 py-3 text-right text-emerald-400">{formatPrice(cashTotal)}</td>
                      <td className="px-6 py-3 text-right text-blue-400">{formatPrice(cardTotal)}</td>
                      <td className="px-6 py-3 text-right text-purple-400">{formatPrice(transferTotal)}</td>
                      <td className="px-6 py-3 text-right text-amber-400">{couponCount > 0 ? `${couponCount}건` : '-'}</td>
                      <td className="px-6 py-3 text-right text-pink-400">{specialCount > 0 ? `${specialCount}건` : '-'}</td>
                      <td className="px-6 py-3 text-right text-white">{totalCustomers}명</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Commission Table */}
            {commissions.length > 0 && (
              <section className="bg-[#0c0e18] rounded-xl border border-slate-700/20 overflow-hidden">
                <div className="px-6 py-4 flex items-center justify-between border-b border-slate-700/20">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-[#D4A574]">관리사별 커미션</span>
                    <div className="h-4 w-px bg-slate-700/40" />
                    <span className="text-xs text-slate-500">성과 기준 정렬</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="text-[10px] text-slate-500 uppercase tracking-widest">
                      <tr className="border-b border-slate-700/10">
                        <th className="px-6 py-3 font-semibold">관리사</th>
                        <th className="px-6 py-3 font-semibold text-right">건수</th>
                        <th className="px-6 py-3 font-semibold text-right">커미션</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/10 text-xs">
                      {commissions.map(c => (
                        <tr key={c.name} className="hover:bg-[#1a2035] transition-colors">
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#8B4513] flex items-center justify-center text-white text-sm font-bold">
                                {c.name.charAt(0)}
                              </div>
                              <span className="font-bold text-slate-100">{c.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-right text-slate-300">{c.count}건</td>
                          <td className="px-6 py-3 text-right font-bold text-emerald-400">{formatPrice(c.commission)}</td>
                        </tr>
                      ))}
                      <tr className="bg-[#1a2035] font-bold border-t-2 border-slate-600">
                        <td className="px-6 py-3 text-white">합계</td>
                        <td className="px-6 py-3 text-right text-white">{commissions.reduce((s, c) => s + c.count, 0)}건</td>
                        <td className="px-6 py-3 text-right text-emerald-400">{formatPrice(commissions.reduce((s, c) => s + c.commission, 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Customer Detail Tables */}
            {[
              { title: '신규 고객', data: newAllSlots, color: 'text-cyan-400' },
              { title: '문자할인 고객', data: smsDiscountSlots, color: 'text-indigo-400' },
            ].filter(section => section.data.length > 0).map(section => (
              <section key={section.title} className="bg-[#0c0e18] rounded-xl border border-slate-700/20 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700/20">
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold ${section.color}`}>{section.title}</span>
                    <span className="text-xs text-slate-500 font-medium bg-slate-800 px-2 py-0.5 rounded-full">{section.data.length}건</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="text-[10px] text-slate-500 uppercase tracking-widest">
                      <tr className="border-b border-slate-700/10">
                        <th className="px-6 py-3 font-semibold">날짜</th>
                        <th className="px-6 py-3 font-semibold">고객명</th>
                        <th className="px-6 py-3 font-semibold">연락처</th>
                        <th className="px-6 py-3 font-semibold">서비스</th>
                        <th className="px-6 py-3 font-semibold text-right">금액</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/10 text-xs">
                      {section.data
                        .sort((a, b) => a.work_date.localeCompare(b.work_date))
                        .map(s => (
                        <tr key={s.id} className="hover:bg-[#1a2035] transition-colors">
                          <td className="px-6 py-3 text-slate-300">{formatShort(s.work_date)}</td>
                          <td className="px-6 py-3 font-medium text-slate-100">{s.customer_name}</td>
                          <td className="px-6 py-3 text-slate-400">{s.customer_phone ? formatPhone(s.customer_phone) : '-'}</td>
                          <td className="px-6 py-3 text-[#D4A574]">{s.service_name}</td>
                          <td className="px-6 py-3 text-right font-bold text-slate-200">{formatPrice(s.service_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
