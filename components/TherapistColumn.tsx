'use client'

import { DragEvent, useState } from 'react'
import { TherapistWithSlots, ScheduleSlot } from '@/lib/types'
import { SlotCard } from './SlotCard'
import { getBusinessDate } from '@/lib/utils'

const MAX_SLOTS = 7

type DropSide = 'left' | 'right' | null

interface Props {
  therapist: TherapistWithSlots
  workDate: string
  onAddSlot: () => void
  onEditSlot: (slot: ScheduleSlot) => void
  onDropSlot: (slotId: string, therapistId: string) => void
  onDropColumn: (draggedId: string, targetId: string, side: 'left' | 'right') => void
}

export function TherapistColumn({ therapist, workDate, onAddSlot, onEditSlot, onDropSlot, onDropColumn }: Props) {
  const emptyCount = Math.max(0, MAX_SLOTS - therapist.slots.length)
  const [slotOver, setSlotOver] = useState(false)
  const [columnDropSide, setColumnDropSide] = useState<DropSide>(null)

  // Normalize time to business-day minutes (06:00=0, 23:00=1020, 00:00=1080, 05:59=1439)
  const toBizMin = (h: number, m: number) => { let t = h * 60 + m - 360; if (t < 0) t += 1440; return t }

  // Check if therapist is currently serving a customer (only for today)
  const now = new Date()
  const todayBiz = getBusinessDate(now)
  const isPastDate = workDate < todayBiz
  const nowBiz = toBizMin(now.getHours(), now.getMinutes())
  const isServing = !isPastDate && therapist.slots.some(s => {
    if (!s.check_in_time || !s.check_out_time) return false
    const [inH, inM] = s.check_in_time.slice(0, 5).split(':').map(Number)
    const [outH, outM] = s.check_out_time.slice(0, 5).split(':').map(Number)
    const inBiz = toBizMin(inH, inM)
    const outBiz = toBizMin(outH, outM)
    return nowBiz >= inBiz && nowBiz < outBiz
  })

  // --- Column drag (whole column is draggable via header) ---
  const handleHeaderDragStart = (e: DragEvent) => {
    e.dataTransfer.setData('application/column-id', therapist.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  // Column drop zone covers the whole column
  const handleColumnDragOver = (e: DragEvent) => {
    if (e.dataTransfer.types.includes('application/column-id')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      // Determine left/right half
      const rect = e.currentTarget.getBoundingClientRect()
      const midX = rect.left + rect.width / 2
      setColumnDropSide(e.clientX < midX ? 'left' : 'right')
    }
    if (e.dataTransfer.types.includes('application/slot-id')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setSlotOver(true)
    }
  }

  const handleColumnDragLeave = (e: DragEvent) => {
    const target = e.currentTarget as HTMLElement
    if (!target.contains(e.relatedTarget as Node)) {
      setColumnDropSide(null)
      setSlotOver(false)
    }
  }

  const handleColumnDrop = (e: DragEvent) => {
    // Handle column reorder
    const draggedColumnId = e.dataTransfer.getData('application/column-id')
    if (draggedColumnId && draggedColumnId !== therapist.id && columnDropSide) {
      onDropColumn(draggedColumnId, therapist.id, columnDropSide)
    }
    // Handle slot move
    const slotId = e.dataTransfer.getData('application/slot-id')
    if (slotId) {
      onDropSlot(slotId, therapist.id)
    }
    setColumnDropSide(null)
    setSlotOver(false)
  }

  const showLeftIndicator = columnDropSide === 'left'
  const showRightIndicator = columnDropSide === 'right'

  return (
    <div
      onDragOver={handleColumnDragOver}
      onDragLeave={handleColumnDragLeave}
      onDrop={handleColumnDrop}
      className="relative flex flex-col bg-white dark:bg-[#161b27] border border-slate-200 dark:border-slate-700/40 rounded-xl overflow-hidden"
    >
      {/* Left drop indicator */}
      {showLeftIndicator && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-l-xl z-10" />
      )}
      {/* Right drop indicator */}
      {showRightIndicator && (
        <div className="absolute right-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-r-xl z-10" />
      )}

      {/* Header - drag handle */}
      <div
        draggable
        onDragStart={handleHeaderDragStart}
        className="px-2 sm:px-3 py-1.5 sm:py-2.5 bg-slate-50 dark:bg-[#1a2035] border-b border-slate-200 dark:border-slate-700/40 flex items-center justify-between cursor-grab active:cursor-grabbing select-none"
      >
        <div className="flex items-center gap-1 sm:gap-1.5">
          <span className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">{therapist.name}</span>
          {isServing && (
            <span className="text-[9px] sm:text-[10px] font-bold tracking-wider bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 px-1 sm:px-1.5 py-0.5 rounded animate-pulse">
              관리중
            </span>
          )}
        </div>
        <span className="text-[10px] sm:text-xs text-slate-500 bg-slate-200 dark:bg-slate-800 px-1.5 sm:px-2 py-0.5 rounded-full">
          {therapist.slots.length}/{MAX_SLOTS}
        </span>
      </div>

      {/* Slots */}
      <div
        className={`flex-1 p-1.5 sm:p-2 flex flex-col gap-1.5 sm:gap-2 overflow-y-auto transition-colors ${
          slotOver ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''
        }`}
      >
        {therapist.slots.map(slot => (
          <SlotCard
            key={slot.id}
            slot={slot}
            workDate={workDate}
            onClick={() => onEditSlot(slot)}
          />
        ))}

        {/* Empty slots */}
        {Array.from({ length: emptyCount }).map((_, i) => (
          <button
            key={`empty-${i}`}
            onClick={onAddSlot}
            className="w-full h-[60px] sm:h-[80px] border border-dashed border-slate-300 dark:border-slate-700/60 hover:border-emerald-600/60 hover:bg-emerald-900/10 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-600 hover:text-emerald-500 transition-all duration-150 text-xs sm:text-sm"
          >
            + 추가
          </button>
        ))}
      </div>
    </div>
  )
}
