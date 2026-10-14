import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ScheduleCache, EMPTY_SCHEDULE, type ScheduleDay } from '../lib/schedule-cache'
import { buildScheduleColumns, businessMinutes } from '../lib/schedule-view'
import type { ScheduleSlot } from '../lib/types'

function day(manager: string): ScheduleDay {
  return { manager, therapists: [], attendance: [], slots: [] }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve))

test('rapid date changes abort obsolete reads and never mix date snapshots', async () => {
  const a = deferred<ScheduleDay>()
  let signal!: AbortSignal
  const cache = new ScheduleCache((date, input) => {
    if (date === 'A') { signal = input; return a.promise }
    return Promise.resolve(day('B'))
  })
  const pending = cache.load('A')
  await tick()
  cache.cancel('A')
  await cache.load('B')
  a.resolve(day('late A'))
  await pending
  assert.equal(signal.aborted, true)
  assert.equal(cache.getSnapshot('A').data, null)
  assert.equal(cache.getSnapshot('B').data?.manager, 'B')
})

test('revisiting a fresh day needs no extra request; a stale day stays visible while updating', async () => {
  let calls = 0
  const refresh = deferred<ScheduleDay>()
  const cache = new ScheduleCache(async () => ++calls === 1 ? day('cached') : refresh.promise)
  await cache.load('A')
  await cache.load('A')
  assert.equal(calls, 1)
  cache.invalidate()
  const pending = cache.load('A')
  assert.equal(cache.getSnapshot('A').data?.manager, 'cached')
  assert.equal(cache.getSnapshot('A').loading, true)
  refresh.resolve(day('fresh'))
  await pending
  assert.equal(cache.getSnapshot('A').data?.manager, 'fresh')
  assert.equal(calls, 2)
})

test('simultaneous reads are deduplicated; force reload cannot be overwritten by an old result', async () => {
  const first = deferred<ScheduleDay>()
  let calls = 0
  const cache = new ScheduleCache(async () => ++calls === 1 ? first.promise : day('latest'))
  const pending = cache.load('A')
  assert.equal(cache.load('A'), pending)
  await tick()
  await cache.load('A', true)
  first.resolve(day('old'))
  await pending
  assert.equal(cache.getSnapshot('A').data?.manager, 'latest')
})

test('a realtime burst during an in-flight read gets one trailing refresh', async () => {
  const first = deferred<ScheduleDay>()
  let calls = 0
  const cache = new ScheduleCache(async () => ++calls === 1 ? first.promise : day('after changes'))
  const pending = cache.load('A')
  await tick()
  for (let i = 0; i < 10; i++) { cache.invalidate(); void cache.load('A') }
  assert.equal(calls, 1)
  first.resolve(day('before changes'))
  await pending
  await tick()
  assert.equal(calls, 2)
  assert.equal(cache.getSnapshot('A').data?.manager, 'after changes')
})

test('read failures preserve cached data, expose an error, and allow retry', async () => {
  let fails = false
  const cache = new ScheduleCache(async () => {
    if (fails) throw new Error('offline')
    return day('safe')
  })
  await cache.load('A')
  fails = true
  await cache.load('A', true)
  assert.equal(cache.getSnapshot('A').data?.manager, 'safe')
  assert.equal(cache.getSnapshot('A').error, 'offline')
  fails = false
  await cache.load('A')
  assert.equal(cache.getSnapshot('A').error, null)
})

test('cache is bounded and isolated per store; disposal aborts and removes customer data', async () => {
  const first = new ScheduleCache(async date => day(date), { maxDays: 2, staleMs: 15_000 })
  const second = new ScheduleCache(async () => day('other store'))
  await first.load('A')
  await first.load('B')
  await first.load('A')
  await first.load('C')
  assert.equal(first.getSnapshot('B'), EMPTY_SCHEDULE)
  assert.equal(second.getSnapshot('A'), EMPTY_SCHEDULE)
  first.dispose()
  assert.equal(first.getSnapshot('A'), EMPTY_SCHEDULE)
})

function slot(id: string, therapist = 'one', order = 0): ScheduleSlot {
  return { id, therapist_id: therapist, therapist_name: '이전관리사', slot_order: order,
    store_id: 'store', reservation_id: null, work_date: '2026-10-13', room_number: 1,
    reserved_time: null, check_in_time: '23:00', check_out_time: '00:00', payment_type: 'cash',
    customer_name: '테스트', customer_phone: null, service_name: 'T60', service_price: 40000, memo: '' }
}

test('unchanged slots retain identity on refresh while changed slots are replaced', async () => {
  let changed = false
  const cache = new ScheduleCache(async () => ({ ...day('A'),
    slots: [slot('a'), { ...slot('b'), room_number: changed ? 2 : 1 }] }))
  await cache.load('A')
  const before = cache.getSnapshot('A').data!.slots
  changed = true
  await cache.load('A', true)
  const after = cache.getSnapshot('A').data!.slots
  assert.equal(before[0], after[0])
  assert.notEqual(before[1], after[1])
})

test('optimistic local changes cannot be overwritten by an older read', async () => {
  const old = deferred<ScheduleDay>()
  let calls = 0
  const cache = new ScheduleCache(async () => ++calls === 1 ? day('original') : old.promise)
  await cache.load('A')
  const pending = cache.load('A', true)
  cache.update('A', data => ({ ...data, manager: 'saved locally' }))
  old.resolve(day('stale'))
  await pending
  assert.equal(cache.getSnapshot('A').data?.manager, 'saved locally')
})

test('column ordering, absent staff and historical staff match the original board', () => {
  const therapists = [
    { id: 'one', name: '출근', is_active: true, display_order: 0 },
    { id: 'two', name: '미출근', is_active: true, display_order: 1 },
  ]
  const attendance = [{ id: 'att', therapist_id: 'one', work_date: '2026-10-13', is_present: true, display_order: 3 }]
  const slots = [slot('late', 'one', 2), slot('old', 'deleted', 1), slot('early', 'one', 1), slot('hidden', 'two', 1)]
  const columns = buildScheduleColumns(therapists, attendance, slots)
  assert.deepEqual(columns.map(row => row.id), ['one', 'deleted'])
  assert.deepEqual(columns[0].slots.map(row => row.id), ['early', 'late'])
  assert.equal(columns[1].name, '이전관리사')
  assert.deepEqual(slots.map(row => row.id), ['late', 'old', 'early', 'hidden'])
  assert.ok(businessMinutes('01:00') > businessMinutes('23:00'))
})

test('realtime rows appear before a pending read ends and survive its stale response', async () => {
  const stale = deferred<ScheduleDay>()
  const verified = deferred<ScheduleDay>()
  let calls = 0
  let readSignal: AbortSignal | undefined
  const cache = new ScheduleCache(async (_date, signal) => {
    ++calls
    if (calls === 1) return day('initial')
    if (calls === 2) { readSignal = signal; return stale.promise }
    return verified.promise
  })
  const date = '2026-10-13'
  await cache.load(date)
  const pending = cache.load(date, true)
  await tick()
  const inserted = slot('new-reservation')
  cache.applySlot(inserted)
  assert.deepEqual(cache.getSnapshot(date).data!.slots, [inserted])
  assert.equal(readSignal?.aborted, false)
  stale.resolve(day('old response'))
  await pending
  assert.deepEqual(cache.getSnapshot(date).data!.slots, [inserted])
  verified.resolve({ ...day('verified'), slots: [inserted] })
  await tick()
  assert.deepEqual(cache.getSnapshot(date).data!.slots, [inserted])
  assert.equal(calls, 3)
})

test('realtime updates move slots between cached dates without duplicate cards', async () => {
  const inserted = slot('move')
  const cache = new ScheduleCache(async date => ({ ...day(date), slots: date === inserted.work_date ? [inserted] : [] }))
  await cache.load('2026-10-13')
  await cache.load('2026-10-14')
  const moved = { ...inserted, work_date: '2026-10-14' }
  cache.applySlot(moved)
  cache.applySlot(moved)
  assert.equal(cache.getSnapshot('2026-10-13').data!.slots.length, 0)
  assert.deepEqual(cache.getSnapshot('2026-10-14').data!.slots, [moved])
})

test('incomplete and other-store realtime payloads require a normal reread', async () => {
  const { slotFromRealtime } = await import('../lib/schedule-realtime')
  const full = { ...slot('valid') }
  assert.deepEqual(slotFromRealtime('store', { eventType: 'INSERT', new: full }), full)
  assert.equal(slotFromRealtime('other', { eventType: 'INSERT', new: full }), null)
  assert.equal(slotFromRealtime('store', { eventType: 'UPDATE', new: { id: 'valid', store_id: 'store' } }), null)
  assert.equal(slotFromRealtime('store', { eventType: 'DELETE', new: full }), null)
})
