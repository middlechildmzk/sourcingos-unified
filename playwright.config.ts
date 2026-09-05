import { defineConfig } from '@playwright/test'

// Smoke suite. Run against a local server (default) or a deployment:
//   npx playwright test
//   PLAYWRIGHT_BASE_URL=https://sourcingos-unified.vercel.app npx playwright test
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
