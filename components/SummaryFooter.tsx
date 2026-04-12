'use client'

import { ScheduleSlot, TherapistWithSlots } from '@/lib/types'
import { formatPrice, getServiceCommission, resolveCustomerType, parseMixedEntries } from '@/lib/utils'
import { resolveServiceCommission, useStoreServices } from '@/lib/service-config'
import { useStore } from './StoreProvider'

interface Props {
  slots: ScheduleSlot[]
  therapists: TherapistWithSlots[]
  manager?: string
}

export function SummaryFooter({ slots, therapists, manager }: Props) {
  const { storeId } = useStore()
  const { serviceOptions } = useStoreServices(storeId)
  const isSpecial = (s: ScheduleSlot) => s.memo?.includes('스페셜')
  const isCoupon = (s: ScheduleSlot) => /cm/i.test(s.memo ?? '')
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

  const resolveType = (s: ScheduleSlot) => resolveCustomerType(s.customer_name, s.customer_phone, s.memo ?? '')
  const newRoadCount = slots.filter(s => resolveType(s) === '신규로드').length
  const existingRoadCount = slots.filter(s => resolveType(s) === '기존로드').length
  const newCustomerCount = slots.filter(s => resolveType(s) === '신규').length

  const commissions = therapists.map(t => {
    const therapistSlots = slots.filter(s => s.therapist_id === t.id)
    const commission = therapistSlots.reduce(
      (sum, slot) => sum + (resolveServiceCommission(slot.service_name, serviceOptions) || getServiceCommission(slot.service_name)),
      0
    )
    return { name: t.name, count: therapistSlots.length, commission }
  })

  return (
    <footer className="shrink-0 bg-[#131825] border-t border-slate-700/60 px-4 py-2">
      <div className="flex items-center gap-2">

        {/* 담당자 */}
        <div className="flex items-center gap-1.5 pr-2 border-r border-slate-700/50 shrink-0">
          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v1.2c0 .7.5 1.2 1.2 1.2h16.8c.7 0 1.2-.5 1.2-1.2v-1.2c0-3.2-6.4-4.8-9.6-4.8z"/>
            </svg>
          </div>
          <span className="text-slate-300 text-xs font-medium">{manager || '담당자'}</span>
        </div>

        {/* 총 매출 */}
        <div className="flex items-center gap-1.5 bg-[#1a2035] rounded-lg px-3 py-1.5 border border-[#D4A574]/30 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-[#D4A574]" />
          <span className="text-[10px] text-slate-400">총매출</span>
          <span className="text-[#D4A574] font-bold text-sm">{formatPrice(total)}</span>
          <span className="text-[10px] text-slate-500">{totalCustomers}건</span>
        </div>

        {/* 현금 */}
        <div className="flex items-center gap-1.5 bg-[#1a2035] rounded-lg px-2.5 py-1.5 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] text-slate-400">현금</span>
          <span className="text-emerald-400 font-bold text-xs">{formatPrice(cash)}</span>
        </div>

        {/* 카드 */}
        <div className="flex items-center gap-1.5 bg-[#1a2035] rounded-lg px-2.5 py-1.5 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <span className="text-[10px] text-slate-400">카드</span>
          <span className="text-blue-400 font-bold text-xs">{formatPrice(card)}</span>
        </div>

        {/* 이체 */}
        <div className="flex items-center gap-1.5 bg-[#1a2035] rounded-lg px-2.5 py-1.5 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          <span className="text-[10px] text-slate-400">이체</span>
          <span className="text-purple-400 font-bold text-xs">{formatPrice(transfer)}</span>
        </div>

        {/* 쿠폰 */}
        <div className="flex items-center gap-1.5 bg-[#1a2035] rounded-lg px-2.5 py-1.5 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span className="text-[10px] text-slate-400">쿠폰</span>
          <span className="text-amber-400 font-bold text-xs">{couponCount}명</span>
        </div>

        {/* 고객유형 */}
        <div className="flex items-center gap-2 bg-[#1a2035] rounded-lg px-2.5 py-1.5 shrink-0">
          <span className="text-[10px]"><span className="text-rose-400">신규로드</span> <span className="text-white font-semibold">{newRoadCount}</span></span>
          <span className="text-[10px]"><span className="text-orange-400">기존로드</span> <span className="text-white font-semibold">{existingRoadCount}</span></span>
          <span className="text-[10px]"><span className="text-cyan-400">신규</span> <span className="text-white font-semibold">{newCustomerCount}</span></span>
        </div>

        {/* 커미션 */}
        {commissions.length > 0 && (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-700/50 shrink-0">
            <span className="text-slate-500 text-[10px]">커미션</span>
            {commissions.map(c => (
              <span key={c.name} className="text-[10px]">
                <span className="text-slate-400">{c.name}</span>
                <span className="text-emerald-400 font-bold ml-0.5">{formatPrice(c.commission)}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </footer>
  )
}
