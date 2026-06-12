// ─────────────────────────────────────────────────────────────────────────────
// lib/jd-boolean-lanes.ts — Deterministic JD → three-lane Boolean generator.
//
// Pure function. No AI, no network, no server, no new dependencies. Builds on
// the existing parseJobDescription() extractor (lib/jd-parser.ts) and adds:
//   • noise / non-searchable term detection (soft skills, HR boilerplate)
//   • three search lanes (Precision / Balanced / Expanded)
//   • per-lane LinkedIn / Google X-Ray / Bing X-Ray / GitHub variants
//   • explicit "included / removed / verify" notes per lane
//
// Trust rules enforced:
//   • Clearance terms appear ONLY in LinkedIn/ATS-style lanes, never in public
//     X-Ray (the open web can't verify clearance; the term returns job posts).
//   • GitHub strings are skills/tools only — no clearance, no years, no HR text.
// ─────────────────────────────────────────────────────────────────────────────
import type { ParsedJD } from './jd-parser'

// Non-searchable language that hurts Boolean if included. Detection is
// substring-based against the raw JD so the UI can show what it ignored.
export const NOISE_PATTERNS: string[] = [
  'excellent communication', 'fast-paced', 'team player', 'self-starter',
  'stakeholder', 'ability to work independently', 'work independently',
  'passionate', 'detail-oriented', 'detail oriented', 'responsible for',
  'collaborate', 'collaboration', 'preferred but not required',
  'equal opportunity', 'equal employment', 'benefits package', 'salary range',
  'compensation', '401(k)', '401k', 'company boilerplate', 'physical requirements',
  'years of experience', 'strong work ethic', 'wear many hats', 'rockstar',
  'ninja', 'guru', 'go-getter', 'results-driven', 'cross-functional',
  'dynamic environment', 'flexible hours', 'competitive pay',
]

function q(s: string): string {
  return /\s|\//.test(s) && !s.startsWith('"') ? `"${s}"` : s
}
function orGroup(xs: string[], max = 10): string {
  const clean = [...new Set(xs.filter(Boolean))].slice(0, max).map(q)
  return clean.length > 1 ? `(${clean.join(' OR ')})` : (clean[0] || '')
}
function notGroup(xs: string[], google = false): string {
  const clean = [...new Set(xs.filter(Boolean))]
  if (clean.length === 0) return ''
  return google ? clean.map(x => `-${q(x)}`).join(' ') : `NOT (${clean.map(q).join(' OR ')})`
}

// Skills safe for GitHub: drop clearance, certs, HR words, multi-word soft phrases.
const NON_GITHUB = new Set([
  'TS/SCI', 'Top Secret', 'Secret', 'Polygraph', 'Public Trust', 'Clearable',
  'Security+', 'CISSP', 'CAP', 'BLS', 'ACLS', 'RN', 'Epic', 'EMR',
])

export interface Lane {
  id: 'precision' | 'balanced' | 'expanded'
  name: string
  useCase: string
  boolean: string
  linkedin: string
  googleXray: string
  bingXray: string
  github: string | null
  included: string[]
  removed: string[]
  verify: string[]
}

export interface LaneResult {
  detectedNoise: string[]
  excludedFromXray: string[]
  lanes: Lane[]
}

const BASE_EXCLUSIONS = ['student', 'intern', 'bootcamp', 'tutorial', 'course', 'instructor', 'professor']

export function buildLanes(
  parsed: ParsedJD,
  rawText: string,
  opts: { includeLocation: boolean; isCleared: boolean }
): LaneResult {
  const lower = rawText.toLowerCase()
  const detectedNoise = NOISE_PATTERNS.filter(p => lower.includes(p))

  const title = parsed.roleTitle || 'Software Engineer'
  const related = parsed.relatedTitles
  const must = parsed.mustHaveSkills.filter(Boolean)
  const pref = parsed.preferredSkills.filter(Boolean)
  const clearance = parsed.clearance.filter(Boolean)
  const location = opts.includeLocation && parsed.location ? parsed.location : ''
  const exclusions = [...BASE_EXCLUSIONS]

  // Skills that must never go into public X-Ray.
  const excludedFromXray = [...clearance]

  const githubSkills = [...must, ...pref].filter(s => !NON_GITHUB.has(s))

  // ── Lane 1: Precision ──────────────────────────────────────────────────────
  const pTitles = orGroup([title], 1)
  const pMust = orGroup(must.slice(0, 6), 6)
  const pCore = [pTitles, pMust].filter(Boolean).join(' AND ')
  const precision: Lane = {
    id: 'precision',
    name: 'Precision / Strict Match',
    useCase: 'High-signal, low-volume. LinkedIn Recruiter, ClearanceJobs, ATS/resume DB, tightly constrained roles.',
    boolean: [pCore, location ? `(${location})` : '', notGroup(exclusions)].filter(Boolean).join(' AND '),
    linkedin: [pCore, opts.isCleared && clearance.length ? orGroup(clearance) : '', location ? `(${location})` : '', notGroup(exclusions)].filter(Boolean).join(' AND '),
    googleXray: `site:linkedin.com/in ${pTitles} ${orGroup(must.slice(0, 5))} ${location ? `(${location})` : ''} ${notGroup(exclusions, true)} -intitle:jobs`.replace(/\s+/g, ' ').trim(),
    bingXray: `site:linkedin.com/in ${pTitles} ${orGroup(must.slice(0, 5))} ${location ? `(${location})` : ''}`.replace(/\s+/g, ' ').trim(),
    github: githubSkills.length ? `${orGroup(githubSkills.slice(0, 5))}` : null,
    included: ['Strongest title', `Top ${Math.min(6, must.length)} must-have skills`, ...(opts.isCleared && clearance.length ? ['Clearance (LinkedIn lane only)'] : []), ...(location ? ['Location'] : [])],
    removed: ['Nice-to-haves', 'Soft skills', ...(detectedNoise.length ? ['Detected JD noise'] : [])],
    verify: ['Are all must-haves truly required, or is one trainable?', ...(clearance.length ? ['Clearance is candidate-stated until confirmed through proper process.'] : [])],
  }

  // ── Lane 2: Balanced ───────────────────────────────────────────────────────
  const bTitles = orGroup([title, ...related.slice(0, 2)])
  const bMust = orGroup(must.slice(0, 5))
  const bSoftPref = pref.length ? orGroup(pref.slice(0, 2)) : ''
  const bCore = [bTitles, bMust].filter(Boolean).join(' AND ')
  const balanced: Lane = {
    id: 'balanced',
    name: 'Balanced / Recruiter Default',
    useCase: 'Best first working string for most sourcers. Start here.',
    boolean: [bCore, location ? `(${location})` : '', notGroup(exclusions)].filter(Boolean).join(' AND '),
    linkedin: [bCore, opts.isCleared && clearance.length ? orGroup(clearance) : '', notGroup(exclusions)].filter(Boolean).join(' AND '),
    googleXray: `site:linkedin.com/in ${bTitles} ${bMust} ${notGroup(exclusions, true)} -intitle:jobs`.replace(/\s+/g, ' ').trim(),
    bingXray: `site:linkedin.com/in ${bTitles} ${bMust}`.replace(/\s+/g, ' ').trim(),
    github: githubSkills.length ? `${orGroup(githubSkills.slice(0, 6))}` : null,
    included: ['Title + 1–2 adjacent titles', `Top ${Math.min(5, must.length)} must-haves`, ...(bSoftPref ? ['1–2 key nice-to-haves'] : [])],
    removed: ['Over-specific JD bullets', 'Years/degree clutter', ...(detectedNoise.length ? ['JD noise'] : [])],
    verify: ['Which 1–2 adjacent titles is the HM open to?', ...(clearance.length ? ['Confirm clearance level and adjudication date directly.'] : [])],
  }

  // ── Lane 3: Expanded / Market Map ──────────────────────────────────────────
  const eTitles = orGroup([title, ...related], 8)
  const eSkills = orGroup([...must.slice(0, 3), ...pref.slice(0, 3)])
  const eCore = [eTitles, eSkills].filter(Boolean).join(' AND ')
  const expanded: Lane = {
    id: 'expanded',
    name: 'Expanded / Market Map',
    useCase: 'Find hidden talent and adjacent profiles. Competitor mapping, career-changers, adjacent backgrounds.',
    boolean: [eCore, notGroup(BASE_EXCLUSIONS.slice(0, 3))].filter(Boolean).join(' AND '),
    linkedin: [eCore].filter(Boolean).join(' AND '),
    googleXray: `site:linkedin.com/in ${eTitles} ${orGroup([...must.slice(0, 2), ...pref.slice(0, 2)])}`.replace(/\s+/g, ' ').trim(),
    bingXray: `site:linkedin.com/in ${eTitles} ${orGroup(must.slice(0, 3))}`.replace(/\s+/g, ' ').trim(),
    github: githubSkills.length ? `${orGroup(githubSkills.slice(0, 8))}` : null,
    included: ['Broad title expansion', 'Skill synonyms', 'Fewer restrictions'],
    removed: ['Years', 'Degree', 'Soft skills', 'Most exclusions'],
    verify: ['Expect higher noise — this lane trades precision for reach.', 'Confirm which adjacent backgrounds the HM will actually consider.'],
  }

  return { detectedNoise, excludedFromXray: [...new Set(excludedFromXray)], lanes: [precision, balanced, expanded] }
}
