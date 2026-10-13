'use client'

import { useCallback, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DailyAttendance, ScheduleSlot, Therapist } from '@/lib/types'
import { toDateString, getBusinessDate } from '@/lib/utils'
import { SummaryFooter } from './SummaryFooter'
import { SlotModal } from './SlotModal'
import { TherapistColumn } from './TherapistColumn'
import { useStore } from './StoreProvider'
import { useSchedule } from '@/lib/use-schedule'
import { buildScheduleColumns } from '@/lib/schedule-view'

const EMPTY_THERAPISTS: Therapist[] = []
const EMPTY_ATTENDANCE: DailyAttendance[] = []
const EMPTY_SLOTS: ScheduleSlot[] = []

export function ScheduleBoard() {
  const { storeId } = useStore()
  return <ScheduleBoardContent key={storeId ?? 'no-store'} />
}

function ScheduleBoardContent() {
  const [date, setDate] = useState(() => getBusinessDate(new Date()))
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedTherapistId, setSelectedTherapistId] = useState<string | null>(null)
  const [editingSlot, setEditingSlot] = useState<ScheduleSlot | null>(null)
  const [managerDraft, setManagerDraft] = useState('')
  const [editingManager, setEditingManager] = useState(false)
  const [actionError, setActionError] = useState('')
  const { storeId, storeName, settings, features } = useStore()
  const { data, loading, error, refresh, update, read } = useSchedule(storeId, date)
  const therapists = data?.therapists ?? EMPTY_THERAPISTS
  const attendance = data?.attendance ?? EMPTY_ATTENDANCE
  const slots = data?.slots ?? EMPTY_SLOTS
  const manager = data?.manager ?? ''
  const staffLabel = settings.staffLabel
  const setSlots = useCallback((updater: (previous: ScheduleSlot[]) => ScheduleSlot[]) => {
    update(day => ({ ...day, slots: updater(day.slots) }))
  }, [update])
  const setAttendance = useCallback((rows: DailyAttendance[]) => {
    update(day => ({ ...day, attendance: rows }))
  }, [update])
  const presentTherapists = useMemo(
    () => buildScheduleColumns(therapists, attendance, slots),
    [therapists, attendance, slots],
  )

  const navigateDate = (delta: number) => {
    const nextDate = new Date(date + 'T00:00:00')
    nextDate.setDate(nextDate.getDate() + delta)
    setEditingManager(false)
    setActionError('')
    setDate(toDateString(nextDate))
  }

  const saveManager = async (name: string) => {
    if (!storeId || !data) return
    const previous = manager
    update(day => ({ ...day, manager: name }))
    setEditingManager(false)
    setActionError('')
    const { error } = await supabase.from('daily_settings')
      .upsert({ store_id: storeId, work_date: date, manager: name }, { onConflict: 'store_id,work_date' })
    if (error) {
      update(day => ({ ...day, manager: previous }))
      setActionError('담당자를 저장하지 못했습니다. 다시 시도해 주세요.')
    }
  }

  const handleAddSlot = useCallback((therapistId: string) => {
    setSelectedTherapistId(therapistId)
    setEditingSlot(null)
    setModalOpen(true)
  }, [])

  const handleEditSlot = useCallback((slot: ScheduleSlot) => {
    setSelectedTherapistId(slot.therapist_id)
    setEditingSlot(slot)
    setModalOpen(true)
  }, [])

  const handleModalClose = (changed = false) => {
    setModalOpen(false)
    setSelectedTherapistId(null)
    setEditingSlot(null)
    if (changed) refresh()
  }

  const handleDropSlot = useCallback(async (slotId: string, targetTherapistId: string) => {
    const slot = read()?.slots.find((item) => item.id === slotId)
    if (!slot || slot.therapist_id === targetTherapistId) return

    setSlots((prev) => prev.map((item) => (item.id === slotId ? { ...item, therapist_id: targetTherapistId } : item)))
    const { error } = await supabase.from('schedule_slots').update({ therapist_id: targetTherapistId }).eq('id', slotId).eq('store_id', storeId!)
    if (error) {
      setActionError('예약 이동에 실패했습니다. 다시 시도해 주세요.')
      refresh()
    }
  }, [read, setSlots, storeId, refresh])

  const handleSwapSlots = useCallback(async (draggedSlotId: string, targetSlotId: string) => {
    const draggedSlot = read()?.slots.find((item) => item.id === draggedSlotId)
    const targetSlot = read()?.slots.find((item) => item.id === targetSlotId)
    if (!draggedSlot || !targetSlot) return

    const nextDragged = {
      ...draggedSlot,
      therapist_id: targetSlot.therapist_id,
      slot_order: targetSlot.slot_order,
    }
    const nextTarget = {
      ...targetSlot,
      therapist_id: draggedSlot.therapist_id,
      slot_order: draggedSlot.slot_order,
    }

    setSlots((prev) =>
      prev.map((item) => {
        if (item.id === draggedSlotId) return nextDragged
        if (item.id === targetSlotId) return nextTarget
        return item
      })
    )

    const results = await Promise.all([
      supabase
        .from('schedule_slots')
        .update({
          therapist_id: nextDragged.therapist_id,
          slot_order: nextDragged.slot_order,
        })
        .eq('id', draggedSlotId).eq('store_id', storeId!),
      supabase
        .from('schedule_slots')
        .update({
          therapist_id: nextTarget.therapist_id,
          slot_order: nextTarget.slot_order,
        })
        .eq('id', targetSlotId).eq('store_id', storeId!),
    ])
    if (results.some(result => result.error)) {
      setActionError('예약 교환에 실패했습니다. 다시 시도해 주세요.')
      refresh()
    }
  }, [read, setSlots, storeId, refresh])

  const handleDropColumn = useCallback(async (draggedId: string, targetId: string, side: 'left' | 'right') => {
    const present = [...presentTherapists].sort((a, b) => a.display_order - b.display_order)
    const draggedIdx = present.findIndex((therapist) => therapist.id === draggedId)
    const targetIdx = present.findIndex((therapist) => therapist.id === targetId)
    if (draggedIdx === -1 || targetIdx === -1 || draggedIdx === targetIdx) return

    const reordered = present.filter((therapist) => therapist.id !== draggedId)
    let insertIdx = reordered.findIndex((therapist) => therapist.id === targetId)
    if (side === 'right') insertIdx += 1
    reordered.splice(insertIdx, 0, present[draggedIdx])

    const updatedAttendance = attendance.map((row) => {
      const newIdx = reordered.findIndex((therapist) => therapist.id === row.therapist_id)
      if (newIdx !== -1) return { ...row, display_order: newIdx }
      return row
    })

    setAttendance(updatedAttendance)

    const toUpdate = updatedAttendance.filter((row) => {
      const old = attendance.find((prev) => prev.id === row.id)
      return old && old.display_order !== row.display_order
    })

    const results = await Promise.all(
      toUpdate.map((row) =>
        supabase.from('daily_attendance').update({ display_order: row.display_order }).eq('id', row.id).eq('store_id', storeId!)
      )
    )
    if (results.some(result => result.error)) {
      setActionError('관리사 순서를 저장하지 못했습니다. 다시 시도해 주세요.')
      refresh()
    }
  }, [presentTherapists, attendance, setAttendance, storeId, refresh])

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
              설정에서 활성화하면 기존 화면과 같은 방식으로 바로 사용할 수 있습니다.
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
    <div className="flex h-screen min-w-0 flex-1 flex-col bg-[#0f1117] text-slate-200">
      <header className="shrink-0 border-b border-slate-700/60 bg-[#161b27]">
        <div className="grid grid-cols-3 items-center px-4 py-2.5">
          <div className="flex shrink-0 items-center gap-3">
            <h1 className="text-base font-bold tracking-tight text-[#D4A574]">
              {storeName ?? 'The Thai'}
            </h1>
            {editingManager ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  type="text"
                  value={managerDraft}
                  placeholder="담당자"
                  onChange={(e) => setManagerDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveManager(managerDraft)
                    if (e.key === 'Escape') setEditingManager(false)
                  }}
                  className="h-7 w-20 rounded border border-[#D4A574] bg-slate-800 px-2 text-xs text-slate-100 outline-none"
                />
                <button
                  onClick={() => saveManager(managerDraft)}
                  className="h-7 rounded bg-[#D4A574] px-2 text-xs font-medium text-slate-900 transition-colors hover:bg-[#c2955f]"
                >
                  저장
                </button>
                <button
                  onClick={() => setEditingManager(false)}
                  className="h-7 rounded bg-slate-700/60 px-2 text-xs text-slate-300 transition-colors hover:bg-slate-600"
                >
                  취소
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setManagerDraft(manager)
                  setEditingManager(true)
                }}
                className="h-7 rounded bg-slate-800/60 px-2 text-xs text-slate-400 transition-colors hover:bg-slate-700"
              >
                {manager || '담당자'}
              </button>
            )}
          </div>

          <div className="flex items-center justify-center gap-1.5">
            <button
              onClick={() => navigateDate(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700/60 text-sm text-slate-300 transition-colors hover:bg-slate-700"
            >
              ‹
            </button>
            <div className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-slate-800/60 px-3 transition-colors hover:bg-slate-700/60">
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <input
                type="date"
                value={date}
                onChange={(e) => { if (e.target.value) { setDate(e.target.value); setEditingManager(false); setActionError('') } }}
                className="cursor-pointer border-none bg-transparent text-sm font-semibold text-slate-100 outline-none"
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <button
              onClick={() => navigateDate(1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700/60 text-sm text-slate-300 transition-colors hover:bg-slate-700"
            >
              ›
            </button>
          </div>

          <div className="text-right text-xs text-slate-400" role="status" aria-live="polite">
            {loading && data ? '갱신 중...' : ''}
          </div>
        </div>
      </header>
      {(error || actionError) && (
        <div role="alert" className="flex shrink-0 items-center justify-between bg-red-950/40 px-4 py-2 text-sm text-red-200">
          <span>{error || actionError}</span>
          <button onClick={() => { setActionError(''); refresh() }} className="underline">다시 시도</button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto p-3">
        {!data ? (
          <div className="flex h-full items-center justify-center text-slate-400" role="status">
            {loading ? '조판지를 불러오는 중입니다...' : '조판지를 표시할 수 없습니다.'}
          </div>
        ) : presentTherapists.length === 0 ? (
          <div className="flex h-full items-center justify-center text-slate-500">
            <div className="text-center">
              <div className="mb-4 text-5xl">📥</div>
              <div className="mb-2 text-lg font-medium">출근한 {staffLabel}이 없습니다</div>
              <a href="/therapists" className="text-sm text-[#D4A574] underline underline-offset-2 hover:text-[#c49464]">
                {staffLabel} 출근 처리하기
              </a>
            </div>
          </div>
        ) : (
          <div
            className="grid h-full gap-3"
            style={{ gridTemplateColumns: `repeat(${Math.max(presentTherapists.length, 5)}, minmax(200px, 1fr))` }}
          >
            {presentTherapists.map((therapist) => (
              <TherapistColumn
                key={therapist.id}
                therapist={therapist}
                workDate={date}
                onAddSlot={handleAddSlot}
                onEditSlot={handleEditSlot}
                onDropSlot={handleDropSlot}
                onSwapSlots={handleSwapSlots}
                onDropColumn={handleDropColumn}
              />
            ))}
          </div>
        )}
      </div>

      {data && <SummaryFooter slots={slots} therapists={presentTherapists} manager={manager} />}

      {modalOpen && selectedTherapistId && (
        <SlotModal
          therapistId={selectedTherapistId}
          therapistName={therapists.find((therapist) => therapist.id === selectedTherapistId)?.name ?? ''}
          workDate={date}
          editingSlot={editingSlot}
          onClose={handleModalClose}
        />
      )}
    </div>
  )
}
