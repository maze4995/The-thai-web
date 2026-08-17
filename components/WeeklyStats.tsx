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

function generateExcelXML(dailyData: { date: string; label: string; total: number; cash: number; card: number; transfer: number; coupon: number; special: number; customers: number }[], periodLabel: string): string {
  const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const rows = dailyData.map(d => {
    const dateLabel = `${d.date} (${d.label})`
    return `<Row>
      <Cell><Data ss:Type="String">${escapeXml(dateLabel)}</Data></Cell>
      <Cell><Data ss:Type="Number">${d.total}</Data></Cell>
      <Cell><Data ss:Type="Number">${d.cash}</Data></Cell>
      <Cell><Data ss:Type="Number">${d.card}</Data></Cell>
      <Cell><Data ss:Type="Number">${d.transfer}</Data></Cell>
      <Cell><Data ss:Type="Number">${d.coupon}</Data></Cell>
      <Cell><Data ss:Type="Number">${d.special}</Data></Cell>
      <Cell><Data ss:Type="Number">${d.customers}</Data></Cell>
    </Row>`
  })
  const totals = dailyData.reduce((acc, d) => ({
    total: acc.total + d.total, cash: acc.cash + d.cash, card: acc.card + d.card,
    transfer: acc.transfer + d.transfer, coupon: acc.coupon + d.coupon, special: acc.special + d.special, customers: acc.customers + d.customers,
  }), { total: 0, cash: 0, card: 0, transfer: 0, coupon: 0, special: 0, customers: 0 })

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
  <Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#D4A574" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Total"><Font ss:Bold="1"/><Interior ss:Color="#E8E8E8" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Num"><NumberFormat ss:Format="#,##0"/></Style>
</Styles>
<Worksheet ss:Name="${escapeXml(periodLabel)}">
<Table>
  <Column ss:Width="120"/><Column ss:Width="100"/><Column ss:Width="100"/><Column ss:Width="100"/>
  <Column ss:Width="100"/><Column ss:Width="60"/><Column ss:Width="60"/><Column ss:Width="60"/>
  <Row ss:StyleID="Header">
    <Cell><Data ss:Type="String">날짜</Data></Cell>
    <Cell><Data ss:Type="String">총매출</Data></Cell>
    <Cell><Data ss:Type="String">현금</Data></Cell>
    <Cell><Data ss:Type="String">카드</Data></Cell>
    <Cell><Data ss:Type="String">이체</Data></Cell>
    <Cell><Data ss:Type="String">쿠폰</Data></Cell>
    <Cell><Data ss:Type="String">스페셜</Data></Cell>
    <Cell><Data ss:Type="String">고객수</Data></Cell>
  </Row>
  ${rows.join('\n  ')}
  <Row ss:StyleID="Total">
    <Cell><Data ss:Type="String">합계</Data></Cell>
    <Cell><Data ss:Type="Number">${totals.total}</Data></Cell>
    <Cell><Data ss:Type="Number">${totals.cash}</Data></Cell>
    <Cell><Data ss:Type="Number">${totals.card}</Data></Cell>
    <Cell><Data ss:Type="Number">${totals.transfer}</Data></Cell>
    <Cell><Data ss:Type="Number">${totals.coupon}</Data></Cell>
    <Cell><Data ss:Type="Number">${totals.special}</Data></Cell>
    <Cell><Data ss:Type="Number">${totals.customers}</Data></Cell>
  </Row>
</Table>
</Worksheet>
</Workbook>`
}

export function WeeklyStats({ initialTherapists, initialWeekStart }: Props) {
  const { storeId } = useStore()
  const { serviceOptions } = useStoreServices(storeId)
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [weekStart, setWeekStart] = useState(initialWeekStart)
  const [monthStart, setMonthStart] = useState(getThisMonthStart)
  const [slots, setSlots] = useState<ScheduleSlot[]>([])
  const [therapists] = useState(initialTherapists)
  const [loading, setLoading] = useState(true)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteFrom, setDeleteFrom] = useState('')
  const [deleteTo, setDeleteTo] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteResult, setDeleteResult] = useState<string | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportFrom, setExportFrom] = useState('')
  const [exportTo, setExportTo] = useState('')
  const [exporting, setExporting] = useState(false)

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

  const handleDeleteRange = async () => {
    if (!storeId || !deleteFrom || !deleteTo) return
    if (deleteFrom > deleteTo) {
      setDeleteResult('시작일이 종료일보다 클 수 없습니다.')
      return
    }
    const confirmMsg = `${deleteFrom} ~ ${deleteTo} 기간의 매출 데이터를 영구 삭제합니다.\n\n이 작업은 되돌릴 수 없습니다. 삭제하시겠습니까?`
    if (!window.confirm(confirmMsg)) return

    setDeleting(true)
    const { count, error } = await supabase
      .from('schedule_slots')
      .delete({ count: 'exact' })
      .eq('store_id', storeId)
      .gte('work_date', deleteFrom)
      .lte('work_date', deleteTo)

    if (error) {
      setDeleteResult(`삭제 실패: ${error.message}`)
    } else {
      setDeleteResult(`${count ?? 0}건의 매출 데이터가 영구 삭제되었습니다.`)
      const start = periodDates[0]
      const end = periodDates[periodDates.length - 1]
      fetchPeriodData(start, end)
    }
    setDeleting(false)
  }

  const handleExport = async () => {
    if (!storeId || !exportFrom || !exportTo) return
    if (exportFrom > exportTo) return

    setExporting(true)
    const { data } = await supabase
      .from('schedule_slots')
      .select('*')
      .eq('store_id', storeId)
      .gte('work_date', exportFrom)
      .lte('work_date', exportTo)
      .order('work_date')

    if (!data || data.length === 0) {
      setExporting(false)
      return
    }

    const allDates: string[] = []
    const d = new Date(exportFrom + 'T00:00:00')
    const endDate = new Date(exportTo + 'T00:00:00')
    while (d <= endDate) {
      allDates.push(toDateString(d))
      d.setDate(d.getDate() + 1)
    }

    const exportDailyData = allDates.map(date => {
      const daySlots = (data as ScheduleSlot[]).filter(s => s.work_date === date)
      const nonCoupon = daySlots.filter(s => {
        if (s.payment_type === 'mixed') return true
        return !((/cm/i).test(s.memo ?? '')) || s.memo?.includes('스페셜')
      })
      return {
        date,
        label: ['일', '월', '화', '수', '목', '금', '토'][new Date(date + 'T00:00:00').getDay()],
        total: nonCoupon.reduce((sum, s) => s.payment_type === 'mixed' ? sum + s.service_price - (parseMixedEntries(s.memo ?? '').find(e => e.label === '쿠폰')?.amount ?? 0) : sum + s.service_price, 0),
        cash: nonCoupon.reduce((sum, s) => s.payment_type === 'cash' ? sum + s.service_price : s.payment_type === 'mixed' ? sum + (parseMixedEntries(s.memo ?? '').find(e => e.label === '현금')?.amount ?? 0) : sum, 0),
        card: nonCoupon.reduce((sum, s) => s.payment_type === 'card' ? sum + s.service_price : s.payment_type === 'mixed' ? sum + (parseMixedEntries(s.memo ?? '').find(e => e.label === '카드')?.amount ?? 0) : sum, 0),
        transfer: nonCoupon.reduce((sum, s) => s.payment_type === 'transfer' ? sum + s.service_price : s.payment_type === 'mixed' ? sum + (parseMixedEntries(s.memo ?? '').find(e => e.label === '이체')?.amount ?? 0) : sum, 0),
        coupon: daySlots.filter(s => (/cm/i).test(s.memo ?? '') || (s.payment_type === 'mixed' && (parseMixedEntries(s.memo ?? '').find(e => e.label === '쿠폰')?.amount ?? 0) > 0)).length,
        special: daySlots.filter(s => s.memo?.includes('스페셜')).length,
        customers: daySlots.length,
      }
    })

    const label = `${exportFrom} ~ ${exportTo}`
    const xml = generateExcelXML(exportDailyData, label)
    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `매출_${exportFrom}_${exportTo}.xls`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setExporting(false)
    setShowExportModal(false)
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
            <button
              onClick={() => {
                setExportFrom(periodDates[0] ?? '')
                setExportTo(periodDates[periodDates.length - 1] ?? '')
                setShowExportModal(true)
              }}
              className="px-3 h-8 rounded-lg bg-[#1a2035] hover:bg-[#252d40] border border-slate-700/30 text-emerald-400 text-xs font-bold transition-colors"
            >
              엑셀 다운로드
            </button>
            <button
              onClick={() => {
                setDeleteFrom('')
                setDeleteTo('')
                setDeleteResult(null)
                setShowDeleteModal(true)
              }}
              className="px-3 h-8 rounded-lg bg-[#1a2035] hover:bg-[#252d40] border border-red-700/40 text-red-400 text-xs font-bold transition-colors"
            >
              기간 삭제
            </button>
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

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#161b27] p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white">매출 데이터 기간 삭제</h3>
            <p className="mt-2 text-sm text-red-400">
              선택한 기간의 모든 매출(슬롯) 데이터가 영구 삭제됩니다. 복구할 수 없습니다.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">시작일</label>
                <input type="date" value={deleteFrom} onChange={e => setDeleteFrom(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-red-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">종료일</label>
                <input type="date" value={deleteTo} onChange={e => setDeleteTo(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-red-500" />
              </div>
            </div>
            {deleteResult && (
              <p className={`mt-3 text-sm font-medium ${deleteResult.startsWith('삭제 실패') || deleteResult.startsWith('시작일') ? 'text-red-400' : 'text-emerald-400'}`}>
                {deleteResult}
              </p>
            )}
            <div className="mt-6 flex gap-2">
              <button onClick={() => setShowDeleteModal(false)}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 transition">
                닫기
              </button>
              <button onClick={handleDeleteRange} disabled={deleting || !deleteFrom || !deleteTo}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50 transition">
                {deleting ? '삭제 중...' : '영구 삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#161b27] p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white">매출 엑셀 다운로드</h3>
            <p className="mt-2 text-sm text-slate-400">
              기간을 선택하면 일별 매출 데이터를 엑셀 파일로 다운로드합니다.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">시작일</label>
                <input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">종료일</label>
                <input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500" />
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button onClick={() => setShowExportModal(false)}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 transition">
                닫기
              </button>
              <button onClick={handleExport} disabled={exporting || !exportFrom || !exportTo || exportFrom > exportTo}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 transition">
                {exporting ? '생성 중...' : '다운로드'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
