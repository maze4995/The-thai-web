import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  use: {
    baseURL: 'http://127.0.0.1:3317',
    browserName: 'chromium',
    channel: 'msedge',
    headless: true,
    timezoneId: 'Asia/Seoul',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `"${process.execPath}" node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3317`,
    url: 'http://127.0.0.1:3317/login',
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-test-only',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
})
