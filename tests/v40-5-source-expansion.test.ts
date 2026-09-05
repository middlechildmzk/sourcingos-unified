import { describe, expect, it } from 'vitest'
import { SOURCE_EXPANSION_TARGETS_V40_5, V40_5_FIRST_ENRICHMENT_COHORT, V40_5_HARD_PROHIBITIONS } from '@/lib/fleet/source-expansion-v40-5'

describe('V40.5 governed source expansion', () => {
  it('prioritizes official/public API and indexed-document sources', () => {
    const byKey = new Map(SOURCE_EXPANSION_TARGETS_V40_5.map(source => [source.key, source]))
    expect(byKey.get('gitlab')?.access).toBe('official_public_api')
    expect(byKey.get('hackernews')?.access).toBe('official_public_api')
    expect(byKey.get('huggingface')?.access).toBe('official_public_api')
    expect(byKey.get('public_drive')?.access).toBe('public_index_or_document')
    expect(byKey.get('github_pages')?.access).toBe('public_index_or_document')
  })

  it('keeps restricted/uncertain hosts out of unattended deep retrieval', () => {
    const byKey = new Map(SOURCE_EXPANSION_TARGETS_V40_5.map(source => [source.key, source]))
    expect(byKey.get('scribd')?.access).toBe('metadata_only')
    expect(byKey.get('researchgate')?.access).toBe('metadata_only')
    expect(byKey.get('academia')?.access).toBe('metadata_only')
    expect(byKey.get('wellfound')?.access).toBe('partner_or_terms_review')
  })

  it('keeps bulk corpora in a separate batch tier', () => {
    for (const key of ['commoncrawl','gharchive','stackexchange_dump']) {
      expect(SOURCE_EXPANSION_TARGETS_V40_5.find(source => source.key === key)?.access).toBe('batch_public_corpus')
    }
  })

  it('explicitly forbids evasion and unattended contact harvesting', () => {
    const policy = V40_5_HARD_PROHIBITIONS.join(' ').toLowerCase()
    expect(policy).toContain('authentication bypass')
    expect(policy).toContain('cloudflare evasion')
    expect(policy).toContain('residential proxy evasion')
    expect(policy).toContain('drive identifier guessing')
    expect(policy).toContain('unattended contact-value harvesting')
  })

  it('uses recruiter-uploaded LinkedIn connections only as enrichment seeds', () => {
    expect(V40_5_FIRST_ENRICHMENT_COHORT.source).toBe('recruiter_uploaded_linkedin_connections')
    expect(V40_5_FIRST_ENRICHMENT_COHORT.policy.toLowerCase()).toContain('never use it to authorize linkedin scraping')
  })
})
