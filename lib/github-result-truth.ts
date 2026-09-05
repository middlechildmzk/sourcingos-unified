import type { SourceResult } from './source-types'

type GitHubRawRepository = {
  language?: unknown
  topics?: unknown
}

type GitHubDiscoveryRaw = {
  strategy?: unknown
  repositories?: unknown
}

function observedRepositorySkills(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object') return []
  const candidate = raw as GitHubDiscoveryRaw
  if (candidate.strategy !== 'repository_contributors' || !Array.isArray(candidate.repositories)) return []

  const seen = new Set<string>()
  const skills: string[] = []
  candidate.repositories.forEach(value => {
    if (!value || typeof value !== 'object') return
    const repository = value as GitHubRawRepository
    const observed = [
      typeof repository.language === 'string' ? repository.language : '',
      ...(Array.isArray(repository.topics)
        ? repository.topics.filter((topic): topic is string => typeof topic === 'string')
        : []),
    ]
    observed.forEach(skill => {
      const clean = skill.trim()
      const key = clean.toLowerCase()
      if (!clean || seen.has(key)) return
      seen.add(key)
      skills.push(clean)
    })
  })
  return skills.slice(0, 12)
}

/**
 * The GitHub connector uses recruiter query terms to find relevant repositories.
 * Those search terms are not themselves observed candidate skills. At the public
 * API boundary, expose only repository languages/topics as skills. Fallback user
 * search retains no inferred skill list and relies on its labelled evidence.
 */
export function enforceGitHubResultTruth(result: SourceResult): SourceResult {
  if (result.source !== 'github') return result
  return {
    ...result,
    entityKind: 'person',
    skills: observedRepositorySkills(result.raw),
  }
}

export function enforceGitHubResultsTruth(results: SourceResult[]): SourceResult[] {
  return results.map(enforceGitHubResultTruth)
}
