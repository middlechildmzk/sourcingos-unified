import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getRouteSession } from '@/lib/supabase/route-session'

export type McpPrincipalV38_5 = {
  userId: string
  authMode: 'bearer' | 'cookie'
}

type CandidateSummary = {
  id: string
  name: string
  headline?: string
  currentTitle?: string
  currentCompany?: string
  location?: string
  skills: string[]
  mergeStatus?: string
  refreshedAt?: string
}

function clean(value: unknown): string | undefined {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || undefined
}

function candidateSummary(row: Record<string, any>): CandidateSummary {
  return {
    id: String(row.id || ''),
    name: String(row.canonical_name || 'Unconfirmed identity'),
    headline: clean(row.headline),
    currentTitle: clean(row.current_title),
    currentCompany: clean(row.current_company),
    location: clean(row.location),
    skills: Array.isArray(row.skills) ? row.skills.filter((item: unknown): item is string => typeof item === 'string') : [],
    mergeStatus: clean(row.merge_status),
    refreshedAt: clean(row.last_refreshed_at || row.updated_at),
  }
}

export async function resolveMcpPrincipalV38_5(req: Request): Promise<McpPrincipalV38_5 | null> {
  const auth = req.headers.get('authorization') || ''
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()

  if (bearer && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      })
      const { data: { user }, error } = await sb.auth.getUser(bearer)
      if (!error && user?.id) return { userId: user.id, authMode: 'bearer' }
    } catch {
      // Fall through to the normal signed cookie session. Never trust an
      // unvalidated bearer token or a caller-provided owner id.
    }
  }

  const session = await getRouteSession()
  if (session.authenticated && session.userId) return { userId: session.userId, authMode: 'cookie' }
  return null
}

function supabaseOrThrow() {
  if (!isSupabaseConfigured()) throw new Error('The durable Candidate Graph is unavailable in this environment.')
  const sb = createServerSupabaseClient()
  if (!sb) throw new Error('The durable Candidate Graph is unavailable in this environment.')
  return sb
}

function limitValue(value: unknown, fallback = 10, max = 25) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.min(max, Math.floor(parsed)))
}

export async function searchOwnedPeopleV38_5(userId: string, args: Record<string, unknown>) {
  const sb = supabaseOrThrow()
  const query = String(args.query || '').trim()
  const limit = limitValue(args.limit)
  if (!query) throw new Error('query is required')

  // This MCP surface searches the durable canonical graph only. Live provider
  // fan-out remains in People Search so MCP cannot accidentally trigger spend.
  const escaped = query.replace(/[,%]/g, ' ').replace(/\s+/g, ' ').trim()
  const pattern = `%${escaped}%`
  const { data, error } = await sb
    .from('candidates')
    .select('id,canonical_name,headline,current_title,current_company,location,skills,merge_status,last_refreshed_at,updated_at')
    .eq('owner_id', userId)
    .or(`canonical_name.ilike.${pattern},headline.ilike.${pattern},current_title.ilike.${pattern},current_company.ilike.${pattern},location.ilike.${pattern}`)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error('Candidate Graph search failed.')
  return {
    mode: 'owned_candidate_graph',
    query,
    results: (data || []).map(row => candidateSummary(row as Record<string, any>)),
    trustBoundary: 'These are canonical SourcingOS records. This tool does not trigger paid enrichment or silently merge identities.',
  }
}

export async function lookupPersonV38_5(userId: string, args: Record<string, unknown>) {
  const sb = supabaseOrThrow()
  const identifier = String(args.identifier || '').trim()
  const company = String(args.company || '').trim()
  if (!identifier) throw new Error('identifier is required')

  const candidateIds = new Set<string>()
  const normalized = identifier.toLowerCase()

  // 1) Canonical candidate name/title/company/location.
  const namePattern = `%${identifier.replace(/[,%]/g, ' ')}%`
  let candidateQuery = sb
    .from('candidates')
    .select('id,canonical_name,headline,current_title,current_company,location,skills,merge_status,last_refreshed_at,updated_at')
    .eq('owner_id', userId)
    .ilike('canonical_name', namePattern)
    .limit(15)
  if (company) candidateQuery = candidateQuery.ilike('current_company', `%${company.replace(/[,%]/g, ' ')}%`)
  const candidateResult = await candidateQuery
  if (candidateResult.error) throw new Error('Known-person lookup failed.')
  for (const row of candidateResult.data || []) candidateIds.add(String(row.id))

  // 2) Public professional URL / source display name.
  if (/^https?:\/\//i.test(identifier) || identifier.includes('linkedin.com/') || identifier.includes('github.com/')) {
    const { data } = await sb
      .from('source_profiles')
      .select('candidate_id')
      .eq('owner_id', userId)
      .ilike('profile_url', `%${identifier.replace(/[,%]/g, '')}%`)
      .limit(15)
    for (const row of data || []) if (row.candidate_id) candidateIds.add(String(row.candidate_id))
  }

  // 3) Existing observed contact. This is lookup only; it never calls a paid
  // contact provider and never uses the contact value as automatic merge authority.
  if (normalized.includes('@') || /^\+?[\d\s().-]{7,}$/.test(identifier)) {
    const { data } = await sb
      .from('candidate_contacts')
      .select('candidate_id')
      .eq('owner_id', userId)
      .ilike('value', identifier)
      .limit(15)
    for (const row of data || []) if (row.candidate_id) candidateIds.add(String(row.candidate_id))
  }

  if (!candidateIds.size) {
    return {
      mode: 'owned_candidate_graph',
      identifier,
      results: [],
      nextBestAction: 'Use People Search for live federated discovery, then save/confirm the person into the Candidate Graph.',
    }
  }

  const { data, error } = await sb
    .from('candidates')
    .select('id,canonical_name,headline,current_title,current_company,location,skills,merge_status,last_refreshed_at,updated_at')
    .eq('owner_id', userId)
    .in('id', Array.from(candidateIds))
    .limit(15)
  if (error) throw new Error('Known-person lookup could not load canonical candidates.')

  return {
    mode: 'owned_candidate_graph',
    identifier,
    results: (data || []).map(row => candidateSummary(row as Record<string, any>)),
    trustBoundary: 'Matches are candidate-graph lookups, not new identity merges. Ambiguous identities remain separate until recruiter review.',
  }
}

export async function getCandidateV38_5(userId: string, args: Record<string, unknown>) {
  const sb = supabaseOrThrow()
  const candidateId = String(args.candidateId || '').trim()
  if (!candidateId) throw new Error('candidateId is required')

  const [candidate, profiles, evidence, contacts, roles] = await Promise.all([
    sb.from('candidates').select('*').eq('owner_id', userId).eq('id', candidateId).maybeSingle(),
    sb.from('source_profiles').select('id,source,source_profile_id,display_name,headline,location,organization,profile_url,status,match_score,last_seen_at').eq('owner_id', userId).eq('candidate_id', candidateId).order('last_seen_at', { ascending: false }).limit(50),
    sb.from('evidence_items').select('id,source,label,detail,confidence,url,source_profile_id,created_at').eq('owner_id', userId).eq('candidate_id', candidateId).order('created_at', { ascending: false }).limit(100),
    sb.from('candidate_contacts').select('id,type,value,source,confidence,permission_status,source_profile_id,created_at').eq('owner_id', userId).eq('candidate_id', candidateId).limit(50),
    sb.from('role_candidates').select('role_id,stage,fit_decision,fit_reasons,concerns,updated_at').eq('owner_id', userId).eq('candidate_id', candidateId).limit(50),
  ])

  if (candidate.error || !candidate.data) throw new Error('Candidate not found.')
  const failed = [profiles, evidence, contacts, roles].some(result => Boolean(result.error))
  if (failed) throw new Error('Candidate relationships could not be loaded completely.')

  return {
    candidate: candidateSummary(candidate.data as Record<string, any>),
    summary: clean((candidate.data as Record<string, any>).summary),
    sourceProfiles: profiles.data || [],
    evidence: evidence.data || [],
    contacts: contacts.data || [],
    roles: roles.data || [],
    trustBoundary: 'Evidence and source provenance remain distinct from recruiter qualification. Contact observations are not permission to outreach.',
  }
}

export async function explainCandidateV38_5(userId: string, args: Record<string, unknown>) {
  const dossier = await getCandidateV38_5(userId, args)
  const evidence = Array.isArray(dossier.evidence) ? dossier.evidence : []
  return {
    candidate: dossier.candidate,
    observedEvidence: evidence.slice(0, limitValue(args.limit, 20, 50)),
    sourceCount: Array.isArray(dossier.sourceProfiles) ? dossier.sourceProfiles.length : 0,
    evidenceCount: evidence.length,
    explanation: 'SourcingOS exposes observed evidence and provenance. It does not convert missing evidence into a rejection or provider scores into hiring decisions.',
  }
}

export async function getKnownContactsV38_5(userId: string, args: Record<string, unknown>) {
  const dossier = await getCandidateV38_5(userId, args)
  const contacts = Array.isArray(dossier.contacts) ? dossier.contacts : []
  return {
    candidate: dossier.candidate,
    contacts,
    paidEnrichmentTriggered: false,
    nextBestAction: contacts.length ? 'Review verification and permission status before outreach.' : 'Open Candidate 360 and explicitly approve contact enrichment if desired.',
  }
}
