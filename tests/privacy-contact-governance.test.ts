import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { contactRequestSchema } from '../lib/contact-request'

const securityTxt = readFileSync(
  fileURLToPath(new URL('../public/.well-known/security.txt', import.meta.url)),
  'utf8',
)
const privacyPage = readFileSync(
  fileURLToPath(new URL('../app/privacy/page.tsx', import.meta.url)),
  'utf8',
)
const contactMigration = readFileSync(
  fileURLToPath(new URL('../supabase/migrations/20260829153000_create_contact_requests.sql', import.meta.url)),
  'utf8',
).toLowerCase()

describe('privacy and security contact governance', () => {
  it('accepts only bounded, supported contact categories', () => {
    expect(contactRequestSchema.safeParse({
      category: 'candidate_data',
      email: 'candidate@example.com',
      message: 'Please review and remove the candidate record associated with this request.',
    }).success).toBe(true)

    expect(contactRequestSchema.safeParse({
      category: 'unsupported',
      email: 'candidate@example.com',
      message: 'This should not be accepted by the contact request schema.',
    }).success).toBe(false)

    expect(contactRequestSchema.safeParse({
      category: 'security',
      email: 'researcher@example.com',
      message: 'x'.repeat(5001),
    }).success).toBe(false)
  })

  it('publishes an RFC 9116-compatible HTTPS contact path without a personal email', () => {
    expect(securityTxt).toContain('Contact: https://www.getsourcingos.com/contact/')
    expect(securityTxt).toContain('Canonical: https://www.getsourcingos.com/.well-known/security.txt')
    expect(securityTxt).toContain('Expires:')
    expect(securityTxt).not.toMatch(/mailto:/i)
  })

  it('keeps contact requests server-only in Supabase', () => {
    expect(contactMigration).toContain('alter table public.contact_requests enable row level security')
    expect(contactMigration).toContain('revoke all on table public.contact_requests from anon, authenticated')
    expect(contactMigration).not.toMatch(/grant\s+(insert|update|delete|all)[^;]*to\s+(anon|authenticated)/)
  })

  it('states the beta retention behavior honestly', () => {
    expect(privacyPage).toContain('retained until the recruiter removes them or a verified candidate-data removal request is completed')
    expect(privacyPage).toContain('does not currently promise an automatic time-based expiry')
    expect(privacyPage).toContain('does not silently merge profiles')
  })
})
