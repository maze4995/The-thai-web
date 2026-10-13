'use client'

import { useSyncExternalStore } from 'react'

// All visible cards/columns share one timer. Boolean snapshots only render a card
// when its serving/finished state actually changes.
let timestamp = Date.now()
let timer: ReturnType<typeof setInterval> | undefined
const listeners = new Set<() => void>()
function tick() {
  timestamp = Date.now()
  listeners.forEach(listener => listener())
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) {
    timestamp = Date.now()
    timer = setInterval(tick, 30_000)
    document.addEventListener('visibilitychange', tick)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      clearInterval(timer)
      timer = undefined
      document.removeEventListener('visibilitychange', tick)
    }
  }
}
export function useScheduleTime(check: (now: Date) => boolean) {
  return useSyncExternalStore(subscribe, () => check(new Date(timestamp)), () => false)
}
