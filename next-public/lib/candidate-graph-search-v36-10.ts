import 'server-only'

export type CandidateGraphSearchPageV36_10 = {
  candidateIds: string[]
  ranks: Map<string, number>
  total: number
  migrationReady: boolean
}

function missingSearchRpc(error: any) {
  const code = String(error?.code || '')
  const message = String(error?.message || '')
  return code === '42883' || code === 'PGRST202' || /search_candidate_graph_v36_10|function .* does not exist/i.test(message)
}

export async function searchCandidateGraphIdsV36_10(input: {
  sb: any
  ownerId: string
  query: string
  limit: number
  offset: number
}): Promise<CandidateGraphSearchPageV36_10 | null> {
  const query = input.query.trim().slice(0, 100)
  if (!query) return null

  const { data, error } = await input.sb.rpc('search_candidate_graph_v36_10', {
    p_owner_id: input.ownerId,
    p_query: query,
    p_limit: Math.max(1, Math.min(input.limit, 200)),
    p_offset: Math.max(0, input.offset),
  })

  if (error) {
    if (missingSearchRpc(error)) return { candidateIds: [], ranks: new Map(), total: 0, migrationReady: false }
    throw new Error(`Candidate Graph search failed: ${error.message}`)
  }

  const rows = Array.isArray(data) ? data : []
  const candidateIds = rows.map((row: any) => String(row.candidate_id || '')).filter(Boolean)
  const ranks = new Map<string, number>(rows.map((row: any) => [String(row.candidate_id || ''), Number(row.rank || 0)]))
  const total = rows.length ? Number(rows[0]?.total_count || candidateIds.length) : 0
  return { candidateIds, ranks, total: Number.isFinite(total) ? total : candidateIds.length, migrationReady: true }
}
