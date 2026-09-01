import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const loginForm = readFileSync(join(here, '../components/LoginForm.tsx'), 'utf8')
const loginPage = readFileSync(join(here, '../app/login/page.tsx'), 'utf8')
const bootstrapRoute = readFileSync(join(here, '../app/api/auth/bootstrap-password/route.ts'), 'utf8')
const bootstrapMigration = readFileSync(join(here, '../supabase/migrations/20260901163000_auth_password_bootstrap_tokens.sql'), 'utf8')

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
    expect(loginForm).not.toContain('sb.auth.signUp')
    expect(loginForm).toContain('Use sign-in link')
  })

  it('bootstraps passwords only through a single-use server-side beta token', () => {
    expect(loginForm).toContain("fetch('/api/auth/bootstrap-password'")
    expect(bootstrapRoute).toContain('createServerSupabaseClient')
    expect(bootstrapRoute).toContain('sb.auth.admin.getUserById')
    expect(bootstrapRoute).toContain('sb.auth.admin.updateUserById')
    expect(bootstrapRoute).toContain('user.app_metadata?.beta_access !== true')
    expect(bootstrapRoute).toContain(".is('used_at', null)")
    expect(bootstrapMigration).toContain('enable row level security')
    expect(bootstrapMigration).toContain('revoke all on table public.auth_password_bootstrap_tokens from anon, authenticated')
  })
})
