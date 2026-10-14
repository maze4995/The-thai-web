import { expect, test, type Page, type WebSocketRoute } from '@playwright/test'

const DATE = '2026-10-13'
const PREVIOUS = '2026-10-12'
const NEXT = '2026-10-14'
const storeId = '11111111-1111-1111-1111-111111111111'
const userId = '22222222-2222-2222-2222-222222222222'

async function fixture(page: Page) {
  const reads = new Map<string, number>()
  const delays = new Map<string, number>()
  const failed = new Set<string>()
  const savedSlots = new Map<string, Record<string, unknown>>()
  const insertedSlots = new Map<string, Record<string, unknown>[]>()
  let socket: WebSocketRoute | undefined
  let topic = ''
  let filters: { id: number; table: string }[] = []
  await page.clock.setFixedTime(new Date('2026-10-13T12:00:00+09:00'))
  const exp = Math.floor(Date.now() / 1000) + 86400 * 365
  const accessToken = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify({ sub: userId, exp, aud: 'authenticated', role: 'authenticated' })).toString('base64url'), 'test-signature'].join('.')
  const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'test@example.invalid',
    app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
  const session = { access_token: accessToken, refresh_token: 'local-test-only', expires_at: exp,
    expires_in: 3600, token_type: 'bearer', user }
  await page.context().addCookies([{
    name: 'sb-127-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'),
    domain: '127.0.0.1', path: '/',
  }])
  await page.routeWebSocket('ws://127.0.0.1:54321/**', ws => {
    socket = ws
    ws.onMessage(raw => {
      const [joinRef, ref, messageTopic, event, payload] = JSON.parse(String(raw))
      const message = { topic: messageTopic, event, payload, ref }
      if (message.event === 'phx_join') {
        topic = message.topic
        filters = (message.payload.config.postgres_changes ?? []).map((row: { table: string }, id: number) => ({ ...row, id: id + 1 }))
        ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: { postgres_changes: filters } }]))
      } else if (message.event === 'heartbeat') {
        ws.send(JSON.stringify([joinRef, ref, message.topic, 'phx_reply', { status: 'ok', response: {} }]))
      }
    })
  })
  await page.route('http://127.0.0.1:54321/**', async route => {
    const url = new URL(route.request().url())
    const table = url.pathname.split('/').pop()!
    const date = url.searchParams.get('work_date')?.replace('eq.', '') ?? DATE
    const key = table + ':' + date
    if (route.request().method() === 'PATCH' && table === 'schedule_slots') {
      const payload = route.request().postDataJSON()
      savedSlots.set(payload.work_date, payload)
      await route.fulfill({ status: 204 })
      return
    }
    reads.set(key, (reads.get(key) ?? 0) + 1)
    if (delays.get(date)) await new Promise(resolve => setTimeout(resolve, delays.get(date)))
    if (failed.has(date) && table === 'schedule_slots') {
      await route.fulfill({ status: 503, json: { message: 'test offline' } })
      return
    }
    const names: Record<string, string> = { [DATE]: '현재고객', [PREVIOUS]: '이전고객', [NEXT]: '다음고객' }
    const data: Record<string, unknown> = {
      store_members: [{ store_id: storeId, stores: { name: '테스트매장' } }],
      store_settings: [],
      store_features: [],
      therapists: [{ id: 'staff-one', store_id: storeId, name: '테스트관리사', is_active: true, display_order: 0 }],
      daily_attendance: [{ id: 'attendance-' + date, store_id: storeId, therapist_id: 'staff-one', work_date: date, is_present: true, display_order: 0 }],
      daily_settings: [{ manager: '담당-' + date }],
      schedule_slots: [{ id: 'slot-' + date, store_id: storeId, therapist_id: 'staff-one', therapist_name: '테스트관리사',
        work_date: date, reservation_id: null, room_number: 1, slot_order: 1, customer_name: names[date] ?? '기타고객',
        customer_phone: '01000000000', reserved_time: '12:00', check_in_time: null, check_out_time: null,
        service_name: 'T60', service_price: 40000, payment_type: 'cash', memo: '', ...savedSlots.get(date) }, ...(insertedSlots.get(date) ?? [])],
      reservations: [], service_catalog: [], service_prices: [], lookup_items: [],
    }
    await route.fulfill({ json: data[table] ?? [] })
  })
  await page.goto('/')
  await expect(page.getByText('현재고객', { exact: true })).toBeVisible({ timeout: 30_000 })
  await expect.poll(() => filters.length).toBe(4)
  // Allow the initial subscribe/fetch reconciliation to settle.
  await page.waitForTimeout(400)
  const emit = (record: Record<string, unknown> = { id: 'slot-' + DATE, store_id: storeId, work_date: DATE }, eventType = 'UPDATE') => {
    const filter = filters.find(row => row.table === 'schedule_slots')
    if (!socket || !filter) throw new Error('Realtime subscription not ready')
    socket.send(JSON.stringify([null, null, topic, 'postgres_changes', {
      ids: [filter.id], data: { schema: 'public', table: 'schedule_slots', type: eventType,
        commit_timestamp: new Date().toISOString(), record,
        old_record: {}, errors: [], columns: [] },
    }]))
  }
  return {
    reads, delays, failed, session, emit,
    insertReservation(date = DATE) {
      const row = { id: 'app-slot-' + date, store_id: storeId, therapist_id: 'staff-one', therapist_name: '테스트관리사',
        work_date: date, reservation_id: 'app-reservation', room_number: 1, slot_order: 2,
        customer_name: '신규예약', customer_phone: '01000000000', reserved_time: '13:00',
        check_in_time: null, check_out_time: null, service_name: 'T60', service_price: 40000,
        payment_type: 'cash', memo: '' }
      insertedSlots.set(date, [row])
      emit(row, 'INSERT')
    },
  }
}

test('cached date revisits are immediate and do not repeat day queries', async ({ page }) => {
  const state = await fixture(page)
  state.delays.set(PREVIOUS, 700)
  await page.locator('input[type=date]').fill(PREVIOUS)
  await expect(page.getByText('조판지를 불러오는 중입니다...')).toBeVisible()
  await expect(page.getByText('현재고객', { exact: true })).toHaveCount(0)
  await expect(page.getByText('이전고객', { exact: true })).toBeVisible()
  const before = state.reads.get('schedule_slots:' + DATE)
  state.delays.set(DATE, 700)
  const started = Date.now()
  await page.locator('input[type=date]').fill(DATE)
  await expect(page.getByText('현재고객', { exact: true })).toBeVisible({ timeout: 450 })
  const elapsed = Date.now() - started
  expect(state.reads.get('schedule_slots:' + DATE)).toBe(before)
  console.log('Cached navigation:', JSON.stringify({ simulatedNetworkMs: 700, elapsedMs: elapsed, extraSlotQueries: 0 }))
  await page.screenshot({ path: test.info().outputPath('schedule-board.png') })
  await test.info().attach('cached-navigation', { body: JSON.stringify({ simulatedNetworkMs: 700, elapsedMs: elapsed, extraSlotQueries: 0 }), contentType: 'application/json' })
})

test('rapid date changes cannot display an older response or manager', async ({ page }) => {
  const state = await fixture(page)
  state.delays.set(PREVIOUS, 900)
  await page.locator('input[type=date]').fill(PREVIOUS)
  await expect.poll(() => state.reads.get('schedule_slots:' + PREVIOUS) ?? 0).toBeGreaterThan(0)
  await page.locator('input[type=date]').fill(NEXT)
  await expect(page.getByText('다음고객', { exact: true })).toBeVisible()
  await page.waitForTimeout(1000)
  await expect(page.getByText('다음고객', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '담당-' + NEXT, exact: true })).toBeVisible()
  await expect(page.getByText('이전고객', { exact: true })).toHaveCount(0)
})

test('errors are not mistaken for empty attendance and retry recovers', async ({ page }) => {
  const state = await fixture(page)
  state.failed.add(PREVIOUS)
  await page.locator('input[type=date]').fill(PREVIOUS)
  await expect(page.getByRole('alert').filter({ hasText: '조판지를 불러오지 못했습니다' })).toContainText('불러오지 못했습니다')
  await expect(page.getByText(/출근한 .*이 없습니다/)).toHaveCount(0)
  state.failed.delete(PREVIOUS)
  await page.getByRole('button', { name: '다시 시도' }).click()
  await expect(page.getByText('이전고객', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: '조판지를 불러오지 못했습니다' })).toHaveCount(0)
})

test('closing an unchanged slot does not reload the board', async ({ page }) => {
  const state = await fixture(page)
  const before = state.reads.get('schedule_slots:' + DATE)
  await page.getByText('현재고객', { exact: true }).click()
  await page.getByRole('button', { name: '취소', exact: true }).click()
  await page.waitForTimeout(300)
  expect(state.reads.get('schedule_slots:' + DATE)).toBe(before)
})

test('realtime bursts coalesce and invalidate cached dates', async ({ page }) => {
  const state = await fixture(page)
  await page.locator('input[type=date]').fill(PREVIOUS)
  await expect(page.getByText('이전고객', { exact: true })).toBeVisible()
  const before = state.reads.get('schedule_slots:' + PREVIOUS) ?? 0
  for (let i = 0; i < 10; i++) state.emit()
  await expect.poll(() => state.reads.get('schedule_slots:' + PREVIOUS) ?? 0).toBe(before + 1)
  await page.waitForTimeout(300)
  expect(state.reads.get('schedule_slots:' + PREVIOUS)).toBe(before + 1)
  const todayReads = state.reads.get('schedule_slots:' + DATE) ?? 0
  await page.locator('input[type=date]').fill(DATE)
  await expect.poll(() => state.reads.get('schedule_slots:' + DATE) ?? 0).toBe(todayReads + 1)
})

test('same-user sign-in events do not unmount or reset the selected date', async ({ page }) => {
  const state = await fixture(page)
  await page.locator('input[type=date]').fill(PREVIOUS)
  await expect(page.getByText('이전고객', { exact: true })).toBeVisible()
  const before = state.reads.get('store_members:' + DATE)
  await page.evaluate(session => {
    const channel = new BroadcastChannel('sb-127-auth-token')
    channel.postMessage({ event: 'SIGNED_IN', session })
    channel.close()
  }, state.session)
  await page.waitForTimeout(300)
  await expect(page.locator('input[type=date]')).toHaveValue(PREVIOUS)
  await expect(page.getByText('이전고객', { exact: true })).toBeVisible()
  expect(state.reads.get('store_members:' + DATE)).toBe(before)
})

test('saving a slot refreshes its day even without a realtime event', async ({ page }) => {
  await fixture(page)
  await page.getByText('현재고객', { exact: true }).click()
  await page.locator('input[value="현재고객"]').fill('수정고객')
  await page.getByRole('button', { name: '수정', exact: true }).click()
  await expect(page.getByText('수정고객', { exact: true })).toBeVisible()
  await expect(page.getByText('현재고객', { exact: true })).toHaveCount(0)
})


test('a committed app reservation displays before slow background rereads finish', async ({ page }) => {
  const state = await fixture(page)
  state.delays.set(DATE, 2000)
  const before = state.reads.get('schedule_slots:' + DATE) ?? 0
  const started = performance.now()
  state.insertReservation()
  await expect(page.getByText('신규예약', { exact: true })).toBeVisible({ timeout: 600 })
  console.log('Realtime insert:', JSON.stringify({ backgroundReadDelayMs: 2000, eventToVisibleMs: Math.round(performance.now() - started) }))
  await expect.poll(() => state.reads.get('schedule_slots:' + DATE) ?? 0).toBe(before + 1)
  await page.waitForTimeout(2200)
  await expect(page.getByText('신규예약', { exact: true })).toHaveCount(1)
  expect(state.reads.get('schedule_slots:' + DATE)).toBe(before + 1)
})

test('an app reservation updates its cached date without appearing on a different day', async ({ page }) => {
  const state = await fixture(page)
  await page.locator('input[type=date]').fill(PREVIOUS)
  await expect(page.getByText('이전고객', { exact: true })).toBeVisible()
  state.delays.set(DATE, 2000)
  state.insertReservation()
  await page.waitForTimeout(250)
  await expect(page.getByText('신규예약', { exact: true })).toHaveCount(0)
  await page.locator('input[type=date]').fill(DATE)
  await expect(page.getByText('신규예약', { exact: true })).toBeVisible({ timeout: 600 })
})
