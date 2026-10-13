import { expect, test, type Page } from '@playwright/test'

async function fixture(page: Page) {
  const userId = '22222222-2222-2222-2222-222222222222'
  const storeId = '11111111-1111-1111-1111-111111111111'
  const exp = Math.floor(Date.now() / 1000) + 86400 * 365
  const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'test@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
  const accessToken = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: userId, exp, aud: 'authenticated', role: 'authenticated' })).toString('base64url'), 'test-signature'].join('.')
  const session = { access_token: accessToken, refresh_token: 'local-test-only', expires_at: exp, expires_in: 3600, token_type: 'bearer', user }
  await page.context().addCookies([{ name: 'sb-127-auth-token', value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'), domain: '127.0.0.1', path: '/' }])
  type Payload = { log_date: string; hygiene: string; program_feedback: string; store_id: string }
  const state = { writes: [] as Payload[], saved: new Map<string, Payload>(), hold: undefined as Promise<void> | undefined, failNext: false }
  await page.route('http://127.0.0.1:54321/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const table = url.pathname.split('/').pop()
    if (table === 'work_logs') {
      if (request.method() === 'POST') {
        const body = request.postDataJSON() as Payload
        state.writes.push(body)
        const hold = state.hold
        state.hold = undefined
        if (hold) await hold
        if (state.failNext) {
          state.failNext = false
          await route.fulfill({ status: 503, json: { message: 'offline' } })
          return
        }
        state.saved.set(body.log_date, body)
        await route.fulfill({ status: 201, body: '' })
      } else if (request.method() === 'DELETE') {
        state.saved.clear()
        await route.fulfill({ status: 204, headers: { 'content-range': '*/1' } })
      } else {
        const date = url.searchParams.get('log_date')?.replace('eq.', '') ?? ''
        await route.fulfill({ json: state.saved.get(date) ?? null })
      }
      return
    }
    const responses: Record<string, unknown> = {
      store_members: [{ store_id: storeId, stores: { name: '테스트매장' } }],
      store_settings: null, store_features: { worklog_enabled: true },
    }
    await route.fulfill({ json: responses[table ?? ''] ?? null })
  })
  await page.goto('/worklog')
  await expect(page.getByPlaceholder('청소, 정리, 소모품 상태 등을 기록하세요.')).toBeVisible()
  expect(state.writes).toHaveLength(0)
  return state
}

test('input starts saving immediately and slow writes keep only the latest waiting draft', async ({ page }) => {
  const state = await fixture(page)
  let release!: () => void
  state.hold = new Promise<void>(resolve => { release = resolve })
  const field = page.getByPlaceholder('청소, 정리, 소모품 상태 등을 기록하세요.')
  await field.fill('첫 입력')
  await expect.poll(() => state.writes.length, { timeout: 1500 }).toBe(1)
  await expect(page.getByRole('status')).toHaveText('자동저장 중...')
  await field.fill('두 번째 입력')
  await field.fill('최종 입력')
  expect(state.writes).toHaveLength(1)
  release()
  await expect(page.getByRole('status')).toHaveText('자동저장됨')
  expect(state.writes.map(row => row.hygiene)).toEqual(['첫 입력', '최종 입력'])
  await page.reload()
  await expect(field).toHaveValue('최종 입력')
  expect(state.writes).toHaveLength(2)
})

test('failed autosave keeps input and manual retry includes program feedback', async ({ page }) => {
  const state = await fixture(page)
  state.failNext = true
  const field = page.getByPlaceholder('프로그램 사용 중 불편한 점, 개선 요청, 버그 등을 자유롭게 작성해주세요.')
  await field.fill('건의사항 보존')
  await expect(page.getByRole('alert').filter({ hasText: '자동저장에 실패' })).toBeVisible()
  await expect(field).toHaveValue('건의사항 보존')
  await expect(page.getByRole('status')).not.toHaveText('자동저장됨')
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('자동저장됨')
  expect(state.writes).toHaveLength(2)
  expect(state.writes[1].program_feedback).toBe('건의사항 보존')
})

test('switching dates during a write never saves the old content under the new date', async ({ page }) => {
  const state = await fixture(page)
  const date = page.locator('input[type=date]')
  const original = await date.inputValue()
  let release!: () => void
  state.hold = new Promise<void>(resolve => { release = resolve })
  const field = page.getByPlaceholder('청소, 정리, 소모품 상태 등을 기록하세요.')
  await field.fill('원래 날짜 내용')
  await expect.poll(() => state.writes.length).toBe(1)
  await date.fill('2026-01-02')
  await expect(page.getByText('불러오는 중...', { exact: true })).toBeVisible()
  release()
  await expect(field).toHaveValue('')
  expect(state.writes).toHaveLength(1)
  expect(state.writes[0].log_date).toBe(original)
  await date.fill(original)
  await expect(field).toHaveValue('원래 날짜 내용')
  expect(state.writes).toHaveLength(1)
})
