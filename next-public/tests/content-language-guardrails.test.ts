import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const SCAN_ROOTS = ['app', 'components', 'data']
const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.md', '.mdx', '.json'])

// Build phrases from fragments so the guardrail file does not trip its own policy.
const prohibited = [
  ['qualified', 'candidate'],
  ['qualified', 'profile'],
  ['qualified-profile'],
  ['qualified', 'supply'],
  ['qualified', 'submittal'],
  ['qualified-submittal'],
  ['verified', 'clearance'],
  ['clearance', 'match'],
  ['likely', 'to', 'move'],
].map(parts => parts.join(' '))

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

describe('public-content language guardrails', () => {
  it('contains no prohibited sourcing or clearance constructions', () => {
    const hits: string[] = []

    for (const root of SCAN_ROOTS) {
      const base = join(ROOT, root)
      for (const file of filesUnder(base)) {
        if (!TEXT_EXTENSIONS.has(extension(file))) continue
        const lines = readFileSync(file, 'utf8').split(/\r?\n/)
        lines.forEach((line, index) => {
          const lower = line.toLowerCase()
          for (const phrase of prohibited) {
            if (lower.includes(phrase)) {
              hits.push(`${relative(ROOT, file)}:${index + 1}: ${phrase}`)
            }
          }
        })
      }
    }

    expect(hits, hits.length ? `Prohibited public-content language:\n${hits.join('\n')}` : undefined).toEqual([])
  })
})
