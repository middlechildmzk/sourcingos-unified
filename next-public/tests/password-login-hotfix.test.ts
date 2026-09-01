import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const loginForm = readFileSync(join(here, '../components/LoginForm.tsx'), 'utf8')
const loginPage = readFileSync(join(here, '../app/login/page.tsx'), 'utf8')

describe('password-first beta login hotfix', () => {
  it('uses password sign-in as the primary login path', () => {
    expect(loginForm).toContain("useState<LoginMode>('password')")
    expect(loginForm).toContain('sb.auth.signInWithPassword')
    expect(loginForm).toContain("window.location.assign(from || '/app/roles')")
    expect(loginPage).toContain('email and password attached to your approved beta account')
  })

  it('keeps magic link as a fallback without creating new users', () => {
    expect(loginForm).toContain('sb.auth.signInWithOtp')
    expect(loginForm).toContain('shouldCreateUser: false')
    expect(loginForm).toContain('Use a sign-in link instead')
  })
})
