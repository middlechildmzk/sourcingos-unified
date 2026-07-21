import { describe, expect, it } from 'vitest'
import { resolveLoginCallbackOrigin } from '@/components/LoginForm'

describe('preview authentication callback origin', () => {
  it('keeps Vercel preview login on the current deployment', () => {
    expect(resolveLoginCallbackOrigin(
      'https://sourcingos-preview.vercel.app',
      'sourcingos-preview.vercel.app',
      'https://www.getsourcingos.com'
    )).toBe('https://sourcingos-preview.vercel.app')
  })

  it('uses the configured canonical site in production', () => {
    expect(resolveLoginCallbackOrigin(
      'https://getsourcingos.com',
      'getsourcingos.com',
      'https://www.getsourcingos.com'
    )).toBe('https://www.getsourcingos.com')
  })
})
