import assert from 'node:assert/strict'
import { test } from 'node:test'
import { LatestSaveQueue } from '../lib/latest-save-queue'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(yes => { resolve = yes })
  return { promise, resolve }
}

test('writes immediately, serializes requests and coalesces waiting edits to the latest value', async () => {
  const gate = deferred()
  const writes: string[] = []
  const queue = new LatestSaveQueue<string>(async value => {
    writes.push(value)
    if (value === 'first') await gate.promise
  })
  const first = queue.enqueue('store:A', 'first')
  assert.deepEqual(writes, ['first'])
  const second = queue.enqueue('store:A', 'second')
  const latest = queue.enqueue('store:A', 'latest')
  assert.deepEqual(writes, ['first'])
  gate.resolve()
  await Promise.all([first, second, latest, queue.waitForIdle()])
  assert.deepEqual(writes, ['first', 'latest'])
})

test('different documents keep their own snapshots and idle waits for all writes', async () => {
  const gate = deferred()
  const writes: string[] = []
  const queue = new LatestSaveQueue<string>(async value => {
    writes.push(value)
    if (value === 'A1') await gate.promise
  })
  const promises = [queue.enqueue('A', 'A1'), queue.enqueue('B', 'B1'), queue.enqueue('A', 'A2')]
  let idle = false
  const drained = queue.waitForIdle().then(() => { idle = true })
  await Promise.resolve()
  assert.equal(idle, false)
  gate.resolve()
  await Promise.all([...promises, drained])
  assert.deepEqual(writes, ['A1', 'B1', 'A2'])
})

test('failed writes are reported and do not prevent a later retry', async () => {
  let attempts = 0
  const queue = new LatestSaveQueue<string>(async () => {
    if (++attempts === 1) throw new Error('offline')
  })
  await assert.rejects(queue.enqueue('A', 'draft'), /offline/)
  await queue.enqueue('A', 'draft')
  await queue.waitForIdle()
  assert.equal(attempts, 2)
})
