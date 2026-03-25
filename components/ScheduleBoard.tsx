'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Therapist, DailyAttendance, ScheduleSlot, TherapistWithSlots, Reservation } from '@/lib/types'
import { TherapistColumn } from './TherapistColumn'
import { SummaryFooter } from './SummaryFooter'
import { SlotModal } from './SlotModal'
import { formatDate, toDateString, getBusinessDate, mapServiceName, getServicePrice, getServiceDuration, addMinutesToTime, getAvailableRoom, isReservationInBusinessDay, getAutoMemo } from '@/lib/utils'
import { useTheme } from './ThemeProvider'
import { useStore } from './StoreProvider'

const MAX_SLOTS = 5

interface Props {
  initialTherapists: Therapist[]
  initialAttendance: DailyAttendance[]
  initialSlots: ScheduleSlot[]
  initialDate: string
}

export function ScheduleBoard({ initialTherapists, initialAttendance, initialSlots, initialDate }: Props) {
  const [date, setDate] = useState(initialDate)
  const [therapists, setTherapists] = useState(initialTherapists)
  const [attendance, setAttendance] = useState(initialAttendance)
  const [slots, setSlots] = useState(initialSlots)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedTherapistId, setSelectedTherapistId] = useState<string | null>(null)
  const [editingSlot, setEditingSlot] = useState<ScheduleSlot | null>(null)
  const [manager, setManager] = useState('')
  const [editingManager, setEditingManager] = useState(false)
  const { theme, toggle } = useTheme()
  const { storeId, storeName, signOut } = useStore()

  const fetchData = useCallback(async (workDate: string) => {
    const [attendanceRes, slotsRes, managerRes] = await Promise.all([
      supabase.from('daily_attendance').select('*').eq('work_date', workDate),
      supabase.from('schedule_slots').select('*').eq('work_date', workDate),
      supabase.from('daily_settings').select('manager').eq('work_date', workDate).single(),
    ])
    setAttendance(attendanceRes.data ?? [])
    setSlots(slotsRes.data ?? [])
    setManager(managerRes.data?.manager ?? '')
  }, [])

  // On mount, always reset to today's business date
  useEffect(() => {
    const today = getBusinessDate(new Date())
    if (date !== today) {
      setDate(today)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchData(date)
  }, [date, fetchData])

  // Keep refs in sync for use in realtime callback
  const therapistsRef = useRef(therapists)
  const attendanceRef = useRef(attendance)
  const slotsRef = useRef(slots)
  const dateRef = useRef(date)
  const storeIdRef = useRef(storeId)
  useEffect(() => { therapistsRef.current = therapists }, [therapists])
  useEffect(() => { attendanceRef.current = attendance }, [attendance])
  useEffect(() => { slotsRef.current = slots }, [slots])
  useEffect(() => { dateRef.current = date }, [date])
  useEffect(() => { storeIdRef.current = storeId }, [storeId])

  // Track processed reservation IDs to prevent duplicates
  const processedReservations = useRef(new Set<string>())
  // Lock to prevent concurrent auto-assign
  const assigningLock = useRef(false)

  // Use ref for fetchData so the realtime effect doesn't re-subscribe
  const fetchDataRef = useRef(fetchData)
  useEffect(() => { fetchDataRef.current = fetchData }, [fetchData])

  // Auto-assign reservation to the therapist with fewest slots (by display_order)
  const autoAssignReservation = async (reservation: Reservation) => {
    // Prevent duplicate processing
    if (processedReservations.current.has(reservation.id)) return
    processedReservations.current.add(reservation.id)

    // Wait for any ongoing assignment to finish
    while (assigningLock.current) {
      await new Promise(r => setTimeout(r, 100))
    }
    assigningLock.current = true

    try {
      const currentDate = dateRef.current
      console.log('[AutoAssign] 시작:', { id: reservation.id, date: reservation.reserved_date, time: reservation.reserved_time, status: reservation.status, currentDate })
      if (!isReservationInBusinessDay(reservation.reserved_date, reservation.reserved_time, currentDate)) { console.log('[AutoAssign] 스킵: 날짜 불일치'); return }
      if (reservation.status && reservation.status !== '예약확정') { console.log('[AutoAssign] 스킵: status =', reservation.status); return }

      // Check if slot already exists in DB (single source of truth)
      const { data: existing } = await supabase
        .from('schedule_slots')
        .select('id')
        .eq('reservation_id', reservation.id)
        .limit(1)
      if (existing && existing.length > 0) return

      const currentAttendance = attendanceRef.current
      const currentTherapists = therapistsRef.current
      const currentSlots = slotsRef.current
      const presentAttendance = currentAttendance.filter(a => a.is_present)
      const attendanceOrder = new Map(presentAttendance.map(a => [a.therapist_id, a.display_order ?? 0]))
      const present = currentTherapists
        .filter(t => attendanceOrder.has(t.id))
        .sort((a, b) => (attendanceOrder.get(a.id) ?? 0) - (attendanceOrder.get(b.id) ?? 0))

      if (present.length === 0) return

      const slotCounts = new Map<string, number>()
      for (const t of present) slotCounts.set(t.id, 0)
      for (const s of currentSlots) {
        const prev = slotCounts.get(s.therapist_id)
        if (prev !== undefined) slotCounts.set(s.therapist_id, prev + 1)
      }

      const sorted = [...present]
        .filter(t => (slotCounts.get(t.id) ?? 0) < MAX_SLOTS)
        .sort((a, b) => {
          const countDiff = (slotCounts.get(a.id) ?? 0) - (slotCounts.get(b.id) ?? 0)
          if (countDiff !== 0) return countDiff
          return (attendanceOrder.get(a.id) ?? 0) - (attendanceOrder.get(b.id) ?? 0)
        })

      const assignTo = sorted[0]
      if (!assignTo) return

      const mappedService = mapServiceName(reservation.service_name ?? '')
      const price = getServicePrice(mappedService, reservation.customer_name ?? '')
      const usedRooms = currentSlots.map(s => s.room_number)
      const roomNumber = getAvailableRoom(mappedService, usedRooms)
      const autoMemo = getAutoMemo(reservation.customer_name ?? '')
      const resMemo = reservation.memo ?? ''
      const combinedMemo = [autoMemo, resMemo].filter(Boolean).join(' ')

      const maxOrder = currentSlots
        .filter(s => s.therapist_id === assignTo.id)
        .reduce((max, s) => Math.max(max, s.slot_order ?? 0), 0)

      await supabase.from('schedule_slots').insert({
        store_id: storeIdRef.current,
        therapist_id: assignTo.id,
        therapist_name: assignTo.name,
        work_date: currentDate,
        reservation_id: reservation.id,
        customer_name: reservation.customer_name,
        customer_phone: reservation.customer_phone,
        service_name: mappedService,
        service_price: price,
        room_number: roomNumber,
        reserved_time: reservation.reserved_time?.slice(0, 5) ?? null,
        check_in_time: null,
        check_out_time: null,
        payment_type: 'cash',
        memo: combinedMemo,
        slot_order: maxOrder + 1,
      })
    } finally {
      assigningLock.current = false
    }
  }

  // Realtime subscriptions - runs once on mount, uses refs for current values
  useEffect(() => {
    const channel = supabase
      .channel('schedule-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_slots' }, () => {
        fetchDataRef.current(dateRef.current)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_attendance' }, () => {
        fetchDataRef.current(dateRef.current)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reservations' }, (payload) => {
        console.log('[Realtime] reservation INSERT 수신:', payload.new)
        autoAssignReservation(payload.new as Reservation)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const navigateDate = (delta: number) => {
    const d = new Date(date + 'T00:00:00')
    d.setDate(d.getDate() + delta)
    setDate(toDateString(d))
  }

  const goToToday = () => setDate(getBusinessDate(new Date()))

  const saveManager = async (name: string) => {
    setManager(name)
    setEditingManager(false)
    await supabase.from('daily_settings').upsert({ store_id: storeId, work_date: date, manager: name }, { onConflict: 'store_id,work_date' })
  }

  const toBizMin = (t: string | null) => {
    if (!t) return 9999
    const [h, m] = t.slice(0, 5).split(':').map(Number)
    let v = h * 60 + m - 360
    if (v < 0) v += 1440
    return v
  }

  const sortSlots = (slotList: ScheduleSlot[]) =>
    slotList.sort((a, b) => {
      // Primary: slot_order (for manual reordering), secondary: business-day time
      const aOrder = a.slot_order ?? toBizMin(a.check_in_time)
      const bOrder = b.slot_order ?? toBizMin(b.check_in_time)
      if (aOrder !== bOrder) return aOrder - bOrder
      return toBizMin(a.check_in_time) - toBizMin(b.check_in_time)
    })

  // 기존 therapists 목록에서 출석한 관리사
  const fromTherapists: TherapistWithSlots[] = therapists
    .map(t => {
      const att = attendance.find(a => a.therapist_id === t.id)
      return {
        ...t,
        display_order: att?.display_order ?? t.display_order,
        is_present: att?.is_present ?? false,
        attendance_id: att?.id ?? null,
        slots: sortSlots(slots.filter(s => s.therapist_id === t.id)),
      }
    })
    .filter(t => t.is_present)

  // 삭제된 관리사: 슬롯은 있지만 therapists 테이블에 없는 경우
  const knownIds = new Set(therapists.map(t => t.id))
  const orphanTherapistIds = [...new Set(
    slots.filter(s => s.therapist_id && !knownIds.has(s.therapist_id)).map(s => s.therapist_id!)
  )]
  const fromOrphans: TherapistWithSlots[] = orphanTherapistIds.map(id => {
    const att = attendance.find(a => a.therapist_id === id)
    const therapistSlots = slots.filter(s => s.therapist_id === id)
    const name = therapistSlots[0]?.therapist_name ?? '(삭제됨)'
    return {
      id,
      name,
      is_active: false,
      display_order: att?.display_order ?? 999,
      store_id: storeId ?? '',
      is_present: true,
      attendance_id: att?.id ?? null,
      slots: sortSlots(therapistSlots),
    }
  })

  const presentTherapists: TherapistWithSlots[] = [...fromTherapists, ...fromOrphans]
    .sort((a, b) => a.display_order - b.display_order)

  const isToday = date === toDateString(new Date())
  const dateObj = new Date(date + 'T00:00:00')

  const handleAddSlot = (therapistId: string) => {
    setSelectedTherapistId(therapistId)
    setEditingSlot(null)
    setModalOpen(true)
  }

  const handleEditSlot = (slot: ScheduleSlot) => {
    setSelectedTherapistId(slot.therapist_id)
    setEditingSlot(slot)
    setModalOpen(true)
  }

  const handleModalClose = () => {
    setModalOpen(false)
    setSelectedTherapistId(null)
    setEditingSlot(null)
    fetchData(date)
  }

  // Drag & drop: move slot to another therapist
  const handleDropSlot = async (slotId: string, targetTherapistId: string) => {
    const slot = slots.find(s => s.id === slotId)
    if (!slot || slot.therapist_id === targetTherapistId) return
    // Optimistic update
    setSlots(prev => prev.map(s => s.id === slotId ? { ...s, therapist_id: targetTherapistId } : s))
    await supabase.from('schedule_slots').update({ therapist_id: targetTherapistId }).eq('id', slotId)
  }

  // Drag & drop: swap two slots (cross-column or same-column)
  const handleSwapSlots = async (draggedSlotId: string, targetSlotId: string) => {
    const draggedSlot = slots.find(s => s.id === draggedSlotId)
    const targetSlot = slots.find(s => s.id === targetSlotId)
    if (!draggedSlot || !targetSlot) return

    // Swap therapist_id and slot_order
    const newDragged = { ...draggedSlot, therapist_id: targetSlot.therapist_id, slot_order: targetSlot.slot_order }
    const newTarget = { ...targetSlot, therapist_id: draggedSlot.therapist_id, slot_order: draggedSlot.slot_order }

    // Optimistic update
    setSlots(prev => prev.map(s => {
      if (s.id === draggedSlotId) return newDragged
      if (s.id === targetSlotId) return newTarget
      return s
    }))

    // Persist both updates
    await Promise.all([
      supabase.from('schedule_slots').update({
        therapist_id: newDragged.therapist_id,
        slot_order: newDragged.slot_order,
      }).eq('id', draggedSlotId),
      supabase.from('schedule_slots').update({
        therapist_id: newTarget.therapist_id,
        slot_order: newTarget.slot_order,
      }).eq('id', targetSlotId),
    ])
  }

  // Drag & drop: reorder therapist columns (insert at position) — per-date via daily_attendance
  const handleDropColumn = async (draggedId: string, targetId: string, side: 'left' | 'right') => {
    // Work with present therapists sorted by current display_order
    const present = [...presentTherapists].sort((a, b) => a.display_order - b.display_order)
    const draggedIdx = present.findIndex(t => t.id === draggedId)
    const targetIdx = present.findIndex(t => t.id === targetId)
    if (draggedIdx === -1 || targetIdx === -1 || draggedIdx === targetIdx) return

    // Remove dragged, insert at new position
    const reordered = present.filter(t => t.id !== draggedId)
    let insertIdx = reordered.findIndex(t => t.id === targetId)
    if (side === 'right') insertIdx += 1
    reordered.splice(insertIdx, 0, present[draggedIdx])

    // Assign sequential display_order and update attendance records
    const updatedAttendance = attendance.map(a => {
      const newIdx = reordered.findIndex(t => t.id === a.therapist_id)
      if (newIdx !== -1) return { ...a, display_order: newIdx }
      return a
    })

    // Optimistic update
    setAttendance(updatedAttendance)

    // Persist to daily_attendance
    const toUpdate = updatedAttendance.filter(a => {
      const old = attendance.find(o => o.id === a.id)
      return old && old.display_order !== a.display_order
    })
    await Promise.all(
      toUpdate.map(a => supabase.from('daily_attendance').update({ display_order: a.display_order }).eq('id', a.id))
    )
  }

  return (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-[#0f1117] text-slate-800 dark:text-slate-200">
      {/* Header - single row */}
      <header className="shrink-0 bg-white dark:bg-[#161b27] border-b border-slate-200 dark:border-slate-700/60">
        <div className="flex items-center justify-between px-3 sm:px-5 py-2 sm:py-3">
          <div className="flex items-center gap-2 shrink-0">
            <h1 className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">{storeName ?? 'The Thai'}</h1>
            {editingManager ? (
              <input
                autoFocus
                type="text"
                defaultValue={manager}
                placeholder="담당자"
                onBlur={e => saveManager(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveManager((e.target as HTMLInputElement).value) }}
                className="w-16 sm:w-20 h-6 px-1.5 bg-slate-50 dark:bg-slate-800 border border-emerald-500 rounded text-[10px] sm:text-xs text-slate-900 dark:text-slate-100 outline-none"
              />
            ) : (
              <button
                onClick={() => setEditingManager(true)}
                className="h-6 px-1.5 bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 transition-colors"
              >
                {manager || '담당자'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              onClick={() => navigateDate(-1)}
              className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg text-xs sm:text-sm transition-colors"
            >
              ←
            </button>
            <button
              onClick={goToToday}
              className={`px-2 sm:px-2.5 h-7 sm:h-8 rounded-lg text-[10px] sm:text-xs font-medium transition-colors ${
                isToday ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              오늘
            </button>
            <input
              type="date"
              value={date}
              onChange={e => e.target.value && setDate(e.target.value)}
              className="h-7 sm:h-8 px-2 sm:px-3 bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-700/60 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 border-none outline-none cursor-pointer transition-colors"
              style={{ colorScheme: theme === 'dark' ? 'dark' : 'light' }}
            />
            <button
              onClick={() => navigateDate(1)}
              className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg text-xs sm:text-sm transition-colors"
            >
              →
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={toggle}
              className="px-2 sm:px-3 py-1 sm:py-1.5 bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-700 rounded text-xs sm:text-sm transition-colors"
              title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <a
              href="/stats"
              className="px-2 sm:px-3 py-1 sm:py-1.5 bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-700 rounded text-[10px] sm:text-xs text-slate-600 dark:text-slate-300 transition-colors"
            >
              통계
            </a>
            <a
              href="/therapists"
              className="px-2 sm:px-3 py-1 sm:py-1.5 bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-700 rounded text-[10px] sm:text-xs text-slate-600 dark:text-slate-300 transition-colors"
            >
              관리사
            </a>
            <a
              href="/guide"
              className="px-2 sm:px-3 py-1 sm:py-1.5 bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-700 rounded text-[10px] sm:text-xs text-slate-600 dark:text-slate-300 transition-colors"
            >
              ?
            </a>
            <button
              onClick={signOut}
              className="px-2 sm:px-3 py-1 sm:py-1.5 bg-slate-200 dark:bg-slate-700/60 hover:bg-red-200 dark:hover:bg-red-900/40 hover:text-red-600 dark:hover:text-red-400 rounded text-[10px] sm:text-xs text-slate-600 dark:text-slate-300 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-auto p-2 sm:p-3 min-h-0">
        {presentTherapists.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500">
            <div className="text-center">
              <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">📋</div>
              <div className="text-sm sm:text-lg font-medium mb-2">출근한 관리사가 없습니다</div>
              <a href="/therapists" className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 text-xs sm:text-sm underline underline-offset-2">
                관리사 출근 처리하기 →
              </a>
            </div>
          </div>
        ) : (
          <div
            className="grid gap-2 sm:gap-3 h-full"
            style={{ gridTemplateColumns: `repeat(${presentTherapists.length}, minmax(160px, 1fr))` }}
          >
            {presentTherapists.map(therapist => (
              <TherapistColumn
                key={therapist.id}
                therapist={therapist}
                workDate={date}
                onAddSlot={() => handleAddSlot(therapist.id)}
                onEditSlot={handleEditSlot}
                onDropSlot={handleDropSlot}
                onSwapSlots={handleSwapSlots}
                onDropColumn={handleDropColumn}
              />
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      <SummaryFooter slots={slots} therapists={presentTherapists} />

      {/* Modal */}
      {modalOpen && selectedTherapistId && (
        <SlotModal
          therapistId={selectedTherapistId}
          therapistName={therapists.find(t => t.id === selectedTherapistId)?.name ?? ''}
          workDate={date}
          editingSlot={editingSlot}
          onClose={handleModalClose}
        />
      )}
    </div>
  )
}
