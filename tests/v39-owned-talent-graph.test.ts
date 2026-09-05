import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260904121000_owned_talent_graph_v39.sql'), 'utf8')
const route = fs.readFileSync(path.join(root, 'app/api/candidate-db/hybrid-search/route.ts'), 'utf8')

describe('V39 Owned Talent Graph + hybrid search contract', () => {
  it('adds explicit source rights and retention metadata without deleting provenance', () => {
    expect(migration).toContain('acquisition_basis text')
    expect(migration).toContain('usage_scope text[]')
    expect(migration).toContain('search_allowed boolean')
    expect(migration).toContain('raw_export_allowed boolean')
    expect(migration).toContain('retention_until timestamptz')
    expect(migration).toContain('rights_metadata jsonb')
    expect(migration).toContain("search_allowed\n        and (sp.retention_until is null or sp.retention_until > now())")
  })

  it('builds a durable GIN-backed lexical index over canonical people and attached evidence', () => {
    expect(migration).toContain('candidate_search_documents_v39')
    expect(migration).toContain('using gin(document)')
    expect(migration).toContain("setweight(to_tsvector('simple'")
    expect(migration).toContain('search_owned_talent_v39')
    expect(migration).toContain('websearch_to_tsquery')
  })

  it('keeps contact values out of general hybrid retrieval', () => {
    const refreshBody = migration.split('create or replace function public.refresh_candidate_search_document_v39')[1]
      ?.split('create or replace function public.candidate_search_refresh_trigger_v39')[0] || ''
    expect(refreshBody).not.toContain('candidate_contacts')
    expect(route).toContain('contactValuesIndexed: false')
  })

  it('supports explicit title, skill, company, location, clearance, and certification filters', () => {
    for (const key of ['p_titles', 'p_skills', 'p_companies', 'p_locations', 'p_clearances', 'p_certifications']) {
      expect(migration).toContain(key)
    }
    expect(route).toContain('p_clearances: input.clearances')
    expect(route).toContain('p_certifications: input.certifications')
  })

  it('does not pretend vector search exists before the vector extension and embedding pipeline are deliberately shipped', () => {
    expect(migration).not.toContain('create extension vector')
    expect(route).toContain('semanticVector: false')
    expect(route).toContain('lexical: true')
    expect(route).toContain('structured: true')
  })

  it('preserves recruiter trust boundaries', () => {
    expect(migration).toContain('Ranking is retrieval relevance only; it is not qualification or a hiring score.')
    expect(route).toContain('retrievalRankIsQualificationScore: false')
    expect(route).toContain('missingEvidenceIsRejectionEvidence: false')
    expect(route).toContain('identityMergePerformed: false')
    expect(route).toContain('sourceRetentionRightsApplied: true')
  })

  it('locks the materialized index and search functions to server-side service role access', () => {
    expect(migration).toContain('alter table public.candidate_search_documents_v39 enable row level security')
    expect(migration).toContain('revoke all on table public.candidate_search_documents_v39 from public, anon, authenticated')
    expect(migration).toContain('grant execute on function public.search_owned_talent_v39')
    expect(migration).toContain('to service_role')
  })
})
