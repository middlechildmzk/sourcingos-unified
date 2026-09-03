import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'

function filesUnder(root: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(root)) {
    const path = join(root, name)
    const stat = statSync(path)
    if (stat.isDirectory()) out.push(...filesUnder(path))
    else if (/\.(?:ts|tsx)$/.test(name)) out.push(path)
  }
  return out
}

describe('V36.12 GitHub public-email firewall', () => {
  it('keeps GitHub publicEmail out of contact enrichment and recruiter outreach execution paths', () => {
    const root = fileURLToPath(new URL('..', import.meta.url))
    const protectedRoots = ['app/api', 'components', 'lib/contact-enrichment']
      .flatMap(dir => filesUnder(join(root, dir)))

    const violations: string[] = []
    for (const path of protectedRoots) {
      const source = readFileSync(path, 'utf8')
      if (/\bpublicEmail\b/.test(source) || /github[_\s-]*public[_\s-]*email/i.test(source)) {
        violations.push(relative(root, path))
      }
    }
    expect(violations, `GitHub-derived public email reached an execution surface: ${violations.join(', ')}`).toEqual([])
  })

  it('documents that GitHub email observation is not a contact/outreach source', () => {
    const github = readFileSync(fileURLToPath(new URL('../lib/connectors/github-v2.ts', import.meta.url)), 'utf8')
    expect(github).toContain('publicEmail:')
    // The connector can preserve the source observation for research/identity
    // context, but there must be no conversion here into candidate contacts.
    expect(github).not.toContain('permissionStatus')
    expect(github).not.toContain('candidate_contacts')
    expect(github).not.toContain('outreach')
  })
})
