'use client'

import { ScheduleSlot, TherapistWithSlots } from '@/lib/types'
import { formatPrice, getServiceCommission, getCustomerType, parseMixedEntries } from '@/lib/utils'

interface Props {
  slots: ScheduleSlot[]
  therapists: TherapistWithSlots[]
}

export function SummaryFooter({ slots, therapists }: Props) {
  // 스페셜 and CM can coexist on same slot
  const isSpecial = (s: ScheduleSlot) => s.memo?.includes('스페셜')
  const isCoupon = (s: ScheduleSlot) => /cm/i.test(s.memo ?? '')
  // Revenue: exclude pure CM (without 스페셜). 스페셜+CM → included. mixed → always included.
  const getMixedAmount = (slot: ScheduleSlot, label: string) =>
    parseMixedEntries(slot.memo ?? '').find(e => e.label === label)?.amount ?? 0
  const revenueSlots = slots.filter(s => {
    if (s.payment_type === 'mixed') return true
    return !isCoupon(s) || isSpecial(s)
  })
  const total = revenueSlots.reduce((s, slot) => {
    if (slot.payment_type === 'mixed') return s + slot.service_price - getMixedAmount(slot, '쿠폰')
    return s + slot.service_price
  }, 0)
  const cash = revenueSlots.reduce((s, slot) => {
    if (slot.payment_type === 'cash') return s + slot.service_price
    if (slot.payment_type === 'mixed') return s + getMixedAmount(slot, '현금')
    return s
  }, 0)
  const card = revenueSlots.reduce((s, slot) => {
    if (slot.payment_type === 'card') return s + slot.service_price
    if (slot.payment_type === 'mixed') return s + getMixedAmount(slot, '카드')
    return s
  }, 0)
  const transfer = revenueSlots.reduce((s, slot) => {
    if (slot.payment_type === 'transfer') return s + slot.service_price
    if (slot.payment_type === 'mixed') return s + getMixedAmount(slot, '이체')
    return s
  }, 0)
  const couponCount = slots.filter(s => isCoupon(s) || (s.payment_type === 'mixed' && getMixedAmount(s, '쿠폰') > 0)).length
  const totalCustomers = slots.length

  // Customer type stats (empty phone → 신규로드)
  const resolveType = (s: ScheduleSlot) => !s.customer_phone ? '신규로드' : getCustomerType(s.customer_name)
  const newRoadCount = slots.filter(s => resolveType(s) === '신규로드').length
  const existingRoadCount = slots.filter(s => resolveType(s) === '기존로드').length
  const newCustomerCount = slots.filter(s => resolveType(s) === '신규').length

  // Commission: fixed amount per service type
  const commissions = therapists.map(t => {
    const therapistSlots = slots.filter(s => s.therapist_id === t.id)
    const commission = therapistSlots.reduce((sum, slot) => sum + getServiceCommission(slot.service_name), 0)
    return { name: t.name, commission }
  })

  return (
    <footer className="shrink-0 bg-white dark:bg-[#161b27] border-t border-slate-200 dark:border-slate-700/60 px-2.5 sm:px-4 py-1.5 sm:py-2.5">
      {/* Sales summary */}
      <div className="flex items-center gap-2 sm:gap-4 mb-1 sm:mb-2 flex-wrap text-[10px] sm:text-xs">
        <div className="flex items-center gap-1">
          <span className="text-slate-400 dark:text-slate-500">총매출</span>
          <span className="text-slate-900 dark:text-white font-bold text-xs sm:text-sm">{formatPrice(total)}</span>
        </div>
        <div className="w-px h-3 sm:h-4 bg-slate-200 dark:bg-slate-700" />
        <div className="flex items-center gap-0.5 sm:gap-1">
          <span className="text-emerald-500 font-medium">현금</span>
          <span className="text-slate-700 dark:text-slate-200 font-semibold">{formatPrice(cash)}</span>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1">
          <span className="text-blue-400 font-medium">카드</span>
          <span className="text-slate-700 dark:text-slate-200 font-semibold">{formatPrice(card)}</span>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1">
          <span className="text-purple-400 font-medium">이체</span>
          <span className="text-slate-700 dark:text-slate-200 font-semibold">{formatPrice(transfer)}</span>
        </div>
        <div className="w-px h-3 sm:h-4 bg-slate-200 dark:bg-slate-700" />
        <div className="flex items-center gap-0.5 sm:gap-1">
          <span className="text-slate-400 dark:text-slate-500">쿠폰</span>
          <span className="text-amber-500 dark:text-amber-400 font-semibold">{couponCount}명</span>
        </div>
        <div className="w-px h-3 sm:h-4 bg-slate-200 dark:bg-slate-700" />
        {newRoadCount > 0 && (
          <div className="flex items-center gap-0.5 sm:gap-1">
            <span className="text-rose-400 font-medium">신규로드</span>
            <span className="text-slate-700 dark:text-slate-200 font-semibold">{newRoadCount}명</span>
          </div>
        )}
        {existingRoadCount > 0 && (
          <div className="flex items-center gap-0.5 sm:gap-1">
            <span className="text-orange-400 font-medium">기존로드</span>
            <span className="text-slate-700 dark:text-slate-200 font-semibold">{existingRoadCount}명</span>
          </div>
        )}
        {newCustomerCount > 0 && (
          <div className="flex items-center gap-0.5 sm:gap-1">
            <span className="text-cyan-400 font-medium">신규</span>
            <span className="text-slate-700 dark:text-slate-200 font-semibold">{newCustomerCount}명</span>
          </div>
        )}
        <div className="w-px h-3 sm:h-4 bg-slate-200 dark:bg-slate-700" />
        <div className="flex items-center gap-0.5 sm:gap-1">
          <span className="text-slate-400 dark:text-slate-500">총고객</span>
          <span className="text-slate-700 dark:text-slate-200 font-semibold">{totalCustomers}명</span>
        </div>
      </div>

      {/* Commission */}
      {commissions.length > 0 && (
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className="text-slate-400 dark:text-slate-500 text-[10px] sm:text-xs">커미션</span>
          {commissions.map(c => (
            <div key={c.name} className="flex items-center gap-0.5 sm:gap-1">
              <span className="text-slate-500 dark:text-slate-400 text-[10px] sm:text-xs">{c.name}</span>
              <span className="text-emerald-600 dark:text-emerald-400 text-[10px] sm:text-xs font-semibold">{formatPrice(c.commission)}</span>
            </div>
          ))}
        </div>
      )}
    </footer>
  )
}
