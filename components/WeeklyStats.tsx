'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { ScheduleSlot, Therapist } from '@/lib/types'
import { formatPrice, toDateString, getServiceCommission, getCustomerType, formatPhone, parseMixedEntries } from '@/lib/utils'
import { useTheme } from './ThemeProvider'

interface Props {
  initialTherapists: Therapist[]
  initialWeekStart: string
}

type ViewMode = 'week' | 'month'

/** Get Monday of the week containing the given date */
function getMonday(dateStr: string): Date {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

/** Get array of 7 date strings Mon~Sun */
function getWeekDates(mondayStr: string): string[] {
  const dates: string[] = []
  const d = new Date(mondayStr + 'T00:00:00')
  for (let i = 0; i < 7; i++) {
    dates.push(toDateString(d))
    d.setDate(d.getDate() + 1)
  }
  return dates
}

/** Get all date strings for a month (YYYY-MM-01) */
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
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [weekStart, setWeekStart] = useState(initialWeekStart)
  const [monthStart, setMonthStart] = useState(getThisMonthStart)
  const [slots, setSlots] = useState<ScheduleSlot[]>([])
  const [therapists] = useState(initialTherapists)
  const [loading, setLoading] = useState(true)
  const { theme, toggle } = useTheme()

  const weekDates = getWeekDates(weekStart)
  const monthDates = getMonthDates(monthStart)
  const periodDates = viewMode === 'week' ? weekDates : monthDates

  const fetchWeekData = useCallback(async (start: string, end: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('schedule_slots')
      .select('*')
      .gte('work_date', start)
      .lte('work_date', end)
    setSlots(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchWeekData(periodDates[0], periodDates[periodDates.length - 1])
  }, [weekStart, monthStart, viewMode, fetchWeekData])

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
  // Special: memo contains '스페셜' (coupon purchase customer, INCLUDED in revenue)
  const isSpecial = (s: ScheduleSlot) => s.memo?.includes('스페셜')
  // Coupon slots: memo contains 'CM'/'cm' (can coexist with 스페셜)
  const isCoupon = (s: ScheduleSlot) => /cm/i.test(s.memo ?? '')
  // 문자할인: memo contains '문자할인'
  const isSmsDiscount = (s: ScheduleSlot) => s.memo?.includes('문자할인')

  // Total revenue: exclude CM coupon, but INCLUDE 스페셜
  // Revenue: exclude pure CM (without 스페셜). 스페셜+CM → included in revenue
  const revenueSlots = slots.filter(s => !isCoupon(s) || isSpecial(s))
  const totalRevenue = revenueSlots.reduce((sum, s) => sum + s.service_price, 0)
  const getMixedAmount = (slot: ScheduleSlot, label: string) =>
    parseMixedEntries(slot.memo ?? '').find(e => e.label === label)?.amount ?? 0

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
  const couponCount = slots.filter(s => isCoupon(s)).length
  const specialSlots = slots.filter(s => isSpecial(s))
  const specialCount = specialSlots.length
  const specialRevenue = specialSlots.reduce((sum, s) => sum + s.service_price, 0)
  const smsDiscountSlots = slots.filter(s => isSmsDiscount(s))
  // 신규 고객: 순수 신규 + 신규로드(연락처 010-XXXX-XXXX 형식만)
  const phonePattern = /^010-\d{4}-\d{4}$/
  const newAllSlots = [
    ...slots.filter(s => getCustomerType(s.customer_name) === '신규'),
    ...slots.filter(s => getCustomerType(s.customer_name) === '신규로드' && phonePattern.test(s.customer_phone ?? '')),
  ]
  const totalCustomers = slots.length

  // Daily breakdown
  const dailyData = periodDates.map((date, i) => {
    const daySlots = slots.filter(s => s.work_date === date)
    const nonCoupon = daySlots.filter(s => !isCoupon(s) || isSpecial(s))
    return {
      date,
      label: viewMode === 'week' ? DAY_LABELS[i] : getDayLabel(date),
      total: nonCoupon.reduce((sum, s) => sum + s.service_price, 0),
      cash: nonCoupon.reduce((sum, s) => s.payment_type === 'cash' ? sum + s.service_price : s.payment_type === 'mixed' ? sum + getMixedAmount(s, '현금') : sum, 0),
      card: nonCoupon.reduce((sum, s) => s.payment_type === 'card' ? sum + s.service_price : s.payment_type === 'mixed' ? sum + getMixedAmount(s, '카드') : sum, 0),
      transfer: nonCoupon.reduce((sum, s) => s.payment_type === 'transfer' ? sum + s.service_price : s.payment_type === 'mixed' ? sum + getMixedAmount(s, '이체') : sum, 0),
      coupon: daySlots.filter(s => isCoupon(s)).length,
      special: daySlots.filter(s => isSpecial(s)).length,
      customers: daySlots.length,
    }
  })

  // Commission per therapist
  const commissions = therapists
    .map(t => {
      const tSlots = slots.filter(s => s.therapist_id === t.id)
      const commission = tSlots.reduce((sum, s) => sum + getServiceCommission(s.service_name), 0)
      return { name: t.name, commission, count: tSlots.length }
    })
    .filter(c => c.count > 0)
    .sort((a, b) => b.commission - a.commission)

  // Format date display
  const formatShort = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  const isThisWeek = weekStart === toDateString(getMonday(toDateString(new Date())))
  const isThisMonth = monthStart === getThisMonthStart()
  const isCurrent = viewMode === 'week' ? isThisWeek : isThisMonth

  return (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-[#0f1117] text-slate-800 dark:text-slate-200">
      {/* Header - single row */}
      <header className="shrink-0 bg-white dark:bg-[#161b27] border-b border-slate-200 dark:border-slate-700/60">
        <div className="flex items-center justify-between px-3 sm:px-5 py-2 sm:py-3">
          <h1 className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400 tracking-tight shrink-0">통계</h1>

          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              onClick={() => navigate(-1)}
              className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg text-xs sm:text-sm transition-colors"
            >
              ←
            </button>
            <button
              onClick={toggleViewMode}
              className={`px-2 sm:px-2.5 h-7 sm:h-8 rounded-lg text-[10px] sm:text-xs font-medium transition-colors ${
                isCurrent ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {viewMode === 'week' ? '이번주' : '이번달'}
            </button>
            {viewMode === 'week' ? (
              <input
                type="date"
                value={weekStart}
                onChange={e => {
                  if (!e.target.value) return
                  const monday = getMonday(e.target.value)
                  setWeekStart(toDateString(monday))
                }}
                className="h-7 sm:h-8 px-2 sm:px-3 bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700/60 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 border-none outline-none cursor-pointer transition-colors"
                style={{ colorScheme: theme === 'dark' ? 'dark' : 'light' }}
              />
            ) : (
              <input
                type="month"
                value={monthStart.slice(0, 7)}
                onChange={e => {
                  if (!e.target.value) return
                  setMonthStart(e.target.value + '-01')
                }}
                className="h-7 sm:h-8 px-2 sm:px-3 bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700/60 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 border-none outline-none cursor-pointer transition-colors"
                style={{ colorScheme: theme === 'dark' ? 'dark' : 'light' }}
              />
            )}
            <button
              onClick={() => navigate(1)}
              className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg text-xs sm:text-sm transition-colors"
            >
              →
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={toggle}
              className="px-2 sm:px-3 py-1 sm:py-1.5 bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-700 rounded text-xs sm:text-sm transition-colors"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <a
              href="/"
              className="px-2 sm:px-3 py-1 sm:py-1.5 bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-700 rounded text-[10px] sm:text-xs text-slate-600 dark:text-slate-300 transition-colors"
            >
              조판지
            </a>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 sm:space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400">
            로딩중...
          </div>
        ) : (
          <>
            {/* Weekly Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
              <div className="bg-white dark:bg-[#161b27] rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700/40">
                <div className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 mb-1">총매출</div>
                <div className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">{formatPrice(totalRevenue)}</div>
                <div className="text-[10px] sm:text-xs text-slate-400 mt-1">총 {totalCustomers}명</div>
              </div>
              <div className="bg-white dark:bg-[#161b27] rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700/40">
                <div className="text-[10px] sm:text-xs text-emerald-500 mb-1">현금</div>
                <div className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">{formatPrice(cashTotal)}</div>
              </div>
              <div className="bg-white dark:bg-[#161b27] rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700/40">
                <div className="text-[10px] sm:text-xs text-blue-400 mb-1">카드</div>
                <div className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">{formatPrice(cardTotal)}</div>
              </div>
              <div className="bg-white dark:bg-[#161b27] rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700/40">
                <div className="text-[10px] sm:text-xs text-purple-400 mb-1">이체</div>
                <div className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">{formatPrice(transferTotal)}</div>
              </div>
              <div className="bg-white dark:bg-[#161b27] rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700/40">
                <div className="text-[10px] sm:text-xs text-amber-400 mb-1">쿠폰</div>
                <div className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">{couponCount}건</div>
              </div>
              <div className="bg-white dark:bg-[#161b27] rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700/40">
                <div className="text-[10px] sm:text-xs text-pink-400 mb-1">쿠폰구매(스페셜)</div>
                <div className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">{specialCount}건</div>
                <div className="text-[10px] sm:text-xs text-pink-400 mt-1">{formatPrice(specialRevenue)}</div>
              </div>
            </div>

            {/* Daily Breakdown Table */}
            <div className="bg-white dark:bg-[#161b27] rounded-xl border border-slate-200 dark:border-slate-700/40 overflow-hidden">
              <div className="px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-200 dark:border-slate-700/40">
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">{viewMode === 'week' ? '일별 매출' : '월별 일일 매출'}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] sm:text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-[#1a2035]">
                      <th className="px-2 sm:px-3 py-2 text-left text-slate-500 dark:text-slate-400 font-medium">날짜</th>
                      <th className="px-2 sm:px-3 py-2 text-right text-slate-500 dark:text-slate-400 font-medium">총매출</th>
                      <th className="px-2 sm:px-3 py-2 text-right text-emerald-500 font-medium">현금</th>
                      <th className="px-2 sm:px-3 py-2 text-right text-blue-400 font-medium">카드</th>
                      <th className="px-2 sm:px-3 py-2 text-right text-purple-400 font-medium">이체</th>
                      <th className="px-2 sm:px-3 py-2 text-right text-amber-400 font-medium">쿠폰</th>
                      <th className="px-2 sm:px-3 py-2 text-right text-pink-400 font-medium">스페셜</th>
                      <th className="px-2 sm:px-3 py-2 text-right text-slate-500 dark:text-slate-400 font-medium">고객</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyData.map((day, i) => (
                      <tr key={day.date} className={`border-t border-slate-100 dark:border-slate-800 ${i % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-slate-800/20'}`}>
                        <td className="px-2 sm:px-3 py-2 font-medium text-slate-700 dark:text-slate-300">
                          <span className="text-slate-400 dark:text-slate-500 mr-1">{day.label}</span>
                          {formatShort(day.date)}
                        </td>
                        <td className="px-2 sm:px-3 py-2 text-right font-bold text-slate-900 dark:text-white">{formatPrice(day.total)}</td>
                        <td className="px-2 sm:px-3 py-2 text-right text-slate-700 dark:text-slate-300">{formatPrice(day.cash)}</td>
                        <td className="px-2 sm:px-3 py-2 text-right text-slate-700 dark:text-slate-300">{formatPrice(day.card)}</td>
                        <td className="px-2 sm:px-3 py-2 text-right text-slate-700 dark:text-slate-300">{formatPrice(day.transfer)}</td>
                        <td className="px-2 sm:px-3 py-2 text-right text-amber-500">{day.coupon > 0 ? `${day.coupon}건` : '-'}</td>
                        <td className="px-2 sm:px-3 py-2 text-right text-pink-500">{day.special > 0 ? `${day.special}건` : '-'}</td>
                        <td className="px-2 sm:px-3 py-2 text-right text-slate-700 dark:text-slate-300">{day.customers}명</td>
                      </tr>
                    ))}
                    {/* Total row */}
                    <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#1a2035] font-bold">
                      <td className="px-2 sm:px-3 py-2 text-slate-900 dark:text-white">합계</td>
                      <td className="px-2 sm:px-3 py-2 text-right text-slate-900 dark:text-white">{formatPrice(totalRevenue)}</td>
                      <td className="px-2 sm:px-3 py-2 text-right text-emerald-600 dark:text-emerald-400">{formatPrice(cashTotal)}</td>
                      <td className="px-2 sm:px-3 py-2 text-right text-blue-500 dark:text-blue-400">{formatPrice(cardTotal)}</td>
                      <td className="px-2 sm:px-3 py-2 text-right text-purple-500 dark:text-purple-400">{formatPrice(transferTotal)}</td>
                      <td className="px-2 sm:px-3 py-2 text-right text-amber-500">{couponCount > 0 ? `${couponCount}건` : '-'}</td>
                      <td className="px-2 sm:px-3 py-2 text-right text-pink-500">{specialCount > 0 ? `${specialCount}건` : '-'}</td>
                      <td className="px-2 sm:px-3 py-2 text-right text-slate-900 dark:text-white">{totalCustomers}명</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Commission Table */}
            {commissions.length > 0 && (
              <div className="bg-white dark:bg-[#161b27] rounded-xl border border-slate-200 dark:border-slate-700/40 overflow-hidden">
                <div className="px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-200 dark:border-slate-700/40">
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">관리사별 커미션</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] sm:text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-[#1a2035]">
                        <th className="px-2 sm:px-3 py-2 text-left text-slate-500 dark:text-slate-400 font-medium">관리사</th>
                        <th className="px-2 sm:px-3 py-2 text-right text-slate-500 dark:text-slate-400 font-medium">건수</th>
                        <th className="px-2 sm:px-3 py-2 text-right text-emerald-500 font-medium">커미션</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commissions.map((c, i) => (
                        <tr key={c.name} className={`border-t border-slate-100 dark:border-slate-800 ${i % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-slate-800/20'}`}>
                          <td className="px-2 sm:px-3 py-2 font-medium text-slate-700 dark:text-slate-300">{c.name}</td>
                          <td className="px-2 sm:px-3 py-2 text-right text-slate-700 dark:text-slate-300">{c.count}건</td>
                          <td className="px-2 sm:px-3 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatPrice(c.commission)}</td>
                        </tr>
                      ))}
                      {/* Total row */}
                      <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#1a2035] font-bold">
                        <td className="px-2 sm:px-3 py-2 text-slate-900 dark:text-white">합계</td>
                        <td className="px-2 sm:px-3 py-2 text-right text-slate-900 dark:text-white">{commissions.reduce((s, c) => s + c.count, 0)}건</td>
                        <td className="px-2 sm:px-3 py-2 text-right text-emerald-600 dark:text-emerald-400">{formatPrice(commissions.reduce((s, c) => s + c.commission, 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Customer Detail Tables */}
            {[
              { title: '신규 고객', data: newAllSlots, color: 'text-cyan-400' },
              { title: '문자할인 고객', data: smsDiscountSlots, color: 'text-indigo-400' },
            ].filter(section => section.data.length > 0).map(section => (
              <div key={section.title} className="bg-white dark:bg-[#161b27] rounded-xl border border-slate-200 dark:border-slate-700/40 overflow-hidden">
                <div className="px-3 sm:px-4 py-2 sm:py-3 border-b border-slate-200 dark:border-slate-700/40">
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                    <span className={section.color}>{section.title}</span> <span className="text-slate-400 font-normal">{section.data.length}건</span>
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px] sm:text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-[#1a2035]">
                        <th className="px-2 sm:px-3 py-2 text-left text-slate-500 dark:text-slate-400 font-medium">날짜</th>
                        <th className="px-2 sm:px-3 py-2 text-left text-slate-500 dark:text-slate-400 font-medium">고객명</th>
                        <th className="px-2 sm:px-3 py-2 text-left text-slate-500 dark:text-slate-400 font-medium">연락처</th>
                        <th className="px-2 sm:px-3 py-2 text-left text-slate-500 dark:text-slate-400 font-medium">서비스</th>
                        <th className="px-2 sm:px-3 py-2 text-right text-slate-500 dark:text-slate-400 font-medium">금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.data
                        .sort((a, b) => a.work_date.localeCompare(b.work_date))
                        .map((s, i) => (
                        <tr key={s.id} className={`border-t border-slate-100 dark:border-slate-800 ${i % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-slate-800/20'}`}>
                          <td className="px-2 sm:px-3 py-2 text-slate-700 dark:text-slate-300">{formatShort(s.work_date)}</td>
                          <td className="px-2 sm:px-3 py-2 font-medium text-slate-700 dark:text-slate-300">{s.customer_name}</td>
                          <td className="px-2 sm:px-3 py-2 text-slate-700 dark:text-slate-300">{s.customer_phone ? formatPhone(s.customer_phone) : '-'}</td>
                          <td className="px-2 sm:px-3 py-2 text-emerald-600 dark:text-emerald-400">{s.service_name}</td>
                          <td className="px-2 sm:px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">{formatPrice(s.service_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
