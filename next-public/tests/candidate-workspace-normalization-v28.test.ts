import { describe, expect, it } from 'vitest'
import {
  EMPTY_CANDIDATE_WORKSPACE_SNAPSHOT,
  normalizeCandidateWorkspaceSnapshot,
} from '../lib/candidate-workspace-normalization'

describe('V28 Candidate Database response normalization', () => {
  it('returns a complete safe snapshot for missing or invalid payloads', () => {
    expect(normalizeCandidateWorkspaceSnapshot(null)).toEqual(EMPTY_CANDIDATE_WORKSPACE_SNAPSHOT)
    expect(normalizeCandidateWorkspaceSnapshot('not-an-object')).toEqual(EMPTY_CANDIDATE_WORKSPACE_SNAPSHOT)
  })

  it('normalizes nullable candidate arrays before the render path uses them', () => {
    const snapshot = normalizeCandidateWorkspaceSnapshot({
      ok: true,
      persistence_mode: 'supabase',
      candidates: [{
        id: 'candidate-1',
        canonical_name: 'Ada Lovelace',
        current_company: 'Analytical Engines',
        skills: null,
        source_profile_ids: null,
        evidence_item_ids: undefined,
        contact_signal_ids: 'not-an-array',
        open_to_work_signal_ids: [null, 'signal-1', 'signal-1'],
        merge_status: null,
      }],
      counts: null,
      page: null,
    })

    expect(snapshot.persistence_mode).toBe('supabase')
    expect(snapshot.candidates).toHaveLength(1)
    expect(snapshot.candidates[0]).toMatchObject({
      id: 'candidate-1',
      canonicalName: 'Ada Lovelace',
      currentCompany: 'Analytical Engines',
      skills: [],
      sourceProfileIds: [],
      evidenceItemIds: [],
      contactSignalIds: [],
      openToWorkSignalIds: ['signal-1'],
      mergeStatus: 'pending',
    })
    expect(snapshot.counts.candidates).toBe(1)
    expect(snapshot.counts.filteredCandidates).toBe(1)
    expect(snapshot.page).toEqual({ limit: 50, offset: 0, hasMore: false })
  })

  it('drops malformed related rows and normalizes match reviews and import batches', () => {
    const snapshot = normalizeCandidateWorkspaceSnapshot({
      sourceProfiles: [null, { id: 'sp-1', source: 'github' }, { source: 'missing-id' }],
      evidenceItems: [{ id: 'ev-1' }, 'bad'],
      contactSignals: [{ id: 'contact-1' }],
      openToWorkSignals: [{ id: 'otw-1' }],
      matchReviews: [{
        id: 'review-1',
        proposed_canonical_name: 'Potential match',
        match_score: 140,
        match_reasons: ['same email', null, 'same email'],
        conflicts: null,
      }],
      importBatches: [{
        id: 'batch-1',
        import_type: 'csv',
        rows_seen: '12',
        records_created: -4,
        warnings: ['one warning'],
      }],
      counts: { pendingMatchReviews: 'bad-number' },
      page: { limit: 999, offset: -3, hasMore: 'yes' },
    })

    expect(snapshot.sourceProfiles.map(row => row.id)).toEqual(['sp-1'])
    expect(snapshot.evidenceItems.map(row => row.id)).toEqual(['ev-1'])
    expect(snapshot.matchReviews[0]).toMatchObject({
      id: 'review-1',
      proposedCanonicalName: 'Potential match',
      score: 100,
      reasons: ['same email'],
      conflicts: [],
      decision: 'pending',
    })
    expect(snapshot.counts.pendingMatchReviews).toBe(1)
    expect(snapshot.importBatches[0]).toMatchObject({ rowsSeen: 12, recordsCreated: 0, warnings: ['one warning'] })
    expect(snapshot.page).toEqual({ limit: 200, offset: 0, hasMore: false })
  })
})
