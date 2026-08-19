import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { articles } from '@/data/articles'

const ROOT = process.cwd()
const SCAN_ROOTS = ['app', 'components']
const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.md', '.mdx', '.json'])

// Build phrases from fragments so the guardrail file does not trip its own policy.
const prohibited = [
  ['qualified', 'candidate'],
  ['qualified', 'profile'],
  ['qualified-profile'],
  ['qualified', 'supply'],
  ['qualified', 'submittal'],
  ['qualified-submittal'],
  ['candidate', 'quality'],
  ['verified', 'clearance'],
  ['clearance', 'match'],
  ['likely', 'to', 'move'],
].map(parts => parts.join(' '))

const redirectedArticleSlugs = new Set([
  'open-web-sourcing-stack',
  'sourcing-tool-stack-for-agency-recruiters',
  'sourcing-for-founders-and-small-teams',
  'hard-to-fill-role-intake-template',
  'hiring-manager-calibration-questions',
  'govcon-cleared-sourcing-market-map',
])

// These records remain in the shared index data, but a dedicated static route owns
// the rendered page. Guard the dedicated route source through SCAN_ROOTS instead.
const staticOverrideSlugs = new Set([
  'linkedin-recruiter-alternatives',
  'best-contact-finders-for-recruiters-2026',
  'ai-sourcing-workflow-2026',
  'best-ai-recruiting-tools-for-sourcers-2026',
  'sourcing-kpi-dashboard',
])

function extension(path: string) {
  const match = path.match(/(\.[^.\/]+)$/)
  return match?.[1] ?? ''
}

function filesUnder(path: string): string[] {
  return readdirSync(path).flatMap(name => {
    const full = join(path, name)
    if (['node_modules', '.next', 'coverage'].includes(name)) return []
    return statSync(full).isDirectory() ? filesUnder(full) : [full]
  })
}

function collectHits(text: string, label: string) {
  const lower = text.toLowerCase()
  return prohibited.filter(phrase => lower.includes(phrase)).map(phrase => `${label}: ${phrase}`)
}

describe('public-content language guardrails', () => {
  it('contains no prohibited sourcing or clearance constructions in rendered source', () => {
    const hits: string[] = []

    for (const root of SCAN_ROOTS) {
      const base = join(ROOT, root)
      for (const file of filesUnder(base)) {
        if (!TEXT_EXTENSIONS.has(extension(file))) continue
        const lines = readFileSync(file, 'utf8').split(/\r?\n/)
        lines.forEach((line, index) => {
          hits.push(...collectHits(line, `${relative(ROOT, file)}:${index + 1}`))
        })
      }
    }

    for (const article of articles) {
      if (redirectedArticleSlugs.has(article.slug) || staticOverrideSlugs.has(article.slug)) continue
      hits.push(...collectHits(JSON.stringify(article), `data/articles.ts:${article.slug}`))
    }

    expect(hits, hits.length ? `Prohibited public-content language:\n${hits.join('\n')}` : undefined).toEqual([])
  })
})
