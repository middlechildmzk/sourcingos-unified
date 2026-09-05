import 'server-only'
import type { EvidenceItem, IdentitySignal, SourceResult, SourceSearchRequest } from '@/lib/source-types'

const HF = 'https://huggingface.co'
const USER_AGENT = 'SourcingOS/33.7 (+https://getsourcingos.com)'

type HuggingFaceArtifactKind = 'model' | 'dataset' | 'space'

type HuggingFaceArtifact = {
  id?: string
  modelId?: string
  author?: string
  tags?: string[]
  pipeline_tag?: string
  library_name?: string
  lastModified?: string
  createdAt?: string
  downloads?: number
  likes?: number
}

type HuggingFaceUserOverview = {
  _id?: string
  user?: string
  type?: string
  fullname?: string
  avatarUrl?: string
  details?: string
  createdAt?: string
  numModels?: number
  numDatasets?: number
  numSpaces?: number
  orgs?: Array<{ name?: string; fullname?: string }>
  websiteUrl?: string
  website?: string
  github?: string
}

type ObservedArtifact = {
  kind: HuggingFaceArtifactKind
  id: string
  owner: string
  tags: string[]
  url: string
  observedAt: string
  downloads?: number
  likes?: number
}

function clean(value: unknown, max = 180): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

function uniq(values: string[], max = 20): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const cleaned = clean(value, 80).toLowerCase()
    if (!cleaned || seen.has(cleaned)) continue
    seen.add(cleaned)
    out.push(cleaned)
    if (out.length >= max) break
  }
  return out
}

function safeUrl(value: unknown): string | undefined {
  const text = clean(value, 500)
  if (!text) return undefined
  try {
    const url = new URL(text)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 7000)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { accept: 'application/json', 'user-agent': USER_AGENT },
    })
    if (!response.ok) throw new Error(`Hugging Face API ${response.status}`)
    return await response.json() as T
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Hub search is intentionally capability-oriented rather than Boolean-oriented.
 * These terms are retrieval intent only and never become candidate evidence.
 */
export function huggingFaceRetrievalTerms(query: string): string[] {
  const text = query.toLowerCase()
  const rules: Array<[RegExp, string]> = [
    [/\b(?:large language model|llms?)\b/, 'llm'],
    [/\btransformers?\b/, 'transformers'],
    [/\bpytorch\b|\btorch\b/, 'pytorch'],
    [/\btensorflow\b/, 'tensorflow'],
    [/\bjax\b/, 'jax'],
    [/\bdiffusion\b|stable diffusion/, 'diffusion'],
    [/\bcomputer vision\b|\bvision\b/, 'computer-vision'],
    [/\bnatural language processing\b|\bnlp\b/, 'nlp'],
    [/\bretrieval augmented generation\b|\brag\b/, 'rag'],
    [/\bembeddings?\b/, 'embeddings'],
    [/\bfine[- ]?tun(?:e|ing)\b/, 'fine-tuning'],
    [/\bmachine learning\b|\bml\b/, 'machine-learning'],
    [/\bartificial intelligence\b|\bai\b/, 'ai'],
  ]
  const terms: string[] = []
  for (const [pattern, term] of rules) if (pattern.test(text)) terms.push(term)
  return uniq(terms, 3)
}

function artifactId(item: HuggingFaceArtifact): string {
  return clean(item.id || item.modelId, 220)
}

function artifactOwner(item: HuggingFaceArtifact): string {
  const explicit = clean(item.author, 100)
  if (explicit) return explicit
  const id = artifactId(item)
  return id.includes('/') ? clean(id.split('/')[0], 100) : ''
}

function artifactTags(item: HuggingFaceArtifact): string[] {
  return uniq([
    ...(Array.isArray(item.tags) ? item.tags : []),
    clean(item.pipeline_tag, 80),
    clean(item.library_name, 80),
  ], 16)
}

function artifactUrl(kind: HuggingFaceArtifactKind, id: string): string {
  if (kind === 'dataset') return `${HF}/datasets/${id}`
  if (kind === 'space') return `${HF}/spaces/${id}`
  return `${HF}/${id}`
}

function artifactObservedAt(item: HuggingFaceArtifact): string {
  const raw = clean(item.lastModified || item.createdAt, 80)
  return raw && Number.isFinite(Date.parse(raw)) ? new Date(raw).toISOString() : new Date().toISOString()
}

async function searchArtifacts(kind: HuggingFaceArtifactKind, term: string, limit: number): Promise<ObservedArtifact[]> {
  const path = kind === 'model' ? 'models' : kind === 'dataset' ? 'datasets' : 'spaces'
  const rows = await fetchJson<HuggingFaceArtifact[]>(`${HF}/api/${path}?search=${encodeURIComponent(term)}&limit=${Math.min(limit, 12)}`)
  if (!Array.isArray(rows)) return []
  return rows.flatMap(item => {
    const id = artifactId(item)
    const owner = artifactOwner(item)
    if (!id || !owner) return []
    return [{
      kind,
      id,
      owner,
      tags: artifactTags(item),
      url: artifactUrl(kind, id),
      observedAt: artifactObservedAt(item),
      downloads: Number.isFinite(Number(item.downloads)) ? Number(item.downloads) : undefined,
      likes: Number.isFinite(Number(item.likes)) ? Number(item.likes) : undefined,
    } satisfies ObservedArtifact]
  })
}

function evidenceFor(owner: string, artifacts: ObservedArtifact[]): EvidenceItem[] {
  return artifacts.slice(0, 6).flatMap(artifact => {
    const kindLabel = artifact.kind === 'model' ? 'model' : artifact.kind === 'dataset' ? 'dataset' : 'Space'
    const items: EvidenceItem[] = [{
      id: `huggingface:${owner}:${artifact.kind}:${artifact.id}`,
      label: `Public Hugging Face ${kindLabel}`,
      detail: `${owner} owns public Hugging Face ${kindLabel} ${artifact.id}.`,
      source: 'huggingface',
      confidence: 'high',
      url: artifact.url,
      observedAt: artifact.observedAt,
    }]
    if (artifact.tags.length) items.push({
      id: `huggingface:${owner}:${artifact.kind}:${artifact.id}:tags`,
      label: 'Observed artifact tags',
      detail: artifact.tags.slice(0, 10).join(', '),
      source: 'huggingface',
      confidence: 'medium',
      url: artifact.url,
      observedAt: artifact.observedAt,
    })
    return items
  })
}

/**
 * Resolve public Hugging Face artifact owners to public user profiles. A model,
 * dataset, or Space can discover an owner, but only `/api/users/{username}/overview`
 * with `type: user` makes the record candidate-eligible. Organization owners are
 * excluded. Candidate skills are only tags observed on that user's public Hub
 * artifacts; recruiter/search terms never become candidate facts.
 */
export async function discoverHuggingFacePeople(req: SourceSearchRequest): Promise<SourceResult[]> {
  const terms = huggingFaceRetrievalTerms(req.query)
  if (!terms.length) return []

  const artifactLimit = Math.min(Math.max((req.limit || 6) * 2, 8), 12)
  const batches = await Promise.all(terms.slice(0, 2).flatMap(term => [
    searchArtifacts('model', term, artifactLimit),
    searchArtifacts('dataset', term, Math.min(artifactLimit, 8)),
    searchArtifacts('space', term, Math.min(artifactLimit, 8)),
  ]))

  const byOwner = new Map<string, ObservedArtifact[]>()
  for (const artifact of batches.flat()) {
    const current = byOwner.get(artifact.owner) || []
    if (!current.some(item => item.kind === artifact.kind && item.id === artifact.id)) current.push(artifact)
    byOwner.set(artifact.owner, current)
  }

  const results: SourceResult[] = []
  const maxPeople = Math.min(req.limit || 6, 8)
  for (const [owner, artifacts] of Array.from(byOwner.entries()).slice(0, 18)) {
    if (results.length >= maxPeople) break
    let profile: HuggingFaceUserOverview
    try {
      profile = await fetchJson<HuggingFaceUserOverview>(`${HF}/api/users/${encodeURIComponent(owner)}/overview`)
    } catch {
      continue
    }
    if (clean(profile.type, 30).toLowerCase() !== 'user') continue
    const username = clean(profile.user, 100) || owner
    if (!username) continue

    const profileUrl = `${HF}/${username}`
    const name = clean(profile.fullname, 120) || username
    const observedTags = uniq(artifacts.flatMap(artifact => artifact.tags), 20)
    const website = safeUrl(profile.websiteUrl || profile.website)
    const github = clean(profile.github, 100)
    const githubUrl = github ? `https://github.com/${encodeURIComponent(github.replace(/^@/, ''))}` : undefined
    const orgNames = (Array.isArray(profile.orgs) ? profile.orgs : []).map(org => clean(org.fullname || org.name, 120)).filter(Boolean).slice(0, 5)
    const evidence = evidenceFor(username, artifacts)
    const identitySignals: IdentitySignal[] = [
      { type: 'name', value: name, weight: 15, source: 'huggingface' },
      { type: 'source_url', value: profileUrl, weight: 20, source: 'huggingface' },
      ...(website ? [{ type: 'website' as const, value: website, weight: 25, source: 'huggingface' as const }] : []),
      ...(githubUrl ? [{ type: 'website' as const, value: githubUrl, weight: 35, source: 'huggingface' as const }] : []),
      ...observedTags.slice(0, 6).map(skill => ({ type: 'skill' as const, value: skill, weight: 3, source: 'huggingface' as const })),
    ]

    results.push({
      id: `huggingface:${username}`,
      source: 'huggingface',
      sourceProfileId: username,
      entityKind: 'person',
      displayName: name,
      headline: clean(profile.details, 220) || `Hugging Face user with ${artifacts.length} public role-relevant artifact${artifacts.length === 1 ? '' : 's'} observed.`,
      profileUrl,
      avatarUrl: safeUrl(profile.avatarUrl),
      skills: observedTags,
      evidence,
      contactSignals: [
        { type: 'profile_url', value: profileUrl, source: 'huggingface', verified: false, note: 'Public Hugging Face user profile URL.' },
        ...(website ? [{ type: 'website' as const, value: website, source: 'huggingface' as const, verified: false as const, note: 'Public website listed by the Hugging Face user profile.' }] : []),
        ...(githubUrl ? [{ type: 'website' as const, value: githubUrl, source: 'huggingface' as const, verified: false as const, note: 'Public GitHub handle listed by the Hugging Face user profile.' }] : []),
      ],
      identitySignals,
      refreshedAt: new Date().toISOString(),
      raw: {
        resolver: 'huggingface_public_user_overview_v33_7',
        profile: { ...profile, orgs: orgNames },
        observedTags,
        artifacts: artifacts.slice(0, 8),
      },
    })
  }

  return results
}
