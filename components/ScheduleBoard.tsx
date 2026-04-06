'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Therapist, DailyAttendance, ScheduleSlot, TherapistWithSlots, Reservation } from '@/lib/types'
import { TherapistColumn } from './TherapistColumn'
import { SummaryFooter } from './SummaryFooter'
import { SlotModal } from './SlotModal'
import { toDateString, getBusinessDate, mapServiceName, getServicePrice, getAvailableRoom, isReservationInBusinessDay, getAutoMemo } from '@/lib/utils'
import { useTheme } from './ThemeProvider'
import { useStore } from './StoreProvider'
import { resolveServicePrice, useStoreServices } from '@/lib/service-config'

// Module-level dedup: persists across React Strict Mode remounts
const processedReservationIds = new Set<string>()

interface Props {
  initialTherapists: Therapist[]
  initialAttendance: DailyAttendance[]
  initialSlots: ScheduleSlot[]
  initialDate: string
}

interface DailySettingsRow {
  manager: string | null
}

export function ScheduleBoard({ initialTherapists, initialAttendance, initialSlots, initialDate }: Props) {
  const [date, setDate] = useState(initialDate)
  const [therapists] = useState(initialTherapists)
  const [attendance, setAttendance] = useState(initialAttendance)
  const [slots, setSlots] = useState(initialSlots)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedTherapistId, setSelectedTherapistId] = useState<string | null>(null)
  const [editingSlot, setEditingSlot] = useState<ScheduleSlot | null>(null)
  const [manager, setManager] = useState('')
  const [editingManager, setEditingManager] = useState(false)
  const { } = useTheme()
  const { storeId, storeName, settings, features } = useStore()
  const staffLabel = settings.staffLabel
  const { serviceOptions } = useStoreServices(storeId)

  const fetchData = useCallback(async (workDate: string) => {
    if (!storeId) {
      setAttendance([])
      setSlots([])
      setManager('')
      return
    }

    const [attendanceRes, slotsRes, managerRes] = await Promise.all([
      supabase
        .from('daily_attendance')
        .select('*')
        .eq('store_id', storeId)
        .eq('work_date', workDate),
      supabase
        .from('schedule_slots')
        .select('*')
        .eq('store_id', storeId)
        .eq('work_date', workDate),
      supabase
        .from('daily_settings')
        .select('manager')
        .eq('store_id', storeId)
        .eq('work_date', workDate)
        .limit(1),
    ])

    const managerRow = (managerRes.data?.[0] ?? null) as DailySettingsRow | null

    setAttendance(attendanceRes.data ?? [])
    setSlots(slotsRes.data ?? [])
    setManager(managerRow?.manager ?? '')
  }, [storeId])

  // On mount, always reset to today's business date
  useEffect(() => {
    setDate(getBusinessDate(new Date()))
  }, [])

  useEffect(() => {
    if (!storeId) return
    fetchData(date)
  }, [date, fetchData, storeId])

  // Keep refs in sync for use in realtime callback
  const slotsRef = useRef(slots)
  const dateRef = useRef(date)
  const storeIdRef = useRef(storeId)
  useEffect(() => { slotsRef.current = slots }, [slots])
  useEffect(() => { dateRef.current = date }, [date])
  useEffect(() => { storeIdRef.current = storeId }, [storeId])

  // Lock to prevent concurrent auto-assign
  const assigningLock = useRef(false)

  // Use ref for fetchData so the realtime effect doesn't re-subscribe
  const fetchDataRef = useRef(fetchData)
  useEffect(() => { fetchDataRef.current = fetchData }, [fetchData])

  // Auto-assign reservation to the therapist with fewest slots (by display_order)
  const autoAssignReservation = async (reservation: Reservation) => {
    // Prevent duplicate processing (module-level Set survives remounts)
    if (processedReservationIds.has(reservation.id)) return
    processedReservationIds.add(reservation.id)

    // Wait for any ongoing assignment to finish
    while (assigningLock.current) {
      await new Promise(r => setTimeout(r, 100))
    }
    assigningLock.current = true

    try {
      const currentDate = dateRef.current
      const currentStoreId = storeIdRef.current
      if (!currentStoreId) return
      if (reservation.store_id && reservation.store_id !== currentStoreId) return
      console.log('[AutoAssign] 시작:', { id: reservation.id, date: reservation.reserved_date, time: reservation.reserved_time, status: reservation.status, currentDate })
      if (!isReservationInBusinessDay(reservation.reserved_date, reservation.reserved_time, currentDate)) { console.log('[AutoAssign] 스킵: 날짜 불일치'); return }
      if (reservation.status && reservation.status !== '예약확정') { console.log('[AutoAssign] 스킵: status =', reservation.status); return }

      // Check if slot already exists in DB (single source of truth)
      const { data: existing } = await supabase
        .from('schedule_slots')
        .select('id')
        .eq('store_id', currentStoreId)
        .eq('reservation_id', reservation.id)
        .limit(1)
      if (existing && existing.length > 0) return

      const currentSlots = slotsRef.current
      const mappedService = mapServiceName(reservation.service_name ?? '')
      const price = resolveServicePrice(
        mappedService,
        reservation.customer_name ?? '',
        serviceOptions
      ) || getServicePrice(mappedService, reservation.customer_name ?? '')
      const usedRooms = currentSlots.map(s => s.room_number)
      const roomNumber = getAvailableRoom(mappedService, usedRooms)
      const autoMemo = getAutoMemo(reservation.customer_name ?? '')
      const resMemo = reservation.memo ?? ''
      const combinedMemo = [autoMemo, resMemo].filter(Boolean).join(' ')

      const { error } = await supabase.rpc('auto_assign_schedule_slot', {
        p_store_id: currentStoreId,
        p_work_date: currentDate,
        p_reservation_id: reservation.id,
        p_customer_name: reservation.customer_name,
        p_customer_phone: reservation.customer_phone,
        p_service_name: mappedService,
        p_service_price: price,
        p_room_number: roomNumber,
        p_reserved_time: reservation.reserved_time?.slice(0, 5) ?? null,
        p_payment_type: 'cash',
        p_memo: combinedMemo,
      })

      if (error) {
        throw error
      }
    } catch (error) {
      processedReservationIds.delete(reservation.id)
      console.error('[AutoAssign] 슬롯 자동 생성 실패:', error)
    } finally {
      assigningLock.current = false
    }
  }

  // Realtime subscriptions - runs once on mount, uses refs for current values
  useEffect(() => {
    if (!storeId) return
    const channel = supabase
      .channel(`schedule-realtime-${storeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_slots', filter: `store_id=eq.${storeId}` }, () => {
        fetchDataRef.current(dateRef.current)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_attendance', filter: `store_id=eq.${storeId}` }, () => {
        fetchDataRef.current(dateRef.current)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reservations', filter: `store_id=eq.${storeId}` }, (payload) => {
        console.log('[Realtime] reservation INSERT 수신:', payload.new)
        autoAssignReservation(payload.new as Reservation)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [storeId])

  const navigateDate = (delta: number) => {
    const d = new Date(date + 'T00:00:00')
    d.setDate(d.getDate() + delta)
    setDate(toDateString(d))
  }

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

  if (!features.scheduleBoardEnabled) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#0f1117]">
        <div className="px-8 py-10">
          <div className="mx-auto max-w-2xl rounded-3xl border border-slate-700/30 bg-[#131825] p-8 text-center shadow-2xl shadow-black/30">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-slate-300">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="mb-2 text-2xl font-bold text-white">조판 기능이 비활성화되어 있습니다</h2>
            <p className="text-sm leading-7 text-slate-400">
              이 매장은 아직 조판 기능을 사용하지 않도록 설정되어 있습니다.
              설정을 활성화하면 기존 화면과 동일한 방식으로 사용할 수 있습니다.
            </p>
            <div className="mt-5 inline-flex rounded-full border border-[#D4A574]/30 bg-[#1a2035] px-4 py-2 text-xs font-medium text-[#D4A574]">
              현재 직원 라벨: {staffLabel}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 h-screen bg-[#0f1117] text-slate-200">
        {/* Header */}
        <header className="shrink-0 bg-[#161b27] border-b border-slate-700/60">
          <div className="grid grid-cols-3 items-center px-4 py-2.5">
            {/* Left: Title + Manager */}
            <div className="flex items-center gap-3 shrink-0">
              <h1 className="text-base font-bold text-[#D4A574] tracking-tight">
                {storeName ?? 'The Thai'}
              </h1>
              {editingManager ? (
                <input
                  autoFocus
                  type="text"
                  defaultValue={manager}
                  placeholder="담당자"
                  onBlur={e => saveManager(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveManager((e.target as HTMLInputElement).value) }}
                  className="w-20 h-7 px-2 bg-slate-800 border border-[#D4A574] rounded text-xs text-slate-100 outline-none"
                />
              ) : (
                <button
                  onClick={() => setEditingManager(true)}
                  className="h-7 px-2 bg-slate-800/60 hover:bg-slate-700 rounded text-xs text-slate-400 transition-colors"
                >
                  {manager || '담당자'}
                </button>
              )}
            </div>

            {/* Center: Date Navigation */}
            <div className="flex items-center justify-center gap-1.5">
              <button
                onClick={() => navigateDate(-1)}
                className="w-8 h-8 flex items-center justify-center bg-slate-700/60 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
              >
                ‹
              </button>
              <div className="flex items-center gap-1.5 bg-slate-800/60 hover:bg-slate-700/60 rounded-lg px-3 h-8 cursor-pointer transition-colors">
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <input
                  type="date"
                  value={date}
                  onChange={e => e.target.value && setDate(e.target.value)}
                  className="bg-transparent text-sm font-semibold text-slate-100 border-none outline-none cursor-pointer"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
              <button
                onClick={() => navigateDate(1)}
                className="w-8 h-8 flex items-center justify-center bg-slate-700/60 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
              >
                ›
              </button>
            </div>

            {/* Right: empty for balance */}
            <div />
          </div>
        </header>

        {/* Board */}
        <div className="flex-1 overflow-x-auto overflow-y-auto p-3 min-h-0">
          {presentTherapists.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-500">
              <div className="text-center">
                <div className="text-5xl mb-4">📋</div>
                <div className="text-lg font-medium mb-2">출근한 {staffLabel}이 없습니다</div>
                <a href="/therapists" className="text-[#D4A574] hover:text-[#c49464] text-sm underline underline-offset-2">
                  {staffLabel} 출근 처리하기 →
                </a>
              </div>
            </div>
          ) : (
            <div
              className="grid gap-3 h-full"
              style={{ gridTemplateColumns: `repeat(${Math.max(presentTherapists.length, 5)}, minmax(200px, 1fr))` }}
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
        <SummaryFooter slots={slots} therapists={presentTherapists} manager={manager} />

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
