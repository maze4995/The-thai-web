'use client'

import { DragEvent, memo, useState } from 'react'
import { ScheduleSlot } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { formatTime, formatPrice, getPhoneLastFour, getServiceDuration, addMinutesToTime, getBusinessDate, PAYMENT_LABELS, parseMixedEntries } from '@/lib/utils'

import { useScheduleTime } from '@/lib/schedule-clock'
import { businessMinutes } from '@/lib/schedule-view'

interface Props {
  slot: ScheduleSlot
  workDate: string
  onEditSlot: (slot: ScheduleSlot) => void
  onSwapSlot?: (draggedSlotId: string, targetSlotId: string) => void
}

/** Round current time up to next multiple of 10 minutes */
function roundUpTo10(date: Date): string {
  const h = date.getHours()
  const m = date.getMinutes()
  const rounded = Math.ceil(m / 10) * 10
  if (rounded >= 60) {
    return `${String((h + 1) % 24).padStart(2, '0')}:00`
  }
  return `${String(h).padStart(2, '0')}:${String(rounded).padStart(2, '0')}`
}

/** Payment badge color classes */
const PAYMENT_BADGE_COLORS: Record<string, string> = {
  cash: 'bg-emerald-600 text-white',
  card: 'bg-blue-600 text-white',
  transfer: 'bg-purple-600 text-white',
  coupon: 'bg-amber-600 text-white',
  mixed: 'bg-red-500 text-white',
}

export const SlotCard = memo(function SlotCard({ slot, workDate, onEditSlot, onSwapSlot }: Props) {
  const [dropOver, setDropOver] = useState(false)
  const phone = getPhoneLastFour(slot.customer_phone)
  const paymentLabel = (() => {
    if (slot.payment_type !== 'mixed') return PAYMENT_LABELS[slot.payment_type] ?? slot.payment_type
    const entries = parseMixedEntries(slot.memo ?? '')
    if (!entries.length) return '복합'
    return entries.map(e => `${e.label}${e.amount ? formatPrice(e.amount) : ''}`).join('+')
  })()

  const hasCheckedIn = !!slot.check_in_time

  // Customer display name: last 4 chars of customer_name, fallback to phone last 4 digits
  const displayName = (() => {
    const name = slot.customer_name?.trim()
    if (name) return name.slice(-4)
    return phone
  })()

  // Time range display
  const timeRange = (() => {
    if (slot.check_in_time && slot.check_out_time) {
      return `${formatTime(slot.check_in_time)} ~ ${formatTime(slot.check_out_time)}`
    }
    if (slot.reserved_time) {
      return formatTime(slot.reserved_time)
    }
    return ''
  })()

  const isFinished = useScheduleTime(now => {
    if (!slot.check_in_time || !slot.check_out_time) return false
    const today = getBusinessDate(now)
    if (workDate < today) return true
    if (workDate > today) return false
    return businessMinutes(`${now.getHours()}:${now.getMinutes()}`) >= businessMinutes(slot.check_out_time)
  })

  // Left border color: yellow when serving (checked in, not finished), green otherwise
  const borderColor = (hasCheckedIn && !isFinished) ? 'border-l-yellow-400' : 'border-l-emerald-500'

  // Payment badge color
  const paymentBadgeColor = PAYMENT_BADGE_COLORS[slot.payment_type] ?? 'bg-slate-600 text-white'

  const handleDragStart = (e: DragEvent) => {
    e.dataTransfer.setData('application/slot-id', slot.id)
    e.dataTransfer.effectAllowed = 'move'
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5'
    }
  }

  const handleDragEnd = (e: DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
  }

  const handleSlotDragOver = (e: DragEvent) => {
    if (e.dataTransfer.types.includes('application/slot-id')) {
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'move'
      setDropOver(true)
    }
  }

  const handleSlotDragLeave = (e: DragEvent) => {
    const target = e.currentTarget as HTMLElement
    if (!target.contains(e.relatedTarget as Node)) {
      setDropOver(false)
    }
  }

  const handleSlotDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDropOver(false)
    const draggedSlotId = e.dataTransfer.getData('application/slot-id')
    if (draggedSlotId && draggedSlotId !== slot.id && onSwapSlot) {
      onSwapSlot(draggedSlotId, slot.id)
    }
  }

  const handleArrival = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const now = new Date()
    const checkIn = roundUpTo10(now)
    const duration = getServiceDuration(slot.service_name)
    const checkOut = addMinutesToTime(checkIn, duration)
    await supabase.from('schedule_slots').update({
      check_in_time: checkIn,
      check_out_time: checkOut,
    }).eq('id', slot.id)
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleSlotDragOver}
      onDragLeave={handleSlotDragLeave}
      onDrop={handleSlotDrop}
      onClick={() => onEditSlot(slot)}
      className={`w-full text-left rounded-lg p-2 sm:p-2.5 transition-all duration-150 cursor-grab active:cursor-grabbing group border-l-[3px] ${borderColor} ${
        dropOver
          ? 'bg-amber-900/30 ring-1 ring-amber-400/50'
          : isFinished
          ? 'bg-yellow-900/20 hover:bg-yellow-900/30 border border-yellow-700/30'
          : 'bg-[#1e2535] hover:bg-[#252d40]'
      }`}
    >
      {/* Row 1: Customer Name + Room badge */}
      <div className="flex items-center justify-between mb-1 sm:mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-white font-bold text-xs sm:text-sm truncate">{displayName}</span>
          {isFinished && (
            <span className="text-[9px] sm:text-[10px] font-bold tracking-wider bg-emerald-600 text-white px-1.5 py-0.5 rounded">
              완료
            </span>
          )}
          {hasCheckedIn && !isFinished && (
            <span className="text-[9px] sm:text-[10px] font-bold tracking-wider bg-red-500 text-white px-1.5 py-0.5 rounded animate-pulse">
              관리중
            </span>
          )}
        </div>
        <span className="text-[10px] sm:text-xs font-semibold rounded px-1.5 py-0.5 bg-[#141b27] text-slate-300 flex-shrink-0 ml-1">
          {slot.room_number}번방
        </span>
      </div>

      {/* Row 2: Service name in golden/amber */}
      <div className="mb-1 sm:mb-1.5">
        <span className="text-amber-400 font-semibold text-xs sm:text-sm">{slot.service_name}</span>
      </div>

      {/* Row 3: Clock icon + time range */}
      {timeRange && (
        <div className="flex items-center gap-1 mb-1.5 sm:mb-2">
          <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span className="text-slate-300 text-[10px] sm:text-xs font-medium">{timeRange}</span>
        </div>
      )}

      {/* Row 4: Payment badge + Price */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full ${paymentBadgeColor}`}>
          {paymentLabel}
        </span>
        <span className="text-[10px] sm:text-xs text-slate-300 font-medium">
          {formatPrice(slot.service_price)}
        </span>
      </div>

      {/* Row 5: Memo */}
      {slot.memo && (
        <div className="mt-1.5 pt-1 border-t border-slate-700/40">
          <span className="text-[10px] sm:text-xs text-slate-400 line-clamp-2">{slot.memo}</span>
        </div>
      )}

      {/* Arrival button - shown only when no check-in time */}
      {!hasCheckedIn && (
        <button
          onClick={handleArrival}
          className="w-full mt-1.5 sm:mt-2 py-1 sm:py-1.5 bg-amber-500 hover:bg-amber-400 text-white text-[10px] sm:text-xs font-bold rounded-md transition-colors"
        >
          손님도착
        </button>
      )}
    </div>
  )
})
