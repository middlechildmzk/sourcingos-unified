import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  fileURLToPath(new URL('../sql/candidate-intelligence-spine-v19.sql', import.meta.url)),
  'utf8',
).toLowerCase()

describe('V19 Candidate Intelligence Spine SQL', () => {
  it('enables RLS on every new public table', () => {
    expect(sql).toContain('alter table public.evidence_claims enable row level security')
    expect(sql).toContain('alter table public.evidence_claim_events enable row level security')
    expect(sql).toContain('alter table public.action_approval_requests enable row level security')
  })

  it('removes anonymous and authenticated privileges before applying least privilege', () => {
    expect(sql).toContain('revoke all on public.evidence_claims from anon, authenticated')
    expect(sql).toContain('revoke all on public.evidence_claim_events from anon, authenticated')
    expect(sql).toContain('revoke all on public.action_approval_requests from anon, authenticated')
  })

  it('keeps authenticated clients read-only in the V19 slice', () => {
    expect(sql).toContain('grant select on public.evidence_claims to authenticated')
    expect(sql).toContain('grant select on public.evidence_claim_events to authenticated')
    expect(sql).toContain('grant select on public.action_approval_requests to authenticated')
    expect(sql).not.toMatch(/grant\s+[^;]*(insert|update|delete)[^;]*to\s+authenticated/)
    expect(sql).not.toMatch(/for\s+(insert|update|delete)\s+to\s+authenticated/)
  })

  it('requires owner-scoped select policies', () => {
    expect(sql.match(/using \(\(select auth\.uid\(\)\) = owner_id\)/g)).toHaveLength(3)
  })
})
