import { describe, expect, it } from 'vitest'
import { buildPearchSearchBodyV36_8 } from '@/lib/candidate-data/providers/pearch-v36-8'
import { buildDataVertexSearchBodyV36_8 } from '@/lib/candidate-data/providers/data-vertex-v36-8'
import { buildContactOutSearchBodyV36_8 } from '@/lib/candidate-data/providers/contactout-v36-8'
import { runCandidateDataSearchV36_8 } from '@/lib/candidate-data/orchestrator-v36-8'
import { buildDataVertexLookupBodyV36_8, canUseDataVertexLookupV36_8 } from '@/lib/contact-enrichment/providers/data-vertex-v36-8'
import type { CandidateDataSearchAdapterV36_8 } from '@/lib/candidate-data/types-v36-8'

const request = {
  query: 'RHEL administrator with 5+ years Linux near Annapolis Junction, MD with Secret or higher',
  requirements: [
    { text: 'RHEL administration', mustHave: true },
    { text: '5+ years Linux experience', mustHave: true },
    { text: 'Secret clearance or higher — verification required', mustHave: true },
  ],
  titles: ['RHEL Administrator', 'Linux Administrator'],
  skills: ['RHEL', 'Red Hat Enterprise Linux', 'Linux'],
  locations: ['Annapolis Junction, MD', 'Washington, DC'],
  limit: 20,
}

describe('V36.8 Candidate Data Fabric', () => {
  it('uses Pearch official structured requirement keys with contact reveal off', () => {
    const body = buildPearchSearchBodyV36_8(request)
    expect(body).toMatchObject({ type: 'fast', insights: false, profile_scoring: true, reveal_emails: false, reveal_phones: false, high_freshness: false, custom_filters_mode: 'exact' })
    expect(body.search_requirements).toEqual([
      { search_requirement: 'RHEL administration', must_have: true },
      { search_requirement: '5+ years Linux experience', must_have: true },
      { search_requirement: 'Secret clearance or higher — verification required', must_have: true },
    ])
    expect(body).not.toHaveProperty('query')
  })

  it('does not allow DataVertex to silently expand recruiter titles', () => {
    const body = buildDataVertexSearchBodyV36_8(request)
    expect(body.include_similar_titles).toBe(false)
    expect(body.free_text_search.length).toBeLessThanOrEqual(300)
    expect(body.search_criteria).toEqual({ location: ['Annapolis Junction, MD', 'Washington, DC'] })
  })

  it('uses ContactOut structured Role Brain filters without contact or related-title reveal', () => {
    const body = buildContactOutSearchBodyV36_8(request)
    expect(body).toMatchObject({
      page: 1,
      page_size: 20,
      current_titles_only: true,
      include_related_job_titles: false,
      reveal_info: false,
      job_title: ['RHEL Administrator', 'Linux Administrator'],
      skills: ['RHEL', 'Red Hat Enterprise Linux', 'Linux'],
      location: ['Annapolis Junction, MD', 'Washington, DC'],
    })
    expect(body).not.toHaveProperty('keyword')
  })

  it('interleaves providers before the global result cap', async () => {
    const adapters: CandidateDataSearchAdapterV36_8[] = [
      {
        provider: 'pearch',
        search: async () => ({ observations: [1, 2, 3].map(index => ({ provider: 'pearch' as const, providerPersonId: `p${index}`, displayName: `P ${index}`, skills: [], profileUrls: [], contactAvailability: { email: 'unknown' as const, phone: 'unknown' as const }, observedAt: '2026-09-02T20:00:00.000Z' })), telemetry: { provider: 'pearch', status: 'completed', discovered: 3, latencyMs: 1 }, warnings: [] }),
      },
      {
        provider: 'data_vertex',
        search: async () => ({ observations: [1, 2, 3].map(index => ({ provider: 'data_vertex' as const, providerPersonId: `d${index}`, displayName: `D ${index}`, skills: [], profileUrls: [], contactAvailability: { email: 'unknown' as const, phone: 'unknown' as const }, observedAt: '2026-09-02T20:00:00.000Z' })), telemetry: { provider: 'data_vertex', status: 'completed', discovered: 3, latencyMs: 1 }, warnings: [] }),
      },
    ]
    const result = await runCandidateDataSearchV36_8(request, adapters, 4)
    expect(result.observations.map(item => `${item.provider}:${item.providerPersonId}`)).toEqual(['pearch:p1', 'data_vertex:d1', 'pearch:p2', 'data_vertex:d2'])
    expect(result.providerMix).toEqual({ pearch: 3, data_vertex: 3 })
  })

  it('requires a deterministic DataVertex lookup anchor and keeps enrichment explicit', () => {
    expect(canUseDataVertexLookupV36_8({ fullName: 'Jane Doe', currentCompany: 'Acme' })).toBe(false)
    expect(canUseDataVertexLookupV36_8({ linkedinUrl: 'https://www.linkedin.com/in/jane-doe' })).toBe(true)
    expect(buildDataVertexLookupBodyV36_8({ providerName: 'data_vertex', providerPersonId: '12345' }, 'work_email_finder')).toEqual({ candidate_id: '12345', reveal_personal_email: true, reveal_phone: false, reveal_detailed_person_enrichment: false, reveal_healthcare_enrichment: false })
  })
})
