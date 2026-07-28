import { classifySourceEntity } from './entity-classification'
import { EvidenceItem, SourceName, SourceResult, SourceSearchRequest } from './source-types'

const now = () => new Date().toISOString()
const safe = (value: unknown) => String(value || '').trim()
const words = (text: string) => Array.from(new Set(text.toLowerCase().split(/[^a-z0-9+#.]+/).filter(w => w.length > 2))).slice(0, 18)
const idFor = (source: SourceName, id: string) => `${source}:${id}`
const normId = (value: string) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'search'

const evidence = (
  source: SourceName,
  label: string,
  detail: string,
  confidence: EvidenceItem['confidence'] = 'medium',
  url?: string,
): EvidenceItem => ({
  id: `${source}-${Math.random().toString(36).slice(2, 10)}`,
  label,
  detail,
  source,
  confidence,
  url,
  observedAt: now(),
})

async function safeJson(url: string, init?: RequestInit) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6500)
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { accept: 'application/json', ...(init?.headers || {}) },
    })
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
    return await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

type UnclassifiedResult = Omit<SourceResult, 'entityKind'>

function classified(result: UnclassifiedResult): SourceResult {
  return {
    ...result,
    entityKind: classifySourceEntity(result),
  }
}

function buildCommonIdentity(source: SourceName, name: string, location = '', organization = '', skills: string[] = []) {
  return [
    ...(name ? [{ type: 'name' as const, value: name, weight: 15, source }] : []),
    ...(location ? [{ type: 'location' as const, value: location, weight: 12, source }] : []),
    ...(organization ? [{ type: 'organization' as const, value: organization, weight: 10, source }] : []),
    ...skills.slice(0, 5).map(skill => ({ type: 'skill' as const, value: skill, weight: 3, source })),
  ]
}

function buildArtifactSignals(source: SourceName, profileUrl: string, skills: string[]) {
  return [
    ...(profileUrl ? [{ type: 'source_url' as const, value: profileUrl, weight: 10, source }] : []),
    ...skills.slice(0, 5).map(skill => ({ type: 'skill' as const, value: skill, weight: 3, source })),
  ]
}

export async function searchGitHub(req: SourceSearchRequest): Promise<SourceResult[]> {
  const query = encodeURIComponent(`${req.query} ${req.location || ''}`.trim())
  try {
    const data = await safeJson(`https://api.github.com/search/users?q=${query}&per_page=${Math.min(req.limit || 6, 8)}`)
    const users = Array.isArray(data.items) ? data.items.slice(0, req.limit || 6) : []
    const results: SourceResult[] = []

    for (const user of users) {
      let detail: any = null
      try { detail = await safeJson(user.url) } catch { detail = null }
      const login = safe(user.login)
      const name = safe(detail?.name) || login
      const profileUrl = safe(user.html_url)
      const skills = words(`${req.query} ${detail?.bio || ''} ${detail?.company || ''}`)
      const raw = detail || user

      results.push(classified({
        id: idFor('github', login),
        source: 'github',
        sourceProfileId: login,
        displayName: name,
        headline: safe(detail?.bio) || `GitHub profile matching ${req.query}`,
        location: safe(detail?.location),
        organization: safe(detail?.company),
        profileUrl,
        avatarUrl: safe(user.avatar_url),
        skills,
        evidence: [
          evidence('github', 'Public GitHub profile match', `${name} matched GitHub search for ${req.query}.`, 'medium', profileUrl),
          ...(detail?.public_repos ? [evidence('github', 'Repository footprint', `${detail.public_repos} public repositories visible on profile.`, 'medium', profileUrl)] : []),
          ...(detail?.blog ? [evidence('github', 'Public website signal', `Profile lists website: ${detail.blog}`, 'low', detail.blog)] : []),
        ],
        contactSignals: [
          ...(detail?.email ? [{ type: 'public_email' as const, value: safe(detail.email), source: 'github' as const, verified: false as const, note: 'Public GitHub email. Treat as unverified until recruiter confirms.' }] : []),
          ...(detail?.blog ? [{ type: 'website' as const, value: safe(detail.blog), source: 'github' as const, verified: false as const, note: 'Public website listed on GitHub profile.' }] : []),
          { type: 'profile_url', value: profileUrl, source: 'github', verified: false, note: 'Public GitHub profile URL.' },
        ],
        identitySignals: [
          ...buildCommonIdentity('github', name, safe(detail?.location), safe(detail?.company), skills),
          ...(detail?.blog ? [{ type: 'website' as const, value: safe(detail.blog), weight: 25, source: 'github' as const }] : []),
        ],
        refreshedAt: now(),
        raw,
      }))
    }

    return results
  } catch {
    return []
  }
}

export async function searchStackOverflow(req: SourceSearchRequest): Promise<SourceResult[]> {
  const query = encodeURIComponent(req.query)
  try {
    const data = await safeJson(`https://api.stackexchange.com/2.3/users?order=desc&sort=reputation&inname=${query}&site=stackoverflow&pagesize=${Math.min(req.limit || 6, 8)}&filter=default`)
    const users = Array.isArray(data.items) ? data.items.slice(0, req.limit || 6) : []
    return users.map((user: any) => {
      const name = safe(user.display_name)
      const profileUrl = safe(user.link)
      const skills = words(req.query)
      const location = safe(user.location)
      return classified({
        id: idFor('stackoverflow', safe(user.user_id)),
        source: 'stackoverflow',
        sourceProfileId: safe(user.user_id),
        displayName: name,
        headline: `Stack Overflow user with ${user.reputation || 0} reputation.`,
        location,
        profileUrl,
        avatarUrl: safe(user.profile_image),
        skills,
        evidence: [
          evidence('stackoverflow', 'Stack Overflow reputation signal', `${name} has ${user.reputation || 0} reputation.`, Number(user.reputation || 0) > 1000 ? 'high' : 'medium', profileUrl),
          evidence('stackoverflow', 'Q&A profile match', `Profile surfaced from Stack Overflow user search for ${req.query}.`, 'medium', profileUrl),
        ],
        contactSignals: [
          { type: 'profile_url', value: profileUrl, source: 'stackoverflow', verified: false, note: 'Public Stack Overflow profile URL.' },
          ...(user.website_url ? [{ type: 'website' as const, value: safe(user.website_url), source: 'stackoverflow' as const, verified: false as const, note: 'Public website listed on Stack Overflow profile.' }] : []),
        ],
        identitySignals: buildCommonIdentity('stackoverflow', name, location, '', skills),
        refreshedAt: now(),
        raw: user,
      })
    })
  } catch {
    return []
  }
}

export async function searchOpenAlex(req: SourceSearchRequest): Promise<SourceResult[]> {
  const query = encodeURIComponent(req.query)
  try {
    const data = await safeJson(`https://api.openalex.org/authors?search=${query}&per-page=${Math.min(req.limit || 6, 8)}`)
    const authors = Array.isArray(data.results) ? data.results.slice(0, req.limit || 6) : []
    return authors.map((author: any) => {
      const name = safe(author.display_name)
      const profileUrl = safe(author.id)
      const concepts = Array.isArray(author.x_concepts) ? author.x_concepts.map((concept: any) => safe(concept.display_name)).filter(Boolean).slice(0, 8) : []
      const institution = safe(author.last_known_institution?.display_name)
      return classified({
        id: idFor('openalex', safe(author.id).split('/').pop() || name),
        source: 'openalex',
        sourceProfileId: safe(author.id),
        displayName: name,
        headline: `OpenAlex author with ${author.works_count || 0} works and ${author.cited_by_count || 0} citations.`,
        organization: institution,
        profileUrl,
        skills: concepts.length ? concepts : words(req.query),
        evidence: [
          evidence('openalex', 'Research author match', `${name} matched OpenAlex author search for ${req.query}.`, 'medium', profileUrl),
          evidence('openalex', 'Publication footprint', `${author.works_count || 0} works and ${author.cited_by_count || 0} citations.`, Number(author.cited_by_count || 0) > 100 ? 'high' : 'medium', profileUrl),
          ...(institution ? [evidence('openalex', 'Institution signal', institution, 'medium', profileUrl)] : []),
        ],
        contactSignals: [
          { type: 'profile_url', value: profileUrl, source: 'openalex', verified: false, note: 'Public OpenAlex author URL.' },
          ...(institution ? [{ type: 'organization' as const, value: institution, source: 'openalex' as const, verified: false as const, note: 'Public institution signal from OpenAlex.' }] : []),
        ],
        identitySignals: buildCommonIdentity('openalex', name, '', institution, concepts),
        refreshedAt: now(),
        raw: author,
      })
    })
  } catch {
    return []
  }
}

export async function searchNpi(req: SourceSearchRequest): Promise<SourceResult[]> {
  const terms = req.query.trim().split(/\s+/)
  const first = encodeURIComponent(terms[0] || '')
  const last = encodeURIComponent(terms.length > 1 ? terms[terms.length - 1] : terms[0] || '')
  const city = encodeURIComponent(req.location || '')
  const taxonomyDescription = encodeURIComponent(req.query.includes('Nurse') || req.query.includes('RN') ? 'Registered Nurse' : req.query)
  const url = `https://npiregistry.cms.hhs.gov/api/?version=2.1&limit=${Math.min(req.limit || 6, 8)}${first ? `&first_name=${first}` : ''}${last ? `&last_name=${last}` : ''}${city ? `&city=${city}` : ''}${taxonomyDescription ? `&taxonomy_description=${taxonomyDescription}` : ''}`

  try {
    const data = await safeJson(url)
    const rows = Array.isArray(data.results) ? data.results.slice(0, req.limit || 6) : []
    return rows.map((row: any) => {
      const basic = row.basic || {}
      const name = [basic.first_name, basic.middle_name, basic.last_name].map(safe).filter(Boolean).join(' ') || safe(basic.organization_name) || 'NPI provider'
      const taxonomies = Array.isArray(row.taxonomies) ? row.taxonomies.map((taxonomy: any) => safe(taxonomy.desc || taxonomy.code)).filter(Boolean).slice(0, 6) : []
      const address = Array.isArray(row.addresses) ? row.addresses.find((item: any) => item.address_purpose === 'LOCATION') || row.addresses[0] : null
      const location = [address?.city, address?.state].map(safe).filter(Boolean).join(', ')
      const npi = safe(row.number)
      const profileUrl = `https://npiregistry.cms.hhs.gov/provider-view/${npi}`
      return classified({
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
          ...(location ? [evidence('npi', 'Provider location signal', location, 'medium', profileUrl)] : []),
        ],
        contactSignals: [
          { type: 'profile_url', value: profileUrl, source: 'npi', verified: false, note: 'Public NPI profile URL. NPI is a provider signal, not permission for unsolicited outreach.' },
          ...(location ? [{ type: 'location' as const, value: location, source: 'npi' as const, verified: false as const, note: 'Public NPI location signal.' }] : []),
        ],
        identitySignals: buildCommonIdentity('npi', name, location, safe(basic.organization_name), taxonomies),
        refreshedAt: now(),
        raw: row,
      })
    })
  } catch {
    return []
  }
}

export async function searchOrcid(req: SourceSearchRequest): Promise<SourceResult[]> {
  const query = encodeURIComponent(req.query)
  try {
    const data = await safeJson(`https://pub.orcid.org/v3.0/search/?q=${query}&rows=${Math.min(req.limit || 6, 8)}`, { headers: { accept: 'application/json' } })
    const rows = Array.isArray(data.result) ? data.result.slice(0, req.limit || 6) : []
    return rows.map((row: any) => {
      const orcid = safe(row['orcid-identifier']?.path)
      const profileUrl = `https://orcid.org/${orcid}`
      const skills = words(req.query)
      return classified({
        id: idFor('orcid', orcid || 'researcher'),
        source: 'orcid',
        sourceProfileId: orcid,
        displayName: orcid || 'ORCID researcher',
        headline: 'ORCID public researcher identity match.',
        profileUrl,
        skills,
        evidence: [evidence('orcid', 'ORCID identity signal', `Public ORCID profile ${orcid} matched search terms.`, 'medium', profileUrl)],
        contactSignals: [{ type: 'profile_url', value: profileUrl, source: 'orcid', verified: false, note: 'Public ORCID profile URL.' }],
        identitySignals: [{ type: 'source_url', value: profileUrl, weight: 10, source: 'orcid' }, ...skills.slice(0, 5).map(skill => ({ type: 'skill' as const, value: skill, weight: 3, source: 'orcid' as const }))],
        refreshedAt: now(),
        raw: row,
      })
    })
  } catch {
    return []
  }
}

export async function searchSemanticScholar(req: SourceSearchRequest): Promise<SourceResult[]> {
  const query = encodeURIComponent(req.query)
  try {
    const data = await safeJson(`https://api.semanticscholar.org/graph/v1/author/search?query=${query}&limit=${Math.min(req.limit || 6, 8)}&fields=name,affiliations,paperCount,citationCount,hIndex,homepage,url`)
    const rows = Array.isArray(data.data) ? data.data.slice(0, req.limit || 6) : []
    return rows.map((author: any) => {
      const name = safe(author.name)
      const organization = Array.isArray(author.affiliations) ? author.affiliations.map(safe).filter(Boolean).slice(0, 2).join(', ') : ''
      const profileUrl = safe(author.url) || `https://www.semanticscholar.org/author/${safe(author.authorId)}`
      const skills = words(`${req.query} ${organization}`)
      return classified({
        id: idFor('semantic_scholar', safe(author.authorId) || name),
        source: 'semantic_scholar',
        sourceProfileId: safe(author.authorId),
        displayName: name,
        headline: `Semantic Scholar author with ${author.paperCount || 0} papers, ${author.citationCount || 0} citations, h-index ${author.hIndex || 0}.`,
        organization,
        profileUrl,
        skills,
        evidence: [
          evidence('semantic_scholar', 'Semantic Scholar author match', `${name} matched research author search for ${req.query}.`, 'medium', profileUrl),
          evidence('semantic_scholar', 'Research impact signal', `${author.paperCount || 0} papers, ${author.citationCount || 0} citations, h-index ${author.hIndex || 0}.`, Number(author.citationCount || 0) > 100 ? 'high' : 'medium', profileUrl),
        ],
        contactSignals: [{ type: 'profile_url', value: profileUrl, source: 'semantic_scholar', verified: false, note: 'Public Semantic Scholar author URL.' }],
        identitySignals: buildCommonIdentity('semantic_scholar', name, '', organization, skills),
        refreshedAt: now(),
        raw: author,
      })
    })
  } catch {
    return []
  }
}

export async function searchArxiv(req: SourceSearchRequest): Promise<SourceResult[]> {
  const query = encodeURIComponent(`all:${req.query}`)
  try {
    const response = await fetch(`https://export.arxiv.org/api/query?search_query=${query}&start=0&max_results=${Math.min(req.limit || 6, 8)}`)
    if (!response.ok) return []
    const text = await response.text()
    const entries = Array.from(text.matchAll(/<entry>([\s\S]*?)<\/entry>/g)).slice(0, req.limit || 6)
    return entries.map((match, index) => {
      const entry = match[1]
      const title = safe(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]).replace(/\s+/g, ' ')
      const firstAuthor = safe(entry.match(/<author>[\s\S]*?<name>(.*?)<\/name>[\s\S]*?<\/author>/)?.[1]) || 'arXiv author'
      const url = safe(entry.match(/<id>(.*?)<\/id>/)?.[1])
      const skills = words(`${req.query} ${title}`)
      return classified({
        id: idFor('arxiv', url.split('/').pop() || `${index}`),
        source: 'arxiv',
        sourceProfileId: url,
        displayName: firstAuthor,
        headline: `arXiv paper author. ${title}`,
        profileUrl: url,
        skills,
        evidence: [
          evidence('arxiv', 'arXiv preprint evidence', `Author appears on paper: ${title}`, 'medium', url),
          evidence('arxiv', 'Topic match', `Paper matched query: ${req.query}`, 'medium', url),
        ],
        contactSignals: [{ type: 'profile_url', value: url, source: 'arxiv', verified: false, note: 'Public arXiv paper URL, not a direct contact record.' }],
        identitySignals: buildCommonIdentity('arxiv', firstAuthor, '', '', skills),
        refreshedAt: now(),
        raw: { title, url },
      })
    })
  } catch {
    return []
  }
}

export async function searchPubMed(req: SourceSearchRequest): Promise<SourceResult[]> {
  const query = encodeURIComponent(req.query)
  try {
    const data = await safeJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${query}&retmode=json&retmax=${Math.min(req.limit || 6, 8)}`)
    const ids: string[] = data?.esearchresult?.idlist || []
    if (!ids.length) return []
    const summaries = await safeJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`)
    return ids.map(id => {
      const row = summaries?.result?.[id] || {}
      const authors = Array.isArray(row.authors) ? row.authors.map((author: any) => safe(author.name)).filter(Boolean) : []
      const name = authors[0] || 'PubMed author'
      const profileUrl = `https://pubmed.ncbi.nlm.nih.gov/${id}/`
      const skills = words(`${req.query} ${row.title || ''}`)
      return classified({
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
        raw: row,
      })
    })
  } catch {
    return []
  }
}

export async function searchHuggingFace(req: SourceSearchRequest): Promise<SourceResult[]> {
  const query = encodeURIComponent(req.query)
  try {
    const data = await safeJson(`https://huggingface.co/api/models?search=${query}&limit=${Math.min(req.limit || 6, 8)}`)
    const models = Array.isArray(data) ? data.slice(0, req.limit || 6) : []
    return models.map((model: any) => {
      const modelId = safe(model.modelId)
      const owner = safe(model.author) || modelId.split('/')[0]
      const profileUrl = `https://huggingface.co/${modelId}`
      const skills = Array.from(new Set([...words(req.query), ...(Array.isArray(model.tags) ? model.tags.map(safe) : [])])).slice(0, 10)
      return classified({
        id: idFor('huggingface', modelId || owner),
        source: 'huggingface',
        sourceProfileId: modelId,
        displayName: modelId || 'Hugging Face model',
        headline: 'Hugging Face model artifact.',
        profileUrl,
        skills,
        evidence: [
          evidence('huggingface', 'Hugging Face model evidence', `${owner || 'An account'} is associated with model ${modelId}.`, 'medium', profileUrl),
          ...(model.downloads ? [evidence('huggingface', 'Model usage signal', `${model.downloads} downloads reported by Hugging Face API.`, 'medium', profileUrl)] : []),
        ],
        contactSignals: [{ type: 'profile_url', value: profileUrl, source: 'huggingface', verified: false, note: 'Public Hugging Face model URL.' }],
        identitySignals: buildArtifactSignals('huggingface', profileUrl, skills),
        refreshedAt: now(),
        raw: model,
      })
    })
  } catch {
    return []
  }
}

export async function searchNpm(req: SourceSearchRequest): Promise<SourceResult[]> {
  const query = encodeURIComponent(req.query)
  try {
    const data = await safeJson(`https://registry.npmjs.org/-/v1/search?text=${query}&size=${Math.min(req.limit || 6, 8)}`)
    const rows = Array.isArray(data.objects) ? data.objects.slice(0, req.limit || 6) : []
    return rows.map((item: any) => {
      const pkg = item.package || {}
      const maintainer = Array.isArray(pkg.maintainers) && pkg.maintainers[0] ? pkg.maintainers[0] : {}
      const maintainerName = safe(maintainer.username) || safe(pkg.publisher?.username)
      const packageName = safe(pkg.name)
      const profileUrl = safe(pkg.links?.npm) || `https://www.npmjs.com/package/${packageName}`
      const skills = Array.from(new Set([...words(req.query), ...(Array.isArray(pkg.keywords) ? pkg.keywords.map(safe) : [])])).slice(0, 10)
      return classified({
        id: idFor('npm', packageName),
        source: 'npm',
        sourceProfileId: packageName,
        displayName: packageName,
        headline: 'npm package artifact.',
        profileUrl,
        skills,
        evidence: [
          evidence('npm', 'npm package signal', `${packageName} matched the search.`, 'medium', profileUrl),
          ...(maintainerName ? [evidence('npm', 'Maintainer association', `${maintainerName} is publicly associated with ${packageName}. This is evidence, not a confirmed candidate identity.`, 'low', profileUrl)] : []),
          ...(pkg.description ? [evidence('npm', 'Package description match', safe(pkg.description), 'low', profileUrl)] : []),
        ],
        contactSignals: [{ type: 'profile_url', value: profileUrl, source: 'npm', verified: false, note: 'Public npm package URL.' }],
        identitySignals: buildArtifactSignals('npm', profileUrl, skills),
        refreshedAt: now(),
        raw: item,
      })
    })
  } catch {
    return []
  }
}

export async function searchPyPi(req: SourceSearchRequest): Promise<SourceResult[]> {
  const terms = words(req.query).slice(0, 5)
  const targets = terms.length ? terms : ['python']
  const results: SourceResult[] = []

  for (const term of targets.slice(0, Math.min(req.limit || 5, 5))) {
    try {
      const data = await safeJson(`https://pypi.org/pypi/${encodeURIComponent(term)}/json`)
      const info = data.info || {}
      const packageName = safe(info.name || term)
      const maintainerName = safe(info.author) || safe(info.maintainer)
      const profileUrl = safe(info.package_url) || `https://pypi.org/project/${packageName}/`
      const skills = words(`${req.query} ${info.keywords || ''} ${info.summary || ''}`)
      results.push(classified({
        id: idFor('pypi', packageName),
        source: 'pypi',
        sourceProfileId: packageName,
        displayName: packageName,
        headline: 'PyPI package artifact.',
        profileUrl,
        skills,
        evidence: [
          evidence('pypi', 'PyPI package signal', `${packageName} matched the search.`, 'medium', profileUrl),
          ...(maintainerName ? [evidence('pypi', 'Maintainer association', `${maintainerName} is publicly associated with ${packageName}. This is evidence, not a confirmed candidate identity.`, 'low', profileUrl)] : []),
          ...(info.summary ? [evidence('pypi', 'Package summary match', safe(info.summary), 'low', profileUrl)] : []),
        ],
        contactSignals: [{ type: 'profile_url', value: profileUrl, source: 'pypi', verified: false, note: 'Public PyPI package URL.' }],
        identitySignals: buildArtifactSignals('pypi', profileUrl, skills),
        refreshedAt: now(),
        raw: info,
      }))
    } catch {
      // Package-name search is intentionally conservative. A failed lookup is
      // represented by an empty result, never a generated candidate.
    }
  }

  return results
}

export async function searchKaggle(req: SourceSearchRequest): Promise<SourceResult[]> {
  const skills = words(req.query)
  const queryUrl = `https://www.kaggle.com/search?q=${encodeURIComponent(req.query)}`
  return [classified({
    id: idFor('kaggle', `search-${normId(req.query)}`),
    source: 'kaggle',
    sourceProfileId: `search:${req.query}`,
    displayName: `Kaggle search: ${req.query}`,
    headline: 'Manual-safe Kaggle discovery lane for profiles, notebooks, datasets, and competitions.',
    profileUrl: queryUrl,
    skills,
    evidence: [evidence('kaggle', 'Kaggle discovery lane', `Open Kaggle search for ${req.query}. Recruiters must review the results and confirm any person identity.`, 'low', queryUrl)],
    contactSignals: [{ type: 'profile_url', value: queryUrl, source: 'kaggle', verified: false, note: 'Manual-safe public Kaggle search URL.' }],
    identitySignals: skills.slice(0, 5).map(skill => ({ type: 'skill' as const, value: skill, weight: 3, source: 'kaggle' as const })),
    refreshedAt: now(),
    raw: { mode: 'manual_safe_search', queryUrl },
  })]
}

export async function searchDevTo(req: SourceSearchRequest): Promise<SourceResult[]> {
  try {
    const data = await safeJson(`https://dev.to/api/articles?tag=${encodeURIComponent(words(req.query)[0] || 'javascript')}&per_page=${Math.min(req.limit || 6, 8)}`)
    const rows = Array.isArray(data) ? data.slice(0, req.limit || 6) : []
    return rows.map((article: any) => {
      const user = article.user || {}
      const name = safe(user.name) || safe(user.username) || 'DEV account'
      const profileUrl = `https://dev.to/${safe(user.username)}`
      const skills = Array.from(new Set([...words(req.query), ...(Array.isArray(article.tag_list) ? article.tag_list.map(safe) : [])])).slice(0, 10)
      return classified({
        id: idFor('devto', safe(user.username) || safe(article.id)),
        source: 'devto',
        sourceProfileId: safe(user.username) || safe(article.id),
        displayName: name,
        headline: `DEV Community account. Recent article: ${safe(article.title)}`,
        profileUrl,
        avatarUrl: safe(user.profile_image),
        skills,
        evidence: [
          evidence('devto', 'Technical writing signal', `${name} authored: ${safe(article.title)}`, 'medium', safe(article.url) || profileUrl),
          evidence('devto', 'Topic/tag signal', skills.join(', '), 'low', safe(article.url) || profileUrl),
        ],
        contactSignals: [{ type: 'profile_url', value: profileUrl, source: 'devto', verified: false, note: 'Public DEV Community account URL.' }],
        identitySignals: buildCommonIdentity('devto', name, '', '', skills),
        refreshedAt: now(),
        raw: article,
      })
    })
  } catch {
    return []
  }
}

export async function searchDockerHub(req: SourceSearchRequest): Promise<SourceResult[]> {
  try {
    const data = await safeJson(`https://hub.docker.com/v2/search/repositories/?query=${encodeURIComponent(req.query)}&page_size=${Math.min(req.limit || 6, 8)}`)
    const rows = Array.isArray(data.results) ? data.results.slice(0, req.limit || 6) : []
    return rows.map((repository: any) => {
      const repo = safe(repository.repo_name)
      const owner = repo.split('/')[0] || repo
      const profileUrl = `https://hub.docker.com/r/${repo}`
      const skills = words(`${req.query} docker container kubernetes ${safe(repository.short_description)}`)
      return classified({
        id: idFor('dockerhub', repo),
        source: 'dockerhub',
        sourceProfileId: repo,
        displayName: repo,
        headline: 'Docker Hub repository artifact.',
        profileUrl,
        skills,
        evidence: [
          evidence('dockerhub', 'Container repository evidence', `${repo} matched the search.`, 'medium', profileUrl),
          evidence('dockerhub', 'Owner association', `${owner} is associated with Docker Hub repository ${repo}. This does not confirm a person identity.`, 'low', profileUrl),
          ...(repository.star_count ? [evidence('dockerhub', 'Repository usage signal', `${repository.star_count} stars reported by Docker Hub.`, 'low', profileUrl)] : []),
        ],
        contactSignals: [{ type: 'profile_url', value: profileUrl, source: 'dockerhub', verified: false, note: 'Public Docker Hub repository URL.' }],
        identitySignals: buildArtifactSignals('dockerhub', profileUrl, skills),
        refreshedAt: now(),
        raw: repository,
      })
    })
  } catch {
    return []
  }
}

export async function searchCrates(req: SourceSearchRequest): Promise<SourceResult[]> {
  try {
    const data = await safeJson(`https://crates.io/api/v1/crates?q=${encodeURIComponent(req.query)}&per_page=${Math.min(req.limit || 6, 8)}`)
    const rows = Array.isArray(data.crates) ? data.crates.slice(0, req.limit || 6) : []
    return rows.map((crate: any) => {
      const name = safe(crate.name)
      const profileUrl = `https://crates.io/crates/${name}`
      const skills = words(`${req.query} rust crate ${safe(crate.description)}`)
      return classified({
        id: idFor('crates', name),
        source: 'crates',
        sourceProfileId: name,
        displayName: name,
        headline: 'crates.io package artifact.',
        profileUrl,
        skills,
        evidence: [
          evidence('crates', 'Rust package signal', `${name} matched crates.io search for ${req.query}.`, 'medium', profileUrl),
          ...(crate.downloads ? [evidence('crates', 'Crate usage signal', `${crate.downloads} downloads reported.`, 'low', profileUrl)] : []),
        ],
        contactSignals: [{ type: 'profile_url', value: profileUrl, source: 'crates', verified: false, note: 'Public crates.io package URL.' }],
        identitySignals: buildArtifactSignals('crates', profileUrl, skills),
        refreshedAt: now(),
        raw: crate,
      })
    })
  } catch {
    return []
  }
}

export async function searchRubyGems(req: SourceSearchRequest): Promise<SourceResult[]> {
  try {
    const data = await safeJson(`https://rubygems.org/api/v1/search.json?query=${encodeURIComponent(req.query)}`)
    const rows = Array.isArray(data) ? data.slice(0, Math.min(req.limit || 6, 8)) : []
    return rows.map((gem: any) => {
      const name = safe(gem.name)
      const authors = safe(gem.authors)
      const profileUrl = safe(gem.project_uri) || `https://rubygems.org/gems/${name}`
      const skills = words(`${req.query} ruby rails gem ${safe(gem.info)}`)
      return classified({
        id: idFor('rubygems', name),
        source: 'rubygems',
        sourceProfileId: name,
        displayName: name,
        headline: 'RubyGems package artifact.',
        profileUrl,
        skills,
        evidence: [
          evidence('rubygems', 'Ruby package signal', `${name} matched the search.`, 'medium', profileUrl),
          ...(authors ? [evidence('rubygems', 'Author association', `${authors} is publicly associated with RubyGem ${name}. This is evidence, not a confirmed candidate identity.`, 'low', profileUrl)] : []),
          ...(gem.downloads ? [evidence('rubygems', 'Gem usage signal', `${gem.downloads} downloads reported.`, 'low', profileUrl)] : []),
        ],
        contactSignals: [{ type: 'profile_url', value: profileUrl, source: 'rubygems', verified: false, note: 'Public RubyGems package URL.' }],
        identitySignals: buildArtifactSignals('rubygems', profileUrl, skills),
        refreshedAt: now(),
        raw: gem,
      })
    })
  } catch {
    return []
  }
}

export async function searchResumeXray(req: SourceSearchRequest): Promise<SourceResult[]> {
  const query = encodeURIComponent(`("resume" OR "cv") (${req.query}) ${req.location || ''} (filetype:pdf OR filetype:doc OR filetype:docx OR intitle:resume OR inurl:resume)`)
  const googleUrl = `https://www.google.com/search?q=${query}`
  const bingUrl = `https://www.bing.com/search?q=${query}`
  const skills = words(req.query)
  return [classified({
    id: idFor('resume_xray', `resume-${normId(req.query)}-${normId(req.location || '')}`),
    source: 'resume_xray',
    sourceProfileId: `resume-xray:${req.query}:${req.location || ''}`,
    displayName: `Public resume search: ${req.query}`,
    headline: 'Manual-safe public resume/CV discovery lane. It opens search results and does not create a candidate.',
    location: req.location || '',
    profileUrl: googleUrl,
    skills,
    evidence: [evidence('resume_xray', 'Public resume X-Ray lane', `Prepared Google/Bing public resume search for ${req.query}. Recruiters must manually review and confirm every result.`, 'low', googleUrl)],
    contactSignals: [
      { type: 'profile_url', value: googleUrl, source: 'resume_xray', verified: false, note: 'Google public resume search URL.' },
      { type: 'profile_url', value: bingUrl, source: 'resume_xray', verified: false, note: 'Bing public resume search URL.' },
    ],
    identitySignals: skills.slice(0, 5).map(skill => ({ type: 'skill' as const, value: skill, weight: 3, source: 'resume_xray' as const })),
    refreshedAt: now(),
    raw: { mode: 'manual_safe_search', googleUrl, bingUrl },
  })]
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
  const results = settled.flatMap(result => result.status === 'fulfilled' ? result.value : [])
  const warnings = settled.flatMap((result, index) => result.status === 'rejected' ? [`${selected[index]} failed.`] : [])
  return { results, warnings, searchedSources: selected }
}
