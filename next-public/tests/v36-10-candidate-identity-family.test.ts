import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.cwd())
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('V36.10 canonical candidate identity family', () => {
  it('resolves absorbed candidate audit ids to one canonical identity family without creating identity', () => {
    const migration = read('supabase/migrations/20260903004500_candidate_identity_family_v36_10.sql')
    expect(migration).toContain('with recursive requested as')
    expect(migration).toContain('public.resolve_candidate_identity_v36_10')
    expect(migration).toContain('join public.candidate_identity_redirects cir')
    expect(migration).toContain('f.redirect_depth < 20')
    expect(migration).toContain('not cir.from_candidate_id = any(f.path)')
    expect(migration).toContain('revoke all on function public.candidate_identity_families_v36_10')
    expect(migration).toContain('grant execute on function public.candidate_identity_families_v36_10')
    expect(migration).toContain('to service_role')
    expect(migration).toContain('never creates identity links or authorizes merging')
  })

  it('keeps absorbed aliases out of talent search while searching their confirmed historical evidence', () => {
    const search = read('supabase/migrations/20260903005000_candidate_graph_identity_family_search_v36_10.sql')
    expect(search).toContain('public.candidate_identity_families_v36_10')
    expect(search).toContain('candidate_id = any(family.ids)')
    expect(search).toContain('from public.candidate_identity_redirects cir')
    expect(search).toContain('cir.from_candidate_id = c.id')
    expect(search).toContain("permission_status <> 'do_not_contact'")
    expect(search).toContain('Absorbed aliases never return as separate people')
    expect(search).toContain('identity is never created by search')
  })

  it('aggregates saved-database evidence and role history onto the canonical person at read time', () => {
    const workspace = read('lib/candidate-workspace-v25.ts')
    expect(workspace).toContain('candidateIdentityFamiliesV36_10')
    expect(workspace).toContain('candidateIdentityRedirectStateV36_10')
    expect(workspace).toContain('relatedCandidateIds')
    expect(workspace).toContain(".in('candidate_id', relatedCandidateIds)")
    expect(workspace).toContain("sb.from('role_candidates')")
    expect(workspace).toContain('identityFamilies.familyToCanonical')
    expect(workspace).toContain('identityFamilyIds')
    expect(workspace).toContain('absorbedIdentityCount')
    expect(workspace).toContain('historicalCandidateId')
  })

  it('builds Candidate 360 from canonical plus absorbed audit-history ids without rewriting them', () => {
    const route = read('app/api/candidate-db/360/[id]/route.ts')
    expect(route).toContain('resolveCanonicalCandidateIdV36_10')
    expect(route).toContain('candidateIdentityFamiliesV36_10')
    expect(route).toContain('familyCandidateIds')
    expect(route).toContain(".in('candidate_id', familyCandidateIds)")
    expect(route).toContain("sb.from('project_candidates')")
    expect(route).toContain("sb.from('role_candidates')")
    expect(route).toContain('canonicalizeFamilyRows')
    expect(route).toContain('historical_candidate_id')
    expect(route).toContain('Identity family membership exists only after recruiter-authorized source-profile reassignment')
  })

  it('keeps resume and document artifacts attached to the canonical identity view while preserving their historical id', () => {
    const route = read('app/api/candidate-db/artifacts/[id]/route.ts')
    expect(route).toContain('resolveCanonicalCandidateIdV36_10')
    expect(route).toContain('candidateIdentityFamiliesV36_10')
    expect(route).toContain(".in('candidate_id', familyCandidateIds)")
    expect(route).toContain('historicalCandidateId')
    expect(route).toContain('absorbedCandidateIds')
  })

  it('aligns the role Evidence Ledger with the same confirmed identity-family read model', () => {
    const ledger = read('lib/supabase-evidence-ledger.ts')
    expect(ledger).toContain('resolveCanonicalCandidateIdV36_10')
    expect(ledger).toContain('candidateIdentityFamiliesV36_10')
    expect(ledger).toContain('familyCandidateIds')
    expect(ledger).toContain("sourceProfileQuery = sourceProfileQuery.in('candidate_id', familyCandidateIds)")
    expect(ledger).toContain('canonicalizeCandidateId')
    expect(ledger).toContain('buildEvidenceLedger(snapshot, { candidateId })')
  })
})
