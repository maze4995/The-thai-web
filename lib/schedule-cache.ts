import type { DailyAttendance, ScheduleSlot, Therapist } from './types'

export interface ScheduleDay {
  therapists: Therapist[]
  attendance: DailyAttendance[]
  slots: ScheduleSlot[]
  manager: string
}
export interface ScheduleSnapshot {
  data: ScheduleDay | null
  loading: boolean
  error: string | null
}
export const EMPTY_SCHEDULE: ScheduleSnapshot = { data: null, loading: true, error: null }
interface Entry {
  snapshot: ScheduleSnapshot
  updatedAt: number
  revision: number
  request?: { controller: AbortController; promise: Promise<void>; slotChanges: Map<string, ScheduleSlot | null> }
}

function mergeSlot(slots: ScheduleSlot[], id: string, row: ScheduleSlot | null): ScheduleSlot[] {
  const index = slots.findIndex(slot => slot.id === id)
  if (!row) return index < 0 ? slots : slots.filter(slot => slot.id !== id)
  return index < 0 ? [...slots, row] : slots.map(slot => slot.id === id ? row : slot)
}

// Retain unchanged row identities so unrelated updates don't render every card.
function reconcileRows<T extends { id: string }>(previous: T[], next: T[]): T[] {
  const byId = new Map(previous.map(row => [row.id, row]))
  const rows = next.map(row => {
    const old = byId.get(row.id)
    return old && Object.keys(row).length === Object.keys(old).length &&
      (Object.keys(row) as (keyof T)[]).every(key => row[key] === old[key]) ? old : row
  })
  return rows.length === previous.length && rows.every((row, index) => row === previous[index])
    ? previous : rows
}
function reconcileDay(previous: ScheduleDay | null, next: ScheduleDay): ScheduleDay {
  if (!previous) return next
  return {
    ...next,
    therapists: reconcileRows(previous.therapists, next.therapists),
    attendance: reconcileRows(previous.attendance, next.attendance),
    slots: reconcileRows(previous.slots, next.slots),
  }
}

/** One board/store owns this bounded, memory-only cache. Never persist customer data. */
export class ScheduleCache {
  private entries = new Map<string, Entry>()
  private listeners = new Set<() => void>()
  constructor(
    private loader: (date: string, signal: AbortSignal) => Promise<ScheduleDay>,
    private options = { maxDays: 7, staleMs: 15_000 },
  ) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  getSnapshot = (date: string): ScheduleSnapshot => this.entries.get(date)?.snapshot ?? EMPTY_SCHEDULE
  private emit() { this.listeners.forEach(listener => listener()) }

  load(date: string, force = false): Promise<void> {
    let entry = this.entries.get(date)
    if (entry) {
      this.entries.delete(date)
      this.entries.set(date, entry)
      if (entry.request && !force) return entry.request.promise
      if (!force && entry.snapshot.data && Date.now() - entry.updatedAt < this.options.staleMs) {
        return Promise.resolve()
      }
      entry.request?.controller.abort()
    } else {
      entry = { snapshot: EMPTY_SCHEDULE, updatedAt: 0, revision: 0 }
      this.entries.set(date, entry)
      while (this.entries.size > this.options.maxDays) {
        const oldest = this.entries.keys().next().value!
        this.entries.get(oldest)?.request?.controller.abort()
        this.entries.delete(oldest)
      }
    }
    const current = entry
    const revision = current.revision
    const controller = new AbortController()
    const slotChanges = new Map<string, ScheduleSlot | null>()
    current.snapshot = { ...current.snapshot, loading: true, error: null }
    const promise = Promise.resolve().then(() => this.loader(date, controller.signal)).then(data => {
      if (controller.signal.aborted || this.entries.get(date) !== current) return
      // A read that began before an event must not erase the already displayed row.
      for (const [id, row] of slotChanges) {
        data = { ...data, slots: mergeSlot(data.slots, id, row) }
      }
      current.updatedAt = current.revision === revision ? Date.now() : 0
      current.snapshot = { data: reconcileDay(current.snapshot.data, data), loading: false, error: null }
    }).catch(error => {
      if (controller.signal.aborted || this.entries.get(date) !== current) return
      current.updatedAt = 0
      current.snapshot = { ...current.snapshot, loading: false,
        error: error instanceof Error ? error.message : '조판지를 불러오지 못했습니다.' }
    }).finally(() => {
      if (current.request?.controller !== controller) return
      current.request = undefined
      this.emit()
      // Changes received during a read need one trailing read, not repeated aborts.
      if (!controller.signal.aborted && current.revision !== revision) void this.load(date)
    })
    current.request = { controller, promise, slotChanges }
    this.emit()
    return promise
  }

  applySlot(row: ScheduleSlot) {
    let changed = false
    for (const [date, entry] of this.entries) {
      const belongs = date === row.work_date
      const data = entry.snapshot.data
      const exists = data?.slots.some(slot => slot.id === row.id)
      if (!belongs && !exists && !entry.request) continue
      // Record removals for other dates too: an in-flight read can contain the
      // slot's previous date even if the current snapshot does not yet have it.
      entry.request?.slotChanges.set(row.id, belongs ? row : null)
      entry.updatedAt = 0
      ++entry.revision
      if (!data) continue
      const slots = mergeSlot(data.slots, row.id, belongs ? row : null)
      if (slots === data.slots) continue
      entry.snapshot = { ...entry.snapshot, data: { ...data, slots } }
      changed = true
    }
    if (changed) this.emit()
  }

  cancel(date: string) {
    const entry = this.entries.get(date)
    if (!entry?.request) return
    entry.request.controller.abort()
    entry.request = undefined
    entry.snapshot = { ...entry.snapshot, loading: false }
    this.emit()
  }
  invalidate() {
    for (const entry of this.entries.values()) {
      entry.updatedAt = 0
      ++entry.revision
    }
  }
  update(date: string, updater: (data: ScheduleDay) => ScheduleDay) {
    const entry = this.entries.get(date)
    if (!entry?.snapshot.data) return
    this.cancel(date)
    entry.updatedAt = 0
    entry.snapshot = { data: updater(entry.snapshot.data), loading: false, error: null }
    this.emit()
  }
  dispose() {
    this.entries.forEach(entry => entry.request?.controller.abort())
    this.entries.clear()
  }
}
