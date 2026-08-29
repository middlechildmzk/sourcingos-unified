import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(process.cwd(), '..')
const self = path.resolve(__filename)
const allowedExtensions = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.md', '.json', '.yml', '.yaml', '.html', '.css', '.sql', '.txt', '.env', '.example',
])
const ignoredDirectories = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'coverage'])
const ignoredFiles = new Set(['package-lock.json'])

const forbidden = [
  ['PO', 'TFF'].join(''),
  ['H', '2F'].join(''),
  ['Warrior', 'Care'].join(' '),
  ['Recovery', 'Care'].join(' '),
  ['Force and Family', 'Readiness'].join(' '),
  ['Max', 'imus'].join(''),
  ['Dan', 'Larson'].join(' '),
  ['Daniel', 'Larson'].join(' '),
  ['Lar', 'son'].join(''),
  ['Dan', ' L.'].join(''),
  ['USSO', 'COM'].join(''),
  ['Capitol', 'Careers'].join(' '),
  ['SISU', ' Search'].join(''),
  ['Quantum', 'Work'].join(''),
  ['realmiddlechildmzk', 'gmail.com'].join('@'),
  ['Dllarson1991', 'gmail.com'].join('@'),
]

const allowedEmailDomains = new Set([
  'example.com',
  'company.com',
  'sourcingos.com',
  'getsourcingos.com',
  'users.noreply.github.com',
])
const allowedFixtureEmails = new Set([
  'your@email.com',
  'a@b.co',
  'a@b.com',
  'jordan@alpha.dev',
  'jordan@beta.dev',
])

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, out)
      continue
    }
    if (!entry.isFile() || ignoredFiles.has(entry.name) || full === self) continue
    if (!allowedExtensions.has(path.extname(entry.name).toLowerCase())) continue
    out.push(full)
  }
  return out
}

function relative(file: string): string {
  return path.relative(repoRoot, file).replaceAll(path.sep, '/')
}

describe('public repository privacy firewall', () => {
  it('contains no known personal, employer, client, or private-work identifiers', () => {
    const hits: string[] = []
    for (const file of walk(repoRoot)) {
      const text = fs.readFileSync(file, 'utf8')
      for (const term of forbidden) {
        if (text.toLowerCase().includes(term.toLowerCase())) hits.push(`${relative(file)} -> ${term}`)
      }
    }
    expect(hits, `Forbidden public-repo identifiers found:\n${hits.join('\n')}`).toEqual([])
  })

  it('does not commit personal email addresses', () => {
    const hits: string[] = []
    const emailPattern = /[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/gi
    for (const file of walk(repoRoot)) {
      const text = fs.readFileSync(file, 'utf8')
      for (const match of text.matchAll(emailPattern)) {
        const email = match[0].toLowerCase()
        const domain = (match[1] || '').toLowerCase()
        if (!allowedEmailDomains.has(domain) && !allowedFixtureEmails.has(email)) hits.push(`${relative(file)} -> ${match[0]}`)
      }
    }
    expect(hits, `Unexpected committed email addresses found:\n${hits.join('\n')}`).toEqual([])
  })
})
