import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { classifyProviderHealthV38 } from '../lib/search-quality/provider-health-v38'
import type { CandidateDataProviderTelemetryV36_8 } from '../lib/candidate-data/types-v36-8'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

function failed(message: string): CandidateDataProviderTelemetryV36_8 {
  return { provider: 'signalhire', status: 'failed', discovered: 0, latencyMs: 10, message }
}

describe('V38 provider-health edge cases', () => {
  it('classifies HTTP 402/payment-required failures as credit or billing exhaustion, not generic provider failure', () => {
    expect(classifyProviderHealthV38(failed('HTTP 402 Payment Required'))).toBe('CREDITS_EXHAUSTED')
  })

  it('keeps a bare 403 conservative instead of inventing entitlement truth', () => {
    expect(classifyProviderHealthV38(failed('HTTP 403 Forbidden'))).toBe('AUTH_FAILURE')
    expect(classifyProviderHealthV38(failed('HTTP 403 — plan entitlement required'))).toBe('NOT_ENTITLED')
  })

  it('classifies protected Preview access explicitly when runtime validation is blocked', () => {
    expect(classifyProviderHealthV38(failed('Preview access blocked by Vercel SSO protection'))).toBe('PREVIEW_ACCESS_BLOCKED')
  })
})

describe('V38 Search Health product contract', () => {
  it('keeps Search Health progressive disclosure inside canonical People Search', () => {
    const workspace = source('components/SearchWorkspaceV37.tsx')
    expect(workspace).toContain("payload.searchQuality")
    expect(workspace).toContain("<SearchHealthV38 quality={result.searchHealth} />")
  })

  it('labels provider inspection as normalized execution context rather than exact vendor payload', () => {
    const health = source('components/SearchHealthV38.tsx')
    expect(health).toContain('Inspect sanitized provider execution context')
    expect(health).toContain('not a claim that every vendor received every field verbatim')
    expect(health).toContain('It is not candidate qualification')
  })

  it('keeps the internal quality view admin-only and non-indexed', () => {
    const admin = source('app/admin/search-quality/page.tsx')
    expect(admin).toContain("session.user.role !== 'admin'")
    expect(admin).toContain("robots: { index: false, follow: false }")
    expect(admin).toContain('SEARCH_BENCHMARK_CORPUS_V38')
  })
})
