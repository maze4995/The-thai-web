'use client'

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import { EMPTY_SCHEDULE, ScheduleCache } from './schedule-cache'
import type { Therapist } from './types'

export const SLOT_COLUMNS = 'id,store_id,reservation_id,therapist_id,therapist_name,room_number,reserved_time,check_in_time,check_out_time,work_date,payment_type,customer_name,customer_phone,service_name,service_price,memo,slot_order'

function createScheduleSource(storeId: string | null) {
  let therapists: Promise<Therapist[]> | undefined
  let therapistController: AbortController | undefined
  const resetTherapists = () => {
    therapistController?.abort()
    therapists = undefined
  }
  const getTherapists = () => {
    if (!therapists) {
      const controller = new AbortController()
      therapistController = controller
      therapists = Promise.resolve(supabase.from('therapists')
        .select('id,store_id,name,is_active,display_order')
        .eq('store_id', storeId!).eq('is_active', true)
        .order('display_order').order('name').abortSignal(controller.signal)
      ).then(({ data, error }) => {
        if (error) {
          if (therapistController === controller) therapists = undefined
          throw new Error('관리사 목록을 불러오지 못했습니다. 다시 시도해 주세요.')
        }
        return data ?? []
      })
    }
    return therapists
  }
  const cache = new ScheduleCache(async (workDate, signal) => {
    const [therapistRows, attendance, slots, manager] = await Promise.all([
      getTherapists(),
      supabase.from('daily_attendance').select('id,store_id,therapist_id,work_date,is_present,display_order')
        .eq('store_id', storeId!).eq('work_date', workDate).abortSignal(signal),
      supabase.from('schedule_slots').select(SLOT_COLUMNS)
        .eq('store_id', storeId!).eq('work_date', workDate).abortSignal(signal),
      supabase.from('daily_settings').select('manager')
        .eq('store_id', storeId!).eq('work_date', workDate).limit(1).abortSignal(signal),
    ])
    if (attendance.error || slots.error || manager.error) {
      throw new Error('조판지를 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.')
    }
    return { therapists: therapistRows, attendance: attendance.data ?? [],
      slots: slots.data ?? [], manager: manager.data?.[0]?.manager ?? '' }
  })
  return { cache, resetTherapists }
}

export function useSchedule(storeId: string | null, date: string) {
  const source = useMemo(() => createScheduleSource(storeId), [storeId])
  const dateRef = useRef(date)
  const snapshot = useSyncExternalStore(source.cache.subscribe,
    useCallback(() => source.cache.getSnapshot(date), [source, date]),
    () => EMPTY_SCHEDULE)

  useEffect(() => {
    dateRef.current = date
    if (!storeId) return
    void source.cache.load(date)
    return () => source.cache.cancel(date)
  }, [source, storeId, date])

  useEffect(() => () => {
    source.resetTherapists()
    source.cache.dispose()
  }, [source])

  useEffect(() => {
    if (!storeId) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      source.cache.invalidate()
      if (timer) return
      timer = setTimeout(() => {
        timer = undefined
        if (document.visibilityState === 'visible') void source.cache.load(dateRef.current)
      }, 150)
    }
    const refreshTherapists = () => { source.resetTherapists(); refresh() }
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshTherapists()
    }
    const channel = supabase.channel(`schedule-${storeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_slots', filter: `store_id=eq.${storeId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_attendance', filter: `store_id=eq.${storeId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_settings', filter: `store_id=eq.${storeId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'therapists', filter: `store_id=eq.${storeId}` }, refreshTherapists)
      .subscribe(status => {
        // Reconcile the fetch/subscription gap, including after a reconnect.
        if (status === 'SUBSCRIBED') refresh()
      })
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
      void supabase.removeChannel(channel)
    }
  }, [source, storeId])

  const refresh = useCallback(() => {
    if (storeId) void source.cache.load(date, true)
  }, [source, storeId, date])
  const update = useCallback((updater: Parameters<ScheduleCache['update']>[1]) => {
    source.cache.update(date, updater)
  }, [source, date])
  const read = useCallback(() => source.cache.getSnapshot(date).data, [source, date])
  return { ...snapshot, refresh, update, read }
}
