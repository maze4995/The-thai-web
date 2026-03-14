'use client'

import { ScheduleSlot, TherapistWithSlots } from '@/lib/types'
import { formatPrice, getServiceCommission, getCustomerType } from '@/lib/utils'

interface Props {
  slots: ScheduleSlot[]
  therapists: TherapistWithSlots[]
}

export function SummaryFooter({ slots, therapists }: Props) {
  // Total revenue: sum all prices (coupon with price=0 adds nothing, coupon with price>0 counts)
  const total = slots.reduce((s, slot) => s + slot.service_price, 0)
  const cash = slots.filter(s => s.payment_type === 'cash').reduce((s, slot) => s + slot.service_price, 0)
  const card = slots.filter(s => s.payment_type === 'card').reduce((s, slot) => s + slot.service_price, 0)
  const transfer = slots.filter(s => s.payment_type === 'transfer').reduce((s, slot) => s + slot.service_price, 0)
  const couponCount = slots.filter(s => s.memo?.includes('CM')).length
  const totalCustomers = slots.length

  // Customer type stats
  const newRoadCount = slots.filter(s => getCustomerType(s.customer_name) === '신규로드').length
  const existingRoadCount = slots.filter(s => getCustomerType(s.customer_name) === '기존로드').length
  const newCustomerCount = slots.filter(s => getCustomerType(s.customer_name) === '신규').length

  // Commission: fixed amount per service type
  const commissions = therapists.map(t => {
    const therapistSlots = slots.filter(s => s.therapist_id === t.id)
    const commission = therapistSlots.reduce((sum, slot) => sum + getServiceCommission(slot.service_name), 0)
    return { name: t.name, commission }
  })

  return (
    <footer className="shrink-0 bg-white dark:bg-[#161b27] border-t border-slate-200 dark:border-slate-700/60 px-4 py-2.5">
      {/* Sales summary */}
      <div className="flex items-center gap-4 mb-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 dark:text-slate-500 text-xs">총매출</span>
          <span className="text-slate-900 dark:text-white font-bold text-sm">{formatPrice(total)}</span>
        </div>
        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
        <div className="flex items-center gap-1">
          <span className="text-emerald-500 text-xs font-medium">현금</span>
          <span className="text-slate-700 dark:text-slate-200 text-sm font-semibold">{formatPrice(cash)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-blue-400 text-xs font-medium">카드</span>
          <span className="text-slate-700 dark:text-slate-200 text-sm font-semibold">{formatPrice(card)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-purple-400 text-xs font-medium">이체</span>
          <span className="text-slate-700 dark:text-slate-200 text-sm font-semibold">{formatPrice(transfer)}</span>
        </div>
        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
        <div className="flex items-center gap-1">
          <span className="text-slate-400 dark:text-slate-500 text-xs">쿠폰</span>
          <span className="text-amber-500 dark:text-amber-400 text-sm font-semibold">{couponCount}명</span>
        </div>
        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
        {newRoadCount > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-rose-400 text-xs font-medium">신규로드</span>
            <span className="text-slate-700 dark:text-slate-200 text-sm font-semibold">{newRoadCount}명</span>
          </div>
        )}
        {existingRoadCount > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-orange-400 text-xs font-medium">기존로드</span>
            <span className="text-slate-700 dark:text-slate-200 text-sm font-semibold">{existingRoadCount}명</span>
          </div>
        )}
        {newCustomerCount > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-cyan-400 text-xs font-medium">신규</span>
            <span className="text-slate-700 dark:text-slate-200 text-sm font-semibold">{newCustomerCount}명</span>
          </div>
        )}
        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
        <div className="flex items-center gap-1">
          <span className="text-slate-400 dark:text-slate-500 text-xs">총고객</span>
          <span className="text-slate-700 dark:text-slate-200 text-sm font-semibold">{totalCustomers}명</span>
        </div>
      </div>

      {/* Commission */}
      {commissions.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-slate-400 dark:text-slate-500 text-xs">커미션</span>
          {commissions.map(c => (
            <div key={c.name} className="flex items-center gap-1">
              <span className="text-slate-500 dark:text-slate-400 text-xs">{c.name}</span>
              <span className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold">{formatPrice(c.commission)}</span>
            </div>
          ))}
        </div>
      )}
    </footer>
  )
}
