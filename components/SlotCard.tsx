'use client'

import { DragEvent, useState, useEffect } from 'react'
import { ScheduleSlot } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { formatTime, formatPrice, getPhoneLastFour, getServiceDuration, addMinutesToTime, getBusinessDate, PAYMENT_LABELS, PAYMENT_COLORS, parseMixedEntries } from '@/lib/utils'

interface Props {
  slot: ScheduleSlot
  workDate: string
  onClick: () => void
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

export function SlotCard({ slot, workDate, onClick, onSwapSlot }: Props) {
  const [dropOver, setDropOver] = useState(false)
  const phone = getPhoneLastFour(slot.customer_phone)
  const paymentColor = PAYMENT_COLORS[slot.payment_type] ?? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600'
  const paymentLabel = (() => {
    if (slot.payment_type !== 'mixed') return PAYMENT_LABELS[slot.payment_type] ?? slot.payment_type
    const entries = parseMixedEntries(slot.memo ?? '')
    if (!entries.length) return '복합'
    return entries.map(e => `${e.label}${e.amount ? formatPrice(e.amount) : ''}`).join('+')
  })()

  const hasCheckedIn = !!slot.check_in_time

  // Normalize time to business-day minutes (06:00=0, 23:00=1020, 00:00=1080, 05:59=1439)
  const toBizMin = (h: number, m: number) => { let t = h * 60 + m - 360; if (t < 0) t += 1440; return t }

  // Check if service is finished (check_out_time has passed)
  const [isFinished, setIsFinished] = useState(false)
  useEffect(() => {
    const check = () => {
      if (!slot.check_in_time || !slot.check_out_time) { setIsFinished(false); return }
      const now = new Date()
      const todayBiz = getBusinessDate(now)
      // Past dates: always finished
      if (workDate < todayBiz) { setIsFinished(true); return }
      const nowBiz = toBizMin(now.getHours(), now.getMinutes())
      const [outH, outM] = slot.check_out_time.slice(0, 5).split(':').map(Number)
      const outBiz = toBizMin(outH, outM)
      setIsFinished(nowBiz >= outBiz)
    }
    check()
    const interval = setInterval(check, 30000)
    return () => clearInterval(interval)
  }, [slot.check_in_time, slot.check_out_time, workDate])

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
      onClick={onClick}
      className={`w-full text-left rounded-lg p-1.5 sm:p-2.5 transition-all duration-150 cursor-grab active:cursor-grabbing group border ${
        dropOver
          ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-400 dark:border-amber-500 ring-1 ring-amber-400/50'
          : 'bg-slate-50 dark:bg-[#1e2535] hover:bg-slate-100 dark:hover:bg-[#252d40] border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-500'
      }`}
    >
      {/* Row 1: Phone + Room + Finished badge */}
      <div className="flex items-center justify-between mb-1 sm:mb-1.5">
        <div className="flex items-center gap-1 sm:gap-1.5">
          <span className="text-slate-900 dark:text-slate-100 font-bold text-xs sm:text-sm tracking-wider">{phone}</span>
          {isFinished && (
            <span className="text-[9px] sm:text-[10px] font-bold tracking-wider bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 px-1 sm:px-1.5 py-0.5 rounded">
              완료
            </span>
          )}
        </div>
        <span className="text-[10px] sm:text-xs font-semibold rounded px-1 sm:px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
          {slot.room_number}번방
        </span>
      </div>

      {/* Row 2: Service + Price */}
      <div className="flex items-center justify-between mb-1 sm:mb-1.5">
        <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-xs sm:text-sm">{slot.service_name}</span>
        <span className={`text-[10px] sm:text-xs font-medium px-1 sm:px-1.5 py-0.5 rounded border ${paymentColor}`}>
          {paymentLabel}{slot.payment_type !== 'mixed' && ` ${formatPrice(slot.service_price)}`}
        </span>
      </div>

      {/* Row 3: Time info (vertical) */}
      <div className="flex flex-col gap-0.5 text-[10px] sm:text-xs">
        {slot.reserved_time && (
          <div className="flex items-center justify-between">
            <span className="text-amber-400 dark:text-amber-500 w-5 sm:w-6">예약</span>
            <span className="text-amber-500 dark:text-amber-400 font-medium">{formatTime(slot.reserved_time)}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-slate-400 dark:text-slate-500 w-5 sm:w-6">입</span>
          <span className="text-slate-600 dark:text-slate-300 font-medium">{formatTime(slot.check_in_time)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400 dark:text-slate-500 w-5 sm:w-6">출</span>
          <span className="text-slate-600 dark:text-slate-300 font-medium">{formatTime(slot.check_out_time)}</span>
        </div>
      </div>

      {/* Row 4: Memo */}
      <div className="mt-1 sm:mt-1.5 pt-1 sm:pt-1.5 border-t border-slate-200 dark:border-slate-700/40">
        <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 line-clamp-1 sm:line-clamp-2">{slot.memo || '\u00A0'}</span>
      </div>

      {/* Arrival button - shown only when no check-in time */}
      {!hasCheckedIn && (
        <button
          onClick={handleArrival}
          className="w-full mt-1.5 sm:mt-2 py-1 sm:py-1.5 bg-amber-500 hover:bg-amber-400 dark:bg-amber-600 dark:hover:bg-amber-500 text-white text-[10px] sm:text-xs font-bold rounded-md transition-colors"
        >
          손님도착
        </button>
      )}
    </div>
  )
}
