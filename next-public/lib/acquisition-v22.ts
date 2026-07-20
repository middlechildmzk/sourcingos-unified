import 'server-only'
import { z } from 'zod'

export const CONNECTOR_KEYS = ['github','orcid','openalex','pubmed','crossref','uspto','usaspending'] as const
export type ConnectorKey = typeof CONNECTOR_KEYS[number]

export const campaignInputSchema = z.object({
  name: z.string().trim().min(3).max(120),
  roleId: z.string().uuid().optional().nullable(),
  query: z.string().trim().min(2).max(500),
  connectors: z.array(z.enum(CONNECTOR_KEYS)).min(1).max(CONNECTOR_KEYS.length),
  targetCompanies: z.array(z.string().trim().min(1).max(120)).max(100).default([]),
  locations: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  skills: z.array(z.string().trim().min(1).max(80)).max(100).default([]),
  dailyLimit: z.number().int().min(1).max(5000).default(250),
  autoPromoteThreshold: z.number().int().min(70).max(100).default(92),
})

export type CampaignInput = z.infer<typeof campaignInputSchema>

export type Discovery = {
  sourceKey: ConnectorKey
  sourceId: string
  sourceUrl: string
  displayName: string
  headline?: string
  organization?: string
  location?: string
  summary?: string
  skills: string[]
  evidence: Array<{ kind: string; label: string; value: string; url?: string; observedAt?: string }>
  identityConfidence: number
  profileQuality: number
  raw: Record<string, unknown>
}

const clean = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const uniq = (values: string[]) => Array.from(new Set(values.map(v => v.trim()).filter(Boolean))).slice(0, 50)

async function getJson(url: string, headers: Record<string,string> = {}) {
  const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'SourcingOS/1.0 recruiter-controlled-talent-intelligence', ...headers }, signal: AbortSignal.timeout(12000) })
  if (!response.ok) throw new Error(`${response.status} from ${new URL(url).hostname}`)
  return response.json() as Promise<any>
}

export async function discoverGitHub(input: CampaignInput, cursor?: string | null): Promise<{ discoveries: Discovery[]; cursor: string | null }> {
  const page = Math.max(1, Number(cursor || 1))
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN
  const qualifiers = [input.query, ...input.skills.slice(0, 3), ...input.locations.slice(0, 1).map(v => `location:\"${v}\"`)].filter(Boolean).join(' ')
  const data = await getJson(`https://api.github.com/search/users?q=${encodeURIComponent(qualifiers)}&per_page=50&page=${page}`, token ? { authorization: `Bearer ${token}` } : {})
  const items = Array.isArray(data.items) ? data.items : []
  const profiles = await Promise.all(items.slice(0, 20).map(async (item: any) => {
    try { return await getJson(item.url, token ? { authorization: `Bearer ${token}` } : {}) } catch { return item }
  }))
  return {
    discoveries: profiles.map((p: any) => ({
      sourceKey: 'github', sourceId: String(p.id || p.login), sourceUrl: clean(p.html_url) || `https://github.com/${p.login}`,
      displayName: clean(p.name) || clean(p.login), headline: clean(p.bio), organization: clean(p.company).replace(/^@/, ''), location: clean(p.location), summary: clean(p.bio),
      skills: uniq(input.skills), identityConfidence: p.name ? 88 : 76, profileQuality: Math.min(100, 35 + (p.name ? 15 : 0) + (p.bio ? 15 : 0) + (p.company ? 10 : 0) + (p.location ? 10 : 0) + Math.min(15, Number(p.public_repos || 0))),
      evidence: [{ kind: 'public_profile', label: 'GitHub profile', value: clean(p.login), url: clean(p.html_url) }, ...(p.public_repos ? [{ kind: 'public_work', label: 'Public repositories', value: String(p.public_repos), url: clean(p.html_url) }] : [])], raw: p,
    })),
    cursor: items.length === 50 ? String(page + 1) : null,
  }
}

export async function discoverOrcid(input: CampaignInput, cursor?: string | null): Promise<{ discoveries: Discovery[]; cursor: string | null }> {
  const start = Math.max(0, Number(cursor || 0))
  const data = await getJson(`https://pub.orcid.org/v3.0/expanded-search/?q=${encodeURIComponent(input.query)}&start=${start}&rows=50`)
  const rows = Array.isArray(data['expanded-result']) ? data['expanded-result'] : []
  return { discoveries: rows.map((r: any) => {
    const id = clean(r['orcid-id']); const name = [clean(r['given-names']), clean(r['family-names'])].filter(Boolean).join(' ') || id
    const orgs = Array.isArray(r['institution-name']) ? r['institution-name'] : []
    return { sourceKey: 'orcid' as const, sourceId: id, sourceUrl: `https://orcid.org/${id}`, displayName: name, organization: clean(orgs[0]), summary: clean(r['biography']), skills: uniq(input.skills), identityConfidence: 94, profileQuality: Math.min(100, 55 + (orgs.length ? 15 : 0) + (r['email'] ? 5 : 0)), evidence: [{ kind: 'persistent_identity', label: 'ORCID', value: id, url: `https://orcid.org/${id}` }], raw: r }
  }), cursor: rows.length === 50 ? String(start + 50) : null }
}

export async function discoverOpenAlex(input: CampaignInput, cursor?: string | null): Promise<{ discoveries: Discovery[]; cursor: string | null }> {
  const page = Math.max(1, Number(cursor || 1))
  const data = await getJson(`https://api.openalex.org/authors?search=${encodeURIComponent(input.query)}&per-page=50&page=${page}&mailto=${encodeURIComponent(process.env.OPENALEX_MAILTO || 'admin@sourcingos.com')}`)
  const rows = Array.isArray(data.results) ? data.results : []
  return { discoveries: rows.map((r: any) => ({ sourceKey: 'openalex' as const, sourceId: clean(r.id), sourceUrl: clean(r.id), displayName: clean(r.display_name), organization: clean(r.last_known_institutions?.[0]?.display_name), summary: `${Number(r.works_count || 0)} works · ${Number(r.cited_by_count || 0)} citations`, skills: uniq([...(r.x_concepts || []).slice(0,8).map((c:any)=>clean(c.display_name)), ...input.skills]), identityConfidence: r.orcid ? 96 : 86, profileQuality: Math.min(100, 45 + (r.orcid ? 20 : 0) + (r.last_known_institutions?.length ? 15 : 0) + Math.min(20, Number(r.works_count || 0))), evidence: [{ kind: 'research_profile', label: 'OpenAlex author', value: clean(r.display_name), url: clean(r.id) }, ...(r.orcid ? [{ kind: 'persistent_identity', label: 'ORCID', value: clean(r.orcid), url: clean(r.orcid) }] : [])], raw: r })), cursor: rows.length === 50 ? String(page + 1) : null }
}

export async function discoverPubMed(input: CampaignInput, cursor?: string | null): Promise<{ discoveries: Discovery[]; cursor: string | null }> {
  const retstart = Math.max(0, Number(cursor || 0))
  const search = await getJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=50&retstart=${retstart}&term=${encodeURIComponent(input.query)}`)
  const ids = search?.esearchresult?.idlist || []
  if (!ids.length) return { discoveries: [], cursor: null }
  const summary = await getJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}`)
  const people = new Map<string, Discovery>()
  for (const id of ids) {
    const article = summary?.result?.[id]; if (!article) continue
    for (const author of article.authors || []) {
      const name = clean(author.name); if (!name) continue
      const key = `${name.toLowerCase()}|${clean(article.sortfirstauthor)}`
      if (!people.has(key)) {
        people.set(key, { sourceKey: 'pubmed', sourceId: key, sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${id}/`, displayName: name, headline: 'Published researcher', summary: clean(article.title), skills: uniq(input.skills), identityConfidence: 72, profileQuality: 58, evidence: [{ kind: 'publication', label: clean(article.fulljournalname) || 'PubMed publication', value: clean(article.title), url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`, observedAt: clean(article.pubdate) }], raw: { author, article } })
      } else {
        people.get(key)!.evidence.push({ kind: 'publication', label: clean(article.fulljournalname) || 'PubMed publication', value: clean(article.title), url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`, observedAt: clean(article.pubdate) })
      }
    }
  }
  return { discoveries: Array.from(people.values()), cursor: ids.length === 50 ? String(retstart + 50) : null }
}

export async function discoverCrossref(input: CampaignInput, cursor?: string | null): Promise<{ discoveries: Discovery[]; cursor: string | null }> {
  const offset = Math.max(0, Number(cursor || 0))
  const data = await getJson(`https://api.crossref.org/works?query=${encodeURIComponent(input.query)}&rows=50&offset=${offset}&select=DOI,title,author,published,URL,publisher`)
  const items = data?.message?.items || []
  const people = new Map<string, Discovery>()
  for (const work of items) {
    for (const author of work.author || []) {
      const name = [clean(author.given), clean(author.family)].filter(Boolean).join(' ')
      if (!name) continue
      const id = clean(author.ORCID) || `${name.toLowerCase()}|${clean(work.publisher)}`
      const ev = { kind: 'publication', label: clean(work.publisher) || 'Crossref work', value: clean(work.title?.[0]), url: clean(work.URL) }
      if (!people.has(id)) {
        people.set(id, { sourceKey: 'crossref', sourceId: id, sourceUrl: clean(author.ORCID) || clean(work.URL), displayName: name, organization: clean(author.affiliation?.[0]?.name), headline: 'Published professional', skills: uniq(input.skills), identityConfidence: author.ORCID ? 94 : 70, profileQuality: author.ORCID ? 78 : 55, evidence: [ev], raw: { author, work } })
      } else {
        people.get(id)!.evidence.push(ev)
      }
    }
  }
  return { discoveries: Array.from(people.values()), cursor: items.length === 50 ? String(offset + 50) : null }
}

export const connectorRunners: Partial<Record<ConnectorKey, (input: CampaignInput, cursor?: string | null) => Promise<{ discoveries: Discovery[]; cursor: string | null }>>> = {
  github: discoverGitHub, orcid: discoverOrcid, openalex: discoverOpenAlex, pubmed: discoverPubMed, crossref: discoverCrossref,
}

export function scoreDiscovery(d: Discovery, input: CampaignInput) {
  const haystack = `${d.headline || ''} ${d.organization || ''} ${d.location || ''} ${d.summary || ''} ${d.skills.join(' ')}`.toLowerCase()
  const terms = uniq([input.query, ...input.skills, ...input.targetCompanies, ...input.locations]).flatMap(v => v.toLowerCase().split(/\s+/)).filter(v => v.length > 2)
  const matched = terms.filter(term => haystack.includes(term))
  return Math.min(100, Math.round(d.profileQuality * .35 + d.identityConfidence * .35 + Math.min(30, matched.length * 5)))
}
