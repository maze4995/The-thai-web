import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ScheduleMetadataCache } from '../lib/schedule-metadata-cache'
import { ScheduleCache } from '../lib/schedule-cache'

test('3-second reservation reads reuse metadata for 30 seconds, then recover a missed metadata event', async () => {
  let now = 0
  let metadataReads = 0
  let slotReads = 0
  let manager = 'old'
  const metadata = new ScheduleMetadataCache(async () => {
    ++metadataReads
    return { attendance: [], manager }
  }, () => now)
  const cache = new ScheduleCache(async (date, signal) => {
    ++slotReads
    return { ...await metadata.load(date, signal), therapists: [], slots: [] }
  })
  for (now = 0; now < 30_000; now += 3000) {
    await cache.revalidate('A')
    manager = 'new'
  }
  assert.equal(slotReads, 10)
  assert.equal(metadataReads, 1)
  await cache.revalidate('A')
  assert.equal(metadataReads, 2)
  assert.equal(cache.getSnapshot('A').data?.manager, 'new')
})

test('metadata events invalidate immediately and an older pending response cannot fill the cache', async () => {
  let finish!: (data: { attendance: []; manager: string }) => void
  let calls = 0
  const metadata = new ScheduleMetadataCache(async () => {
    if (++calls === 1) return new Promise(resolve => { finish = resolve })
    return { attendance: [], manager: 'new' }
  })
  const signal = new AbortController().signal
  const pending = metadata.load('A', signal)
  metadata.invalidate()
  finish({ attendance: [], manager: 'old' })
  await pending
  assert.equal((await metadata.load('A', signal)).manager, 'new')
  assert.equal(calls, 2)
})

test('metadata is date-local, bounded, and cancelled/failed reads are not cached', async () => {
  let calls = 0
  let fail = true
  const metadata = new ScheduleMetadataCache(async date => {
    ++calls
    if (date === 'bad' && fail) throw new Error('offline')
    return { attendance: [], manager: date }
  })
  const signal = new AbortController().signal
  await assert.rejects(metadata.load('bad', signal))
  fail = false
  assert.equal((await metadata.load('bad', signal)).manager, 'bad')
  const controller = new AbortController()
  const pending = metadata.load('cancelled', controller.signal)
  controller.abort()
  await pending
  const beforeRetry = calls
  await metadata.load('cancelled', signal)
  assert.equal(calls, beforeRetry + 1)
  for (let i = 0; i < 8; i++) await metadata.load(String(i), signal)
  const beforeEvicted = calls
  assert.equal((await metadata.load('0', signal)).manager, '0')
  assert.equal(calls, beforeEvicted + 1)
})

test('fallback poll skips a recently completed event read but still reads at the next deadline', async t => {
  let now = 100_000
  t.mock.method(Date, 'now', () => now)
  let calls = 0
  const cache = new ScheduleCache(async () => {
    ++calls
    return { therapists: [], attendance: [], slots: [], manager: '' }
  })
  await cache.load('A')
  now += 2999
  await cache.revalidate('A', 3000)
  assert.equal(calls, 1)
  now += 1
  await cache.revalidate('A', 3000)
  assert.equal(calls, 2)
  cache.invalidate()
  await cache.revalidate('A', 3000)
  assert.equal(calls, 3)
})
