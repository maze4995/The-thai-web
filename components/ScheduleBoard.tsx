'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Therapist, DailyAttendance, ScheduleSlot, TherapistWithSlots, Reservation } from '@/lib/types'
import { TherapistColumn } from './TherapistColumn'
import { SummaryFooter } from './SummaryFooter'
import { SlotModal } from './SlotModal'
import { formatDate, toDateString, getBusinessDate, mapServiceName, getServicePrice, getServiceDuration, addMinutesToTime, getAvailableRoom, isReservationInBusinessDay, getAutoMemo } from '@/lib/utils'
import { useTheme } from './ThemeProvider'

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
  const { theme, toggle } = useTheme()

  const fetchData = useCallback(async (workDate: string) => {
    const [attendanceRes, slotsRes] = await Promise.all([
      supabase.from('daily_attendance').select('*').eq('work_date', workDate),
      supabase.from('schedule_slots').select('*').eq('work_date', workDate),
    ])
    setAttendance(attendanceRes.data ?? [])
    setSlots(slotsRes.data ?? [])
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
  useEffect(() => { therapistsRef.current = therapists }, [therapists])
  useEffect(() => { attendanceRef.current = attendance }, [attendance])
  useEffect(() => { slotsRef.current = slots }, [slots])
  useEffect(() => { dateRef.current = date }, [date])

  // Track processed reservation IDs to prevent duplicates
  const processedReservations = useRef(new Set<string>())

  // Auto-assign reservation to the therapist with fewest slots (by display_order)
  const autoAssignReservation = useCallback(async (reservation: Reservation) => {
    // Prevent duplicate processing from rapid INSERT+UPDATE events
    if (processedReservations.current.has(reservation.id)) return
    processedReservations.current.add(reservation.id)

    const currentDate = dateRef.current
    // Business day: 06:00 ~ next day 05:59
    if (!isReservationInBusinessDay(reservation.reserved_date, reservation.reserved_time, currentDate)) return
    // Mobile app doesn't set status on INSERT (defaults to '예약확정')
    // Accept null/undefined status as confirmed, reject only explicit cancellations
    if (reservation.status && reservation.status !== '예약확정') return

    // Check if slot already exists for this reservation (in local state)
    const currentSlots = slotsRef.current
    if (currentSlots.some(s => s.reservation_id === reservation.id)) return

    // Check if slot already exists in DB
    const { data: existing } = await supabase
      .from('schedule_slots')
      .select('id')
      .eq('reservation_id', reservation.id)
      .limit(1)
    if (existing && existing.length > 0) return

    // Get present therapists sorted by display_order
    const currentAttendance = attendanceRef.current
    const currentTherapists = therapistsRef.current
    const presentIds = new Set(
      currentAttendance.filter(a => a.is_present).map(a => a.therapist_id)
    )
    const present = currentTherapists
      .filter(t => presentIds.has(t.id))
      .sort((a, b) => a.display_order - b.display_order)

    if (present.length === 0) return

    // Find therapist with fewest slots (ties broken by display_order)
    const slotCounts = new Map<string, number>()
    for (const t of present) slotCounts.set(t.id, 0)
    for (const s of currentSlots) {
      const prev = slotCounts.get(s.therapist_id)
      if (prev !== undefined) slotCounts.set(s.therapist_id, prev + 1)
    }

    const target = present.find(t => (slotCounts.get(t.id) ?? 0) < MAX_SLOTS)
    if (!target) return // All therapists full

    // Sort present therapists by slot count, then display_order
    const sorted = [...present]
      .filter(t => (slotCounts.get(t.id) ?? 0) < MAX_SLOTS)
      .sort((a, b) => {
        const countDiff = (slotCounts.get(a.id) ?? 0) - (slotCounts.get(b.id) ?? 0)
        if (countDiff !== 0) return countDiff
        return a.display_order - b.display_order
      })

    const assignTo = sorted[0]
    if (!assignTo) return

    const mappedService = mapServiceName(reservation.service_name ?? '')
    const price = getServicePrice(mappedService, reservation.customer_name ?? '')

    // Find available room based on service type and currently used rooms
    const usedRooms = currentSlots.map(s => s.room_number)
    const roomNumber = getAvailableRoom(mappedService, usedRooms)

    // Auto-generate memo from customer name patterns
    const autoMemo = getAutoMemo(reservation.customer_name ?? '')
    const resMemo = reservation.memo ?? ''
    const combinedMemo = [autoMemo, resMemo].filter(Boolean).join(' ')

    // check_in_time / check_out_time are set when "손님도착" is clicked, NOT from reserved_time
    await supabase.from('schedule_slots').insert({
      therapist_id: assignTo.id,
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
    })
  }, [])

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('schedule-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_slots' }, () => {
        fetchData(date)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_attendance' }, () => {
        fetchData(date)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reservations' }, (payload) => {
        autoAssignReservation(payload.new as Reservation)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [date, fetchData, autoAssignReservation])

  const navigateDate = (delta: number) => {
    const d = new Date(date + 'T00:00:00')
    d.setDate(d.getDate() + delta)
    setDate(toDateString(d))
  }

  const goToToday = () => setDate(getBusinessDate(new Date()))

  const presentTherapists: TherapistWithSlots[] = therapists
    .map(t => {
      const att = attendance.find(a => a.therapist_id === t.id)
      return {
        ...t,
        is_present: att?.is_present ?? false,
        attendance_id: att?.id ?? null,
        slots: slots
          .filter(s => s.therapist_id === t.id)
          .sort((a, b) => {
            if (!a.check_in_time) return 1
            if (!b.check_in_time) return -1
            return a.check_in_time.localeCompare(b.check_in_time)
          }),
      }
    })
    .filter(t => t.is_present)

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

  // Drag & drop: reorder therapist columns (insert at position)
  const handleDropColumn = async (draggedId: string, targetId: string, side: 'left' | 'right') => {
    const sorted = [...therapists].sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name))
    const draggedIdx = sorted.findIndex(t => t.id === draggedId)
    const targetIdx = sorted.findIndex(t => t.id === targetId)
    if (draggedIdx === -1 || targetIdx === -1 || draggedIdx === targetIdx) return

    // Remove dragged, insert at new position
    const reordered = sorted.filter(t => t.id !== draggedId)
    let insertIdx = reordered.findIndex(t => t.id === targetId)
    if (side === 'right') insertIdx += 1
    reordered.splice(insertIdx, 0, sorted[draggedIdx])

    // Assign sequential display_order
    const updated = reordered.map((t, i) => ({ ...t, display_order: i }))

    // Optimistic update
    setTherapists(updated)

    // Persist only changed ones
    const updates = updated.filter((t, i) => sorted.find(s => s.id === t.id)?.display_order !== i)
    await Promise.all(
      updates.map(t => supabase.from('therapists').update({ display_order: t.display_order }).eq('id', t.id))
    )
  }

  return (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-[#0f1117] text-slate-800 dark:text-slate-200">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 bg-white dark:bg-[#161b27] border-b border-slate-200 dark:border-slate-700/60 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">The Thai Web</h1>
          <span className="text-slate-400 dark:text-slate-500 text-xs">조판지</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateDate(-1)}
            className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-700 rounded text-sm transition-colors"
          >
            ←
          </button>
          <button
            onClick={goToToday}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              isToday ? 'bg-emerald-800/60 text-emerald-300 border border-emerald-700' : 'bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            오늘
          </button>
          <span className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800/60 rounded text-sm font-semibold min-w-[200px] text-center text-slate-900 dark:text-slate-100">
            {formatDate(dateObj)}
          </span>
          <button
            onClick={() => navigateDate(1)}
            className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-700 rounded text-sm transition-colors"
          >
            →
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-700 rounded text-sm transition-colors"
            title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <a
            href="/therapists"
            className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700/60 hover:bg-slate-300 dark:hover:bg-slate-700 rounded text-xs text-slate-600 dark:text-slate-300 transition-colors"
          >
            관리사 관리
          </a>
        </div>
      </header>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-auto p-3 min-h-0">
        {presentTherapists.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500">
            <div className="text-center">
              <div className="text-5xl mb-4">📋</div>
              <div className="text-lg font-medium mb-2">출근한 관리사가 없습니다</div>
              <a href="/therapists" className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 text-sm underline underline-offset-2">
                관리사 출근 처리하기 →
              </a>
            </div>
          </div>
        ) : (
          <div
            className="grid gap-3 h-full"
            style={{ gridTemplateColumns: `repeat(${presentTherapists.length}, minmax(210px, 1fr))` }}
          >
            {presentTherapists.map(therapist => (
              <TherapistColumn
                key={therapist.id}
                therapist={therapist}
                onAddSlot={() => handleAddSlot(therapist.id)}
                onEditSlot={handleEditSlot}
                onDropSlot={handleDropSlot}
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
