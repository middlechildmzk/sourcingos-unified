// e2e/smoke.spec.ts — public-surface smoke suite (Security & Proof sprint).
import { test, expect, type Page } from '@playwright/test'

const pagesToCheck = ['/', '/tools/', '/sample-candidate-360/', '/jobs/', '/waitlist/']

async function collectConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = []
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  page.on('pageerror', err => errors.push(String(err)))
  return errors
}

test('1. homepage loads with hero and sample-360 CTA', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toContainText('Find who your')
  await expect(page.locator('a[href*="sample-candidate-360"]').first()).toBeVisible()
})

test('2. public tools shell loads', async ({ page }) => {
  await page.goto('/tools/')
  await expect(page.locator('a[href*="boolean-generator"]').first()).toBeVisible()
})

test('3. sample Candidate 360 loads with demo disclaimer and trust language', async ({ page }) => {
  await page.goto('/sample-candidate-360/')
  await expect(page.locator('body')).toContainText('Synthetic demo data')
  await expect(page.locator('body')).toContainText('No silent merges')
  await expect(page.locator('table')).toBeVisible() // evidence ledger
})

test('4. auth-gated /app route redirects or blocks (never renders workbench anonymously)', async ({ page }) => {
  const resp = await page.goto('/app/candidate-search/')
  // Acceptable outcomes: redirect to /login, or an explicit preview banner —
  // but ONLY when the deployment opted in. Production must land on /login.
  const url = page.url()
  const previewOptIn = await page.locator('text=Preview mode').count()
  expect(url.includes('/login') || previewOptIn > 0 || (resp && resp.status() >= 400)).toBeTruthy()
})

test('5. jobs page loads with no fake apply links', async ({ page }) => {
  await page.goto('/jobs/')
  await expect(page.locator('body')).toContainText('No fake apply links')
  // Any rendered job link must be external or a category page — never '#'
  const hrefs = await page.locator('.job-list a').evaluateAll(as => as.map(a => a.getAttribute('href')))
  for (const h of hrefs) expect(h && h !== '#').toBeTruthy()
})

test('6. waitlist form basic path', async ({ page }) => {
  await page.goto('/waitlist/')
  const email = page.locator('input[type="email"]').first()
  await expect(email).toBeVisible()
  await email.fill(`smoke-${Date.now()}@example.com`)
  const submit = page.locator('button[type="submit"], button:has-text("Request")').first()
  await submit.click()
  // Success or rate-limit are both acceptable outcomes; a crash is not.
  await expect(page.locator('body')).not.toContainText('Application error')
})

test('7. no console errors on critical public pages', async ({ page }) => {
  for (const path of pagesToCheck) {
    const errors = await collectConsoleErrors(page)
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    expect(errors, `console errors on ${path}: ${errors.join(' | ')}`).toHaveLength(0)
  }
})
