// Global test setup: ensure a clean, UNCONFIGURED environment by default so
// fail-closed behavior is the baseline every test starts from.
import { beforeEach } from 'vitest'

const VOLATILE = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ALLOW_PREVIEW_BYPASS',
  'RATE_LIMIT_DISABLED',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'ANTHROPIC_API_KEY',
  'AI_PROVIDER_API_KEY',
  'CRON_SECRET',
]

beforeEach(() => {
  for (const k of VOLATILE) delete process.env[k]
})
