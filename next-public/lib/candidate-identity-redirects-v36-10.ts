import 'server-only'

function missingRedirectTable(error: any) {
  const code = String(error?.code || '')
  const message = String(error?.message || '')
  return code === '42P01' || code === 'PGRST205' || /candidate_identity_redirects|relation .* does not exist/i.test(message)
}

export async function candidateIdentityRedirectStateV36_10(input: {
  sb: any
  ownerId: string
  candidateIds?: string[]
}): Promise<{
  migrationReady: boolean
  redirectedIds: Set<string>
  redirectTargets: Map<string, string>
  totalRedirects: number
}> {
  const ids = Array.from(new Set((input.candidateIds || []).filter(Boolean))).slice(0, 500)
  const countQuery = input.sb
    .from('candidate_identity_redirects')
    .select('from_candidate_id', { count: 'exact', head: true })
    .eq('owner_id', input.ownerId)
  const rowQuery = ids.length
    ? input.sb
        .from('candidate_identity_redirects')
        .select('from_candidate_id,to_candidate_id')
        .eq('owner_id', input.ownerId)
        .in('from_candidate_id', ids)
    : Promise.resolve({ data: [], error: null })

  const [countResult, rowResult] = await Promise.all([countQuery, rowQuery])
  const error = countResult.error || rowResult.error
  if (error) {
    if (missingRedirectTable(error)) {
      return { migrationReady: false, redirectedIds: new Set(), redirectTargets: new Map(), totalRedirects: 0 }
    }
    throw new Error(`Candidate identity redirect lookup failed: ${error.message}`)
  }

  const rows = Array.isArray(rowResult.data) ? rowResult.data : []
  const redirectTargets = new Map<string, string>()
  for (const row of rows) {
    const from = String(row?.from_candidate_id || '')
    const to = String(row?.to_candidate_id || '')
    if (from && to) redirectTargets.set(from, to)
  }

  return {
    migrationReady: true,
    redirectedIds: new Set(redirectTargets.keys()),
    redirectTargets,
    totalRedirects: Number(countResult.count || 0),
  }
}

export async function resolveCanonicalCandidateIdV36_10(input: {
  sb: any
  ownerId: string
  candidateId: string
}): Promise<{ candidateId: string; redirected: boolean; migrationReady: boolean }> {
  const { data, error } = await input.sb.rpc('resolve_candidate_identity_v36_10', {
    p_owner_id: input.ownerId,
    p_candidate_id: input.candidateId,
  })

  if (error) {
    const code = String(error.code || '')
    const message = String(error.message || '')
    if (code === '42883' || code === 'PGRST202' || /resolve_candidate_identity_v36_10|function .* does not exist/i.test(message)) {
      return { candidateId: input.candidateId, redirected: false, migrationReady: false }
    }
    throw new Error(`Canonical candidate resolution failed: ${error.message}`)
  }

  const resolved = typeof data === 'string' && data ? data : input.candidateId
  return { candidateId: resolved, redirected: resolved !== input.candidateId, migrationReady: true }
}
