import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.cwd())
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('V36.10 Candidate Graph identity and talent database', () => {
  it('stores candidate documents as provenance artifacts rather than flattening them into a candidate row', () => {
    const migration = read('supabase/migrations/20260903003000_candidate_artifacts_v36_10.sql')
    const importer = read('app/api/candidate-db/import-resume/route.ts')
    expect(migration).toContain('create table if not exists public.candidate_artifacts')
    expect(migration).toContain('content_sha256 text not null')
    expect(migration).toContain("identity_anchors jsonb not null")
    expect(migration).toContain("data_origin text not null")
    expect(migration).toContain('alter table public.candidate_artifacts enable row level security')
    expect(importer).toContain('buildCandidateArtifactV36_10')
    expect(importer).toContain('persistCandidateArtifactV36_10')
    expect(importer).toContain("artifactType: 'resume'")
    expect(importer).toContain("dataOrigin: 'recruiter_upload'")
  })

  it('searches attached graph evidence and source identities while returning canonical candidates once', () => {
    const migration = read('supabase/migrations/20260903004000_candidate_graph_search_v36_10.sql')
    const workspace = read('lib/candidate-workspace-v25.ts')
    expect(migration).toContain('returns table (\n  candidate_id uuid')
    expect(migration).toContain('from public.candidates c')
    expect(migration).toContain('from public.source_profiles')
    expect(migration).toContain('from public.evidence_items')
    expect(migration).toContain('from public.candidate_contacts')
    expect(migration).toContain("permission_status <> 'do_not_contact'")
    expect(migration).toContain('grant execute on function public.search_candidate_graph_v36_10')
    expect(migration).toContain('to service_role')
    expect(workspace).toContain('searchCandidateGraphIdsV36_10')
    expect(workspace).toContain("searchMode: search ? graphSearchActive ? 'candidate_graph' : 'legacy_scalar' : 'none'")
  })

  it('keeps professional-profile identity matching proposal-only and recruiter-confirmed', () => {
    const service = read('lib/identity-proposal-service-v33-2.ts')
    const route = read('app/api/candidate-db/match-review/route.ts')
    const inbox = read('components/IdentityReviewInboxV36_10.tsx')
    expect(service).toContain('sharedProfessionalProfileAnchorsV36_10')
    expect(service).toContain('This function never links source profiles')
    expect(route).toContain('mergeAuthorized: false')
    expect(route).toContain('reviewRequired: true')
    expect(inbox).toContain('Confirm same person')
    expect(inbox).toContain('Keep separate')
    expect(inbox).toContain('Identity confidence is not merge permission.')
  })

  it('shows resolved Candidate 360 fields without overwriting competing source observations', () => {
    const route = read('app/api/candidate-db/360/[id]/route.ts')
    const resolver = read('lib/candidate-field-resolution-v35.ts')
    const ui = read('components/CandidateFieldResolutionV36_10.tsx')
    expect(route).toContain('resolveCandidate360FieldsV35')
    expect(route).toContain('resolvedProfile')
    expect(resolver).toContain("shadowOnly: true")
    expect(ui).toContain('competing observation')
    expect(ui).toContain('Source-aware, not source-destructive.')
    expect(ui).toContain('never authorizes an identity merge or outreach')
  })

  it('exposes artifacts and identity review as first-class Candidate 360/database workflows', () => {
    const candidatePage = read('app/app/candidate/[id]/page.tsx')
    const databasePage = read('app/app/candidate-database/page.tsx')
    expect(candidatePage).toContain('<CandidateFieldResolutionV36_10 candidateId={id} />')
    expect(candidatePage).toContain('<CandidateArtifactsV36_10 candidateId={id} />')
    expect(databasePage).toContain('href="/app/identity-review"')
    expect(databasePage).toContain('One canonical person record with source-level provenance')
  })
})
