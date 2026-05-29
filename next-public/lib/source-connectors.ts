import { EvidenceItem, SourceName, SourceResult, SourceSearchRequest } from './source-types'

const now = () => new Date().toISOString()
const safe = (value: unknown) => String(value || '').trim()
const words = (text: string) => Array.from(new Set(text.toLowerCase().split(/[^a-z0-9+#.]+/).filter(w => w.length > 2))).slice(0, 18)
const idFor = (source: SourceName, id: string) => `${source}:${id}`
const normId = (value: string) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'search'
const evidence = (source: SourceName, label: string, detail: string, confidence: EvidenceItem['confidence'] = 'medium', url?: string): EvidenceItem => ({
  id: `${source}-${Math.random().toString(36).slice(2, 10)}`,
  label,
  detail,
  source,
  confidence,
  url,
  observedAt: now()
})

async function safeJson(url: string, init?: RequestInit) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6500)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, headers: { accept: 'application/json', ...(init?.headers || {}) } })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return await res.json()
  } finally {
    clearTimeout(timeout)
  }
}

function demoResult(source: SourceName, query: string, suffix: string): SourceResult {
  const skillSeed = words(query).filter(w => !['engineer', 'developer', 'recruiter', 'source'].includes(w)).slice(0, 6)
  const sourceProfileId = `demo-${suffix.toLowerCase().replace(/\s+/g, '-')}`
  return {
    id: idFor(source, sourceProfileId),
    source,
    sourceProfileId,
    displayName: `${query.split(' ').slice(0, 2).join(' ') || 'Candidate'} ${suffix}`,
    headline: `Demo ${source} source profile. Live connector is wired and will replace this if the API returns results.`,
    location: '',
    profileUrl: '',
    skills: skillSeed,
    evidence: [evidence(source, 'Demo fallback result', `Generated fallback evidence for ${query}. API may be unavailable, rate-limited, or blocked in this environment.`, 'low')],
    contactSignals: [],
    identitySignals: skillSeed.map(s => ({ type: 'skill', value: s, weight: 3, source })),
    refreshedAt: now()
  }
}

function buildCommonIdentity(source: SourceName, name: string, location = '', org = '', skills: string[] = []) {
  return [
    { type: 'name' as const, value: name, weight: 15, source },
    ...(location ? [{ type: 'location' as const, value: location, weight: 12, source }] : []),
    ...(org ? [{ type: 'organization' as const, value: org, weight: 10, source }] : []),
    ...skills.slice(0, 5).map(s => ({ type: 'skill' as const, value: s, weight: 3, source }))
  ]
}

export async function searchGitHub(req: SourceSearchRequest): Promise<SourceResult[]> {
  const q = encodeURIComponent(`${req.query} ${req.location || ''}`.trim())
  try {
    const data = await safeJson(`https://api.github.com/search/users?q=${q}&per_page=${Math.min(req.limit || 6, 8)}`)
    const users = Array.isArray(data.items) ? data.items.slice(0, req.limit || 6) : []
    const out: SourceResult[] = []
    for (const u of users) {
      let detail: any = null
      try { detail = await safeJson(u.url) } catch { detail = null }
      const login = safe(u.login)
      const name = safe(detail?.name) || login
      const profileUrl = safe(u.html_url)
      const skills = words(`${req.query} ${detail?.bio || ''} ${detail?.company || ''}`)
      out.push({
        id: idFor('github', login),
        source: 'github',
        sourceProfileId: login,
        displayName: name,
        headline: safe(detail?.bio) || `GitHub profile matching ${req.query}`,
        location: safe(detail?.location),
        organization: safe(detail?.company),
        profileUrl,
        avatarUrl: safe(u.avatar_url),
        skills,
        evidence: [
          evidence('github', 'Public GitHub profile match', `${name} matched GitHub search for ${req.query}.`, 'medium', profileUrl),
          ...(detail?.public_repos ? [evidence('github', 'Repository footprint', `${detail.public_repos} public repositories visible on profile.`, 'medium', profileUrl)] : []),
          ...(detail?.blog ? [evidence('github', 'Public website signal', `Profile lists website: ${detail.blog}`, 'low', detail.blog)] : [])
        ],
        contactSignals: [
          ...(detail?.email ? [{ type: 'public_email' as const, value: safe(detail.email), source: 'github' as const, verified: false as const, note: 'Public GitHub email. Treat as unverified until recruiter confirms.' }] : []),
          ...(detail?.blog ? [{ type: 'website' as const, value: safe(detail.blog), source: 'github' as const, verified: false as const, note: 'Public website listed on GitHub profile.' }] : []),
          { type: 'profile_url', value: profileUrl, source: 'github', verified: false, note: 'Public GitHub profile URL.' }
        ],
        identitySignals: [
          ...buildCommonIdentity('github', name, safe(detail?.location), safe(detail?.company), skills),
          ...(detail?.blog ? [{ type: 'website' as const, value: safe(detail.blog), weight: 25, source: 'github' as const }] : [])
        ],
        refreshedAt: now(),
        raw: detail || u
      })
    }
    return out.length ? out : [demoResult('github', req.query, 'GitHub')]
  } catch {
    return [demoResult('github', req.query, 'GitHub')]
  }
}

export async function searchStackOverflow(req: SourceSearchRequest): Promise<SourceResult[]> {
  const q = encodeURIComponent(req.query)
  try {
    const data = await safeJson(`https://api.stackexchange.com/2.3/users?order=desc&sort=reputation&inname=${q}&site=stackoverflow&pagesize=${Math.min(req.limit || 6, 8)}&filter=default`)
    const users = Array.isArray(data.items) ? data.items.slice(0, req.limit || 6) : []
    const out = users.map((u: any): SourceResult => {
      const name = safe(u.display_name)
      const profileUrl = safe(u.link)
      const skills = words(req.query)
      const location = safe(u.location)
      return {
        id: idFor('stackoverflow', safe(u.user_id)),
        source: 'stackoverflow',
        sourceProfileId: safe(u.user_id),
        displayName: name,
        headline: `Stack Overflow user with ${u.reputation || 0} reputation.`,
        location,
        profileUrl,
        avatarUrl: safe(u.profile_image),
        skills,
        evidence: [
          evidence('stackoverflow', 'Stack Overflow reputation signal', `${name} has ${u.reputation || 0} reputation.`, Number(u.reputation || 0) > 1000 ? 'high' : 'medium', profileUrl),
          evidence('stackoverflow', 'Q&A profile match', `Profile surfaced from Stack Overflow user search for ${req.query}.`, 'medium', profileUrl)
        ],
        contactSignals: [
          { type: 'profile_url', value: profileUrl, source: 'stackoverflow', verified: false, note: 'Public Stack Overflow profile URL.' },
          ...(u.website_url ? [{ type: 'website' as const, value: safe(u.website_url), source: 'stackoverflow' as const, verified: false as const, note: 'Public website listed on Stack Overflow profile.' }] : [])
        ],
        identitySignals: buildCommonIdentity('stackoverflow', name, location, '', skills),
        refreshedAt: now(),
        raw: u
      }
    })
    return out.length ? out : [demoResult('stackoverflow', req.query, 'StackOverflow')]
  } catch {
    return [demoResult('stackoverflow', req.query, 'StackOverflow')]
  }
}

export async function searchOpenAlex(req: SourceSearchRequest): Promise<SourceResult[]> {
  const q = encodeURIComponent(req.query)
  try {
    const data = await safeJson(`https://api.openalex.org/authors?search=${q}&per-page=${Math.min(req.limit || 6, 8)}`)
    const authors = Array.isArray(data.results) ? data.results.slice(0, req.limit || 6) : []
    const out = authors.map((a: any): SourceResult => {
      const name = safe(a.display_name)
      const profileUrl = safe(a.id)
      const concepts = Array.isArray(a.x_concepts) ? a.x_concepts.map((c: any) => safe(c.display_name)).filter(Boolean).slice(0, 8) : []
      const institution = safe(a.last_known_institution?.display_name)
      return {
        id: idFor('openalex', safe(a.id).split('/').pop() || name),
        source: 'openalex',
        sourceProfileId: safe(a.id),
        displayName: name,
        headline: `OpenAlex author with ${a.works_count || 0} works and ${a.cited_by_count || 0} citations.`,
        organization: institution,
        profileUrl,
        skills: concepts.length ? concepts : words(req.query),
        evidence: [
          evidence('openalex', 'Research author match', `${name} matched OpenAlex author search for ${req.query}.`, 'medium', profileUrl),
          evidence('openalex', 'Publication footprint', `${a.works_count || 0} works and ${a.cited_by_count || 0} citations.`, Number(a.cited_by_count || 0) > 100 ? 'high' : 'medium', profileUrl),
          ...(institution ? [evidence('openalex', 'Institution signal', institution, 'medium', profileUrl)] : [])
        ],
        contactSignals: [
          { type: 'profile_url', value: profileUrl, source: 'openalex', verified: false, note: 'Public OpenAlex author URL.' },
          ...(institution ? [{ type: 'organization' as const, value: institution, source: 'openalex' as const, verified: false as const, note: 'Public institution signal from OpenAlex.' }] : [])
        ],
        identitySignals: buildCommonIdentity('openalex', name, '', institution, concepts),
        refreshedAt: now(),
        raw: a
      }
    })
    return out.length ? out : [demoResult('openalex', req.query, 'OpenAlex')]
  } catch {
    return [demoResult('openalex', req.query, 'OpenAlex')]
  }
}

export async function searchNpi(req: SourceSearchRequest): Promise<SourceResult[]> {
  const q = req.query.trim().split(/\s+/)
  const first = encodeURIComponent(q[0] || '')
  const last = encodeURIComponent(q.length > 1 ? q[q.length - 1] : q[0] || '')
  const city = encodeURIComponent(req.location || '')
  const taxonomyDescription = encodeURIComponent(req.query.includes('Nurse') || req.query.includes('RN') ? 'Registered Nurse' : req.query)
  const url = `https://npiregistry.cms.hhs.gov/api/?version=2.1&limit=${Math.min(req.limit || 6, 8)}${first ? `&first_name=${first}` : ''}${last ? `&last_name=${last}` : ''}${city ? `&city=${city}` : ''}${taxonomyDescription ? `&taxonomy_description=${taxonomyDescription}` : ''}`
  try {
    const data = await safeJson(url)
    const rows = Array.isArray(data.results) ? data.results.slice(0, req.limit || 6) : []
    const out = rows.map((r: any): SourceResult => {
      const basic = r.basic || {}
      const name = [basic.first_name, basic.middle_name, basic.last_name].map(safe).filter(Boolean).join(' ') || safe(basic.organization_name) || 'NPI provider'
      const taxonomies = Array.isArray(r.taxonomies) ? r.taxonomies.map((t: any) => safe(t.desc || t.code)).filter(Boolean).slice(0, 6) : []
      const addr = Array.isArray(r.addresses) ? r.addresses.find((a: any) => a.address_purpose === 'LOCATION') || r.addresses[0] : null
      const location = [addr?.city, addr?.state].map(safe).filter(Boolean).join(', ')
      const npi = safe(r.number)
      const profileUrl = `https://npiregistry.cms.hhs.gov/provider-view/${npi}`
      return {
        id: idFor('npi', npi),
        source: 'npi',
        sourceProfileId: npi,
        displayName: name,
        headline: taxonomies[0] || 'NPI Registry provider profile',
        location,
        organization: safe(basic.organization_name),
        profileUrl,
        skills: taxonomies,
        evidence: [
          evidence('npi', 'NPI Registry match', `${name} has public NPI profile ${npi}.`, 'high', profileUrl),
          ...(taxonomies[0] ? [evidence('npi', 'Healthcare taxonomy signal', taxonomies.join(', '), 'high', profileUrl)] : []),
          ...(location ? [evidence('npi', 'Provider location signal', location, 'medium', profileUrl)] : [])
        ],
        contactSignals: [
          { type: 'profile_url', value: profileUrl, source: 'npi', verified: false, note: 'Public NPI profile URL. NPI is a provider signal, not permission for unsolicited outreach.' },
          ...(location ? [{ type: 'location' as const, value: location, source: 'npi' as const, verified: false as const, note: 'Public NPI location signal.' }] : [])
        ],
        identitySignals: buildCommonIdentity('npi', name, location, safe(basic.organization_name), taxonomies),
        refreshedAt: now(),
        raw: r
      }
    })
    return out.length ? out : [demoResult('npi', req.query, 'NPI')]
  } catch {
    return [demoResult('npi', req.query, 'NPI')]
  }
}

export async function searchOrcid(req: SourceSearchRequest): Promise<SourceResult[]> {
  const q = encodeURIComponent(req.query)
  try {
    const data = await safeJson(`https://pub.orcid.org/v3.0/search/?q=${q}&rows=${Math.min(req.limit || 6, 8)}`, { headers: { accept: 'application/json' } })
    const rows = Array.isArray(data.result) ? data.result.slice(0, req.limit || 6) : []
    const out = rows.map((row: any): SourceResult => {
      const orcid = safe(row['orcid-identifier']?.path)
      const profileUrl = `https://orcid.org/${orcid}`
      const name = safe(row['orcid-identifier']?.path) || 'ORCID researcher'
      const skills = words(req.query)
      return {
        id: idFor('orcid', orcid || name),
        source: 'orcid',
        sourceProfileId: orcid,
        displayName: name,
        headline: 'ORCID public researcher identity match.',
        profileUrl,
        skills,
        evidence: [evidence('orcid', 'ORCID identity signal', `Public ORCID profile ${orcid} matched search terms.`, 'medium', profileUrl)],
        contactSignals: [{ type: 'profile_url', value: profileUrl, source: 'orcid', verified: false, note: 'Public ORCID profile URL.' }],
        identitySignals: [{ type: 'source_url', value: profileUrl, weight: 10, source: 'orcid' }, ...skills.slice(0, 5).map(s => ({ type: 'skill' as const, value: s, weight: 3, source: 'orcid' as const }))],
        refreshedAt: now(),
        raw: row
      }
    })
    return out.length ? out : [demoResult('orcid', req.query, 'ORCID')]
  } catch {
    return [demoResult('orcid', req.query, 'ORCID')]
  }
}

export async function searchSemanticScholar(req: SourceSearchRequest): Promise<SourceResult[]> {
  const q = encodeURIComponent(req.query)
  try {
    const data = await safeJson(`https://api.semanticscholar.org/graph/v1/author/search?query=${q}&limit=${Math.min(req.limit || 6, 8)}&fields=name,affiliations,paperCount,citationCount,hIndex,homepage,url`)
    const rows = Array.isArray(data.data) ? data.data.slice(0, req.limit || 6) : []
    const out = rows.map((a: any): SourceResult => {
      const name = safe(a.name)
      const org = Array.isArray(a.affiliations) ? a.affiliations.map(safe).filter(Boolean).slice(0, 2).join(', ') : ''
      const profileUrl = safe(a.url) || `https://www.semanticscholar.org/author/${safe(a.authorId)}`
      const skills = words(`${req.query} ${org}`)
      return {
        id: idFor('semantic_scholar', safe(a.authorId) || name),
        source: 'semantic_scholar',
        sourceProfileId: safe(a.authorId),
        displayName: name,
        headline: `Semantic Scholar author with ${a.paperCount || 0} papers, ${a.citationCount || 0} citations, h-index ${a.hIndex || 0}.`,
        organization: org,
        profileUrl,
        skills,
        evidence: [
          evidence('semantic_scholar', 'Semantic Scholar author match', `${name} matched research author search for ${req.query}.`, 'medium', profileUrl),
          evidence('semantic_scholar', 'Research impact signal', `${a.paperCount || 0} papers, ${a.citationCount || 0} citations, h-index ${a.hIndex || 0}.`, Number(a.citationCount || 0) > 100 ? 'high' : 'medium', profileUrl)
        ],
        contactSignals: [{ type: 'profile_url', value: profileUrl, source: 'semantic_scholar', verified: false, note: 'Public Semantic Scholar author URL.' }],
        identitySignals: buildCommonIdentity('semantic_scholar', name, '', org, skills),
        refreshedAt: now(),
        raw: a
      }
    })
    return out.length ? out : [demoResult('semantic_scholar', req.query, 'SemanticScholar')]
  } catch {
    return [demoResult('semantic_scholar', req.query, 'SemanticScholar')]
  }
}

export async function searchArxiv(req: SourceSearchRequest): Promise<SourceResult[]> {
  const q = encodeURIComponent(`all:${req.query}`)
  try {
    const text = await fetch(`https://export.arxiv.org/api/query?search_query=${q}&start=0&max_results=${Math.min(req.limit || 6, 8)}`).then(r => r.text())
    const entries = Array.from(text.matchAll(/<entry>([\s\S]*?)<\/entry>/g)).slice(0, req.limit || 6)
    const out = entries.map((match, i): SourceResult => {
      const entry = match[1]
      const title = safe(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]).replace(/\s+/g, ' ')
      const firstAuthor = safe(entry.match(/<author>[\s\S]*?<name>(.*?)<\/name>[\s\S]*?<\/author>/)?.[1]) || 'arXiv author'
      const url = safe(entry.match(/<id>(.*?)<\/id>/)?.[1])
      const skills = words(`${req.query} ${title}`)
      return {
        id: idFor('arxiv', url.split('/').pop() || `${i}`),
        source: 'arxiv',
        sourceProfileId: url,
        displayName: firstAuthor,
        headline: `arXiv paper author. ${title}`,
        profileUrl: url,
        skills,
        evidence: [
          evidence('arxiv', 'arXiv preprint evidence', `Author appears on paper: ${title}`, 'medium', url),
          evidence('arxiv', 'Topic match', `Paper matched query: ${req.query}`, 'medium', url)
        ],
        contactSignals: [{ type: 'profile_url', value: url, source: 'arxiv', verified: false, note: 'Public arXiv paper URL, not a direct contact record.' }],
        identitySignals: buildCommonIdentity('arxiv', firstAuthor, '', '', skills),
        refreshedAt: now(),
        raw: { title, url }
      }
    })
    return out.length ? out : [demoResult('arxiv', req.query, 'arXiv')]
  } catch {
    return [demoResult('arxiv', req.query, 'arXiv')]
  }
}

export async function searchPubMed(req: SourceSearchRequest): Promise<SourceResult[]> {
  const q = encodeURIComponent(req.query)
  try {
    const data = await safeJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${q}&retmode=json&retmax=${Math.min(req.limit || 6, 8)}`)
    const ids: string[] = data?.esearchresult?.idlist || []
    if (!ids.length) return [demoResult('pubmed', req.query, 'PubMed')]
    const summaries = await safeJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`)
    return ids.map((id): SourceResult => {
      const row = summaries?.result?.[id] || {}
      const authors = Array.isArray(row.authors) ? row.authors.map((a: any) => safe(a.name)).filter(Boolean) : []
      const name = authors[0] || 'PubMed author'
      const profileUrl = `https://pubmed.ncbi.nlm.nih.gov/${id}/`
      const skills = words(`${req.query} ${row.title || ''}`)
      return {
        id: idFor('pubmed', id),
        source: 'pubmed',
        sourceProfileId: id,
        displayName: name,
        headline: `PubMed publication author. ${safe(row.title)}`,
        profileUrl,
        skills,
        evidence: [evidence('pubmed', 'PubMed publication evidence', `${name} appears on: ${safe(row.title)}`, 'medium', profileUrl)],
        contactSignals: [{ type: 'profile_url', value: profileUrl, source: 'pubmed', verified: false, note: 'Public PubMed article URL, not a direct outreach record.' }],
        identitySignals: buildCommonIdentity('pubmed', name, '', '', skills),
        refreshedAt: now(),
        raw: row
      }
    })
  } catch {
    return [demoResult('pubmed', req.query, 'PubMed')]
  }
}

export async function searchHuggingFace(req: SourceSearchRequest): Promise<SourceResult[]> {
  const q = encodeURIComponent(req.query)
  try {
    const data = await safeJson(`https://huggingface.co/api/models?search=${q}&limit=${Math.min(req.limit || 6, 8)}`)
    const models = Array.isArray(data) ? data.slice(0, req.limit || 6) : []
    const out = models.map((m: any): SourceResult => {
      const owner = safe(m.author) || safe(m.modelId).split('/')[0] || 'Hugging Face contributor'
      const modelId = safe(m.modelId)
      const profileUrl = `https://huggingface.co/${modelId}`
      const skills = Array.from(new Set([...words(req.query), ...(Array.isArray(m.tags) ? m.tags.map(safe) : [])])).slice(0, 10)
      return {
        id: idFor('huggingface', modelId || owner),
        source: 'huggingface',
        sourceProfileId: modelId,
        displayName: owner,
        headline: `Hugging Face model contributor: ${modelId}`,
        profileUrl,
        skills,
        evidence: [
          evidence('huggingface', 'Hugging Face model evidence', `${owner} is associated with model ${modelId}.`, 'medium', profileUrl),
          ...(m.downloads ? [evidence('huggingface', 'Model usage signal', `${m.downloads} downloads reported by Hugging Face API.`, 'medium', profileUrl)] : [])
        ],
        contactSignals: [{ type: 'profile_url', value: profileUrl, source: 'huggingface', verified: false, note: 'Public Hugging Face model URL.' }],
        identitySignals: buildCommonIdentity('huggingface', owner, '', '', skills),
        refreshedAt: now(),
        raw: m
      }
    })
    return out.length ? out : [demoResult('huggingface', req.query, 'HuggingFace')]
  } catch {
    return [demoResult('huggingface', req.query, 'HuggingFace')]
  }
}

export async function searchNpm(req: SourceSearchRequest): Promise<SourceResult[]> {
  const q = encodeURIComponent(req.query)
  try {
    const data = await safeJson(`https://registry.npmjs.org/-/v1/search?text=${q}&size=${Math.min(req.limit || 6, 8)}`)
    const rows = Array.isArray(data.objects) ? data.objects.slice(0, req.limit || 6) : []
    const out = rows.map((o: any): SourceResult => {
      const pkg = o.package || {}
      const maintainer = Array.isArray(pkg.maintainers) && pkg.maintainers[0] ? pkg.maintainers[0] : {}
      const name = safe(maintainer.username) || safe(pkg.publisher?.username) || safe(pkg.name)
      const profileUrl = safe(pkg.links?.npm) || `https://www.npmjs.com/package/${safe(pkg.name)}`
      const skills = Array.from(new Set([...words(req.query), ...(Array.isArray(pkg.keywords) ? pkg.keywords.map(safe) : [])])).slice(0, 10)
      return {
        id: idFor('npm', `${safe(pkg.name)}:${name}`),
        source: 'npm',
        sourceProfileId: safe(pkg.name),
        displayName: name,
        headline: `npm package maintainer/publisher for ${safe(pkg.name)}.`,
        profileUrl,
        skills,
        evidence: [
          evidence('npm', 'npm package signal', `${name} is associated with npm package ${safe(pkg.name)}.`, 'medium', profileUrl),
          ...(pkg.description ? [evidence('npm', 'Package description match', safe(pkg.description), 'low', profileUrl)] : [])
        ],
        contactSignals: [
          { type: 'profile_url', value: profileUrl, source: 'npm', verified: false, note: 'Public npm package URL.' },
          ...(maintainer.email ? [{ type: 'public_email' as const, value: safe(maintainer.email), source: 'npm' as const, verified: false as const, note: 'Public npm maintainer email. Treat as unverified and respect outreach rules.' }] : [])
        ],
        identitySignals: buildCommonIdentity('npm', name, '', '', skills),
        refreshedAt: now(),
        raw: o
      }
    })
    return out.length ? out : [demoResult('npm', req.query, 'npm')]
  } catch {
    return [demoResult('npm', req.query, 'npm')]
  }
}

export async function searchPyPi(req: SourceSearchRequest): Promise<SourceResult[]> {
  const terms = words(req.query).slice(0, 5)
  const targets = terms.length ? terms : ['python']
  const out: SourceResult[] = []
  for (const term of targets.slice(0, Math.min(req.limit || 5, 5))) {
    try {
      const data = await safeJson(`https://pypi.org/pypi/${encodeURIComponent(term)}/json`)
      const info = data.info || {}
      const name = safe(info.author) || safe(info.maintainer) || safe(info.name)
      const profileUrl = safe(info.package_url) || `https://pypi.org/project/${safe(info.name || term)}/`
      const skills = words(`${req.query} ${info.keywords || ''} ${info.summary || ''}`)
      out.push({
        id: idFor('pypi', safe(info.name || term)),
        source: 'pypi',
        sourceProfileId: safe(info.name || term),
        displayName: name || 'PyPI maintainer',
        headline: `PyPI package signal for ${safe(info.name || term)}.`,
        profileUrl,
        skills,
        evidence: [
          evidence('pypi', 'PyPI package signal', `${name || 'Maintainer'} is associated with PyPI package ${safe(info.name || term)}.`, 'medium', profileUrl),
          ...(info.summary ? [evidence('pypi', 'Package summary match', safe(info.summary), 'low', profileUrl)] : [])
        ],
        contactSignals: [{ type: 'profile_url', value: profileUrl, source: 'pypi', verified: false, note: 'Public PyPI package URL.' }],
        identitySignals: buildCommonIdentity('pypi', name || safe(info.name || term), '', '', skills),
        refreshedAt: now(),
        raw: info
      })
    } catch {
      // Package-name search is intentionally conservative. Use demo fallback below if no packages resolve.
    }
  }
  return out.length ? out : [demoResult('pypi', req.query, 'PyPI')]
}


export async function searchKaggle(req: SourceSearchRequest): Promise<SourceResult[]> {
  const skills = words(req.query)
  const queryUrl = `https://www.kaggle.com/search?q=${encodeURIComponent(req.query)}`
  return [{ id: idFor('kaggle', `search-${normId(req.query)}`), source: 'kaggle', sourceProfileId: `search:${req.query}`, displayName: `Kaggle search: ${req.query}`, headline: 'Manual-safe Kaggle discovery lane for data science and ML profiles, notebooks, datasets, and competitions.', profileUrl: queryUrl, skills, evidence: [evidence('kaggle', 'Kaggle discovery lane', `Open Kaggle search for ${req.query}. Use results as evidence breadcrumbs, not verified candidate records.`, 'low', queryUrl)], contactSignals: [{ type: 'profile_url', value: queryUrl, source: 'kaggle', verified: false, note: 'Manual-safe public Kaggle search URL.' }], identitySignals: skills.slice(0, 5).map(s => ({ type: 'skill' as const, value: s, weight: 3, source: 'kaggle' as const })), refreshedAt: now(), raw: { mode: 'manual_safe_search', queryUrl } }]
}
export async function searchDevTo(req: SourceSearchRequest): Promise<SourceResult[]> {
  try { const data = await safeJson(`https://dev.to/api/articles?tag=${encodeURIComponent(words(req.query)[0] || 'javascript')}&per_page=${Math.min(req.limit || 6, 8)}`); const rows = Array.isArray(data) ? data.slice(0, req.limit || 6) : []; const out = rows.map((a: any): SourceResult => { const user = a.user || {}; const name = safe(user.name) || safe(user.username) || 'DEV author'; const profileUrl = `https://dev.to/${safe(user.username)}`; const skills = Array.from(new Set([...words(req.query), ...(Array.isArray(a.tag_list) ? a.tag_list.map(safe) : [])])).slice(0, 10); return { id: idFor('devto', safe(user.username) || safe(a.id)), source: 'devto', sourceProfileId: safe(user.username) || safe(a.id), displayName: name, headline: `DEV Community author. Recent article: ${safe(a.title)}`, profileUrl, avatarUrl: safe(user.profile_image), skills, evidence: [evidence('devto', 'Technical writing signal', `${name} authored: ${safe(a.title)}`, 'medium', safe(a.url) || profileUrl), evidence('devto', 'Topic/tag signal', skills.join(', '), 'low', safe(a.url) || profileUrl)], contactSignals: [{ type: 'profile_url', value: profileUrl, source: 'devto', verified: false, note: 'Public DEV Community profile URL.' }], identitySignals: buildCommonIdentity('devto', name, '', '', skills), refreshedAt: now(), raw: a } }); return out.length ? out : [demoResult('devto', req.query, 'DEV')] } catch { return [demoResult('devto', req.query, 'DEV')] }
}
export async function searchDockerHub(req: SourceSearchRequest): Promise<SourceResult[]> {
  try { const data = await safeJson(`https://hub.docker.com/v2/search/repositories/?query=${encodeURIComponent(req.query)}&page_size=${Math.min(req.limit || 6, 8)}`); const rows = Array.isArray(data.results) ? data.results.slice(0, req.limit || 6) : []; const out = rows.map((r: any): SourceResult => { const repo = safe(r.repo_name); const owner = repo.split('/')[0] || repo; const profileUrl = `https://hub.docker.com/r/${repo}`; const skills = words(`${req.query} docker container kubernetes ${safe(r.short_description)}`); return { id: idFor('dockerhub', repo), source: 'dockerhub', sourceProfileId: repo, displayName: owner, headline: `Docker Hub repository signal: ${repo}`, profileUrl, skills, evidence: [evidence('dockerhub', 'Container/package evidence', `${owner} is associated with Docker Hub repository ${repo}.`, 'medium', profileUrl), ...(r.star_count ? [evidence('dockerhub', 'Repository usage signal', `${r.star_count} stars reported by Docker Hub.`, 'low', profileUrl)] : [])], contactSignals: [{ type: 'profile_url', value: profileUrl, source: 'dockerhub', verified: false, note: 'Public Docker Hub repository/profile URL.' }], identitySignals: buildCommonIdentity('dockerhub', owner, '', '', skills), refreshedAt: now(), raw: r } }); return out.length ? out : [demoResult('dockerhub', req.query, 'DockerHub')] } catch { return [demoResult('dockerhub', req.query, 'DockerHub')] }
}
export async function searchCrates(req: SourceSearchRequest): Promise<SourceResult[]> {
  try { const data = await safeJson(`https://crates.io/api/v1/crates?q=${encodeURIComponent(req.query)}&per_page=${Math.min(req.limit || 6, 8)}`); const rows = Array.isArray(data.crates) ? data.crates.slice(0, req.limit || 6) : []; const out = rows.map((c: any): SourceResult => { const name = safe(c.name); const profileUrl = `https://crates.io/crates/${name}`; const skills = words(`${req.query} rust crate ${safe(c.description)}`); return { id: idFor('crates', name), source: 'crates', sourceProfileId: name, displayName: safe(c.id) || name, headline: `Rust crates.io package signal: ${name}`, profileUrl, skills, evidence: [evidence('crates', 'Rust package signal', `${name} matched crates.io search for ${req.query}.`, 'medium', profileUrl), ...(c.downloads ? [evidence('crates', 'Crate usage signal', `${c.downloads} downloads reported.`, 'low', profileUrl)] : [])], contactSignals: [{ type: 'profile_url', value: profileUrl, source: 'crates', verified: false, note: 'Public crates.io package URL.' }], identitySignals: buildCommonIdentity('crates', name, '', '', skills), refreshedAt: now(), raw: c } }); return out.length ? out : [demoResult('crates', req.query, 'Crates')] } catch { return [demoResult('crates', req.query, 'Crates')] }
}
export async function searchRubyGems(req: SourceSearchRequest): Promise<SourceResult[]> {
  try { const data = await safeJson(`https://rubygems.org/api/v1/search.json?query=${encodeURIComponent(req.query)}`); const rows = Array.isArray(data) ? data.slice(0, Math.min(req.limit || 6, 8)) : []; const out = rows.map((g: any): SourceResult => { const name = safe(g.name); const owner = safe(g.authors) || name; const profileUrl = safe(g.project_uri) || `https://rubygems.org/gems/${name}`; const skills = words(`${req.query} ruby rails gem ${safe(g.info)}`); return { id: idFor('rubygems', name), source: 'rubygems', sourceProfileId: name, displayName: owner, headline: `RubyGems package signal: ${name}`, profileUrl, skills, evidence: [evidence('rubygems', 'Ruby package signal', `${owner} is associated with RubyGem ${name}.`, 'medium', profileUrl), ...(g.downloads ? [evidence('rubygems', 'Gem usage signal', `${g.downloads} downloads reported.`, 'low', profileUrl)] : [])], contactSignals: [{ type: 'profile_url', value: profileUrl, source: 'rubygems', verified: false, note: 'Public RubyGems package URL.' }], identitySignals: buildCommonIdentity('rubygems', owner, '', '', skills), refreshedAt: now(), raw: g } }); return out.length ? out : [demoResult('rubygems', req.query, 'RubyGems')] } catch { return [demoResult('rubygems', req.query, 'RubyGems')] }
}
export async function searchResumeXray(req: SourceSearchRequest): Promise<SourceResult[]> {
  const q = encodeURIComponent(`("resume" OR "cv") (${req.query}) ${req.location || ''} (filetype:pdf OR filetype:doc OR filetype:docx OR intitle:resume OR inurl:resume)`); const googleUrl = `https://www.google.com/search?q=${q}`; const bingUrl = `https://www.bing.com/search?q=${q}`; const skills = words(req.query); return [{ id: idFor('resume_xray', `resume-${normId(req.query)}-${normId(req.location || '')}`), source: 'resume_xray', sourceProfileId: `resume-xray:${req.query}:${req.location || ''}`, displayName: `Public resume search: ${req.query}`, headline: 'Manual-safe public resume/CV discovery lane. Opens search results; it does not scrape resumes or store personal data automatically.', location: req.location || '', profileUrl: googleUrl, skills, evidence: [evidence('resume_xray', 'Public resume X-Ray lane', `Prepared Google/Bing public resume search for ${req.query}. Recruiter must manually review and confirm every result.`, 'low', googleUrl)], contactSignals: [{ type: 'profile_url', value: googleUrl, source: 'resume_xray', verified: false, note: 'Google public resume search URL.' }, { type: 'profile_url', value: bingUrl, source: 'resume_xray', verified: false, note: 'Bing public resume search URL.' }], identitySignals: skills.slice(0, 5).map(s => ({ type: 'skill' as const, value: s, weight: 3, source: 'resume_xray' as const })), refreshedAt: now(), raw: { googleUrl, bingUrl, note: 'Manual-safe discovery only. No scraping, no auto-import.' } }]
}

export async function searchSources(req: SourceSearchRequest) {
  const selected = req.sources?.length ? req.sources : ['github', 'stackoverflow', 'openalex', 'npi'] as SourceName[]
  const tasks = selected.map(async source => {
    if (source === 'github') return searchGitHub(req)
    if (source === 'stackoverflow') return searchStackOverflow(req)
    if (source === 'openalex') return searchOpenAlex(req)
    if (source === 'npi') return searchNpi(req)
    if (source === 'orcid') return searchOrcid(req)
    if (source === 'semantic_scholar') return searchSemanticScholar(req)
    if (source === 'arxiv') return searchArxiv(req)
    if (source === 'pubmed') return searchPubMed(req)
    if (source === 'huggingface') return searchHuggingFace(req)
    if (source === 'npm') return searchNpm(req)
    if (source === 'pypi') return searchPyPi(req)
    if (source === 'kaggle') return searchKaggle(req)
    if (source === 'devto') return searchDevTo(req)
    if (source === 'dockerhub') return searchDockerHub(req)
    if (source === 'crates') return searchCrates(req)
    if (source === 'rubygems') return searchRubyGems(req)
    if (source === 'resume_xray') return searchResumeXray(req)
    return []
  })
  const settled = await Promise.allSettled(tasks)
  const results = settled.flatMap(s => s.status === 'fulfilled' ? s.value : [])
  const warnings = settled.flatMap((s, i) => s.status === 'rejected' ? [`${selected[i]} failed. Demo fallback may be used.`] : [])
  return { results, warnings, searchedSources: selected }
}
