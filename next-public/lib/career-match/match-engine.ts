import type {
  AdjacentRole,
  CareerMatchRoleUniverse,
  CareerPreferences,
  FitScoreBand,
  JobMatchResult,
  MatchGroup,
  MatchGroupId,
  MatchScoreBreakdown,
  MatchableJob,
  RecruitingRoleFamily,
  ResumeProfile,
  SeniorityLevel,
} from './types'
import { getAdjacentFamilies, getRoleFamilyLabel, recruitingRoleTaxonomy, roleFamilyOrder } from './role-taxonomy'

const ROLE_QUERY_EXPANSIONS: Record<RecruitingRoleFamily, string[]> = {
  recruiter: [
    'recruiter', 'talent acquisition specialist', 'corporate recruiter', 'full cycle recruiter',
    'talent partner', 'ta partner', 'recruiting specialist', 'talent acquisition partner',
  ],
  sourcer: [
    'sourcer', 'talent sourcer', 'senior talent sourcer', 'technical sourcer', 'engineering sourcer',
    'candidate sourcer', 'recruiting researcher', 'candidate researcher', 'pipeline specialist',
  ],
  'technical-sourcer': [
    'technical sourcer', 'senior technical sourcer', 'engineering sourcer', 'technical recruiter',
    'senior technical recruiter', 'engineering recruiter', 'software recruiter', 'ai recruiter',
  ],
  'remote-recruiter': [
    'remote recruiter', 'remote sourcer', 'remote technical recruiter', 'distributed recruiter',
    'global recruiter', 'contract recruiter',
  ],
  'recruiting-ops': [
    'recruiting operations', 'recruiting ops', 'talent operations', 'ta operations',
    'recruiting enablement', 'recruiting program manager', 'ats administrator', 'recruiting systems',
  ],
  'healthcare-recruiter': [
    'healthcare recruiter', 'clinical recruiter', 'nurse recruiter', 'provider recruiter',
    'allied health recruiter', 'medical recruiter',
  ],
  'govcon-recruiter': [
    'federal recruiter', 'cleared recruiter', 'govcon recruiter', 'defense recruiter',
    'security clearance recruiter', 'cleared sourcer',
  ],
  'ai-recruiter': [
    'ai recruiter', 'machine learning recruiter', 'ml recruiter', 'ai sourcer',
    'research recruiter', 'data science recruiter',
  ],
  'talent-intelligence': [
    'talent intelligence', 'talent intelligence analyst', 'talent researcher', 'market intelligence',
    'talent insights', 'workforce intelligence', 'sourcing intelligence',
  ],
  'rpo-recruiter': [
    'rpo recruiter', 'embedded recruiter', 'contract recruiter', 'staffing recruiter',
    'agency recruiter', 'recruitment consultant', 'onsite recruiter',
  ],
}

function textForJob(job: MatchableJob): string {
  return [job.title, job.company, job.location, job.remoteType, job.employmentType, job.salaryRange, job.description, job.category, ...(job.tags || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function unique<T extends string>(items: T[]): T[] {
  return Array.from(new Set(items.map(item => item.trim()).filter(Boolean))) as T[]
}

function scoreTerms(text: string, terms: string[], weight: number): number {
  return terms.reduce((score, term) => score + (text.includes(term.toLowerCase()) ? weight : 0), 0)
}

export function inferJobRoleFamily(job: MatchableJob): RecruitingRoleFamily {
  const text = textForJob(job)
  const title = (job.title || '').toLowerCase()
  const category = (job.category || '').toLowerCase()

  const categoryAliases: Record<string, RecruitingRoleFamily> = {
    sourcer: 'sourcer',
    recruiter: 'recruiter',
    'technical-sourcer': 'technical-sourcer',
    'technical-recruiter': 'technical-sourcer',
    'technical-recruiter-jobs': 'technical-sourcer',
    'remote-recruiter': 'remote-recruiter',
    'remote-recruiter-jobs': 'remote-recruiter',
    'recruiting-ops': 'recruiting-ops',
    'recruiting-operations': 'recruiting-ops',
    'recruiting-operations-jobs': 'recruiting-ops',
    'healthcare-recruiter': 'healthcare-recruiter',
    'healthcare-recruiter-jobs': 'healthcare-recruiter',
    'govcon-recruiter': 'govcon-recruiter',
    'federal-recruiter': 'govcon-recruiter',
    'govcon-recruiter-jobs': 'govcon-recruiter',
    'ai-recruiter': 'ai-recruiter',
    'ai-recruiter-jobs': 'ai-recruiter',
  }
  if (category && categoryAliases[category]) return categoryAliases[category]

  const scored = roleFamilyOrder.map(family => {
    const entry = recruitingRoleTaxonomy[family]
    let score = 0
    score += scoreTerms(title, entry.titleSignals, 9)
    score += scoreTerms(text, entry.titleSignals, 5)
    score += scoreTerms(text, entry.skillSignals, 2)
    score += scoreTerms(text, entry.toolSignals, 1)
    score += scoreTerms(text, entry.industrySignals, 1)
    if (category.includes(entry.jobSearchCategory.toLowerCase())) score += 10
    if (category.includes(family)) score += 10
    return { family, score }
  })
  return scored.sort((a, b) => b.score - a.score)[0]?.family || 'recruiter'
}

function seniorityRank(level: SeniorityLevel): number {
  const map: Record<SeniorityLevel, number> = {
    entry: 1,
    mid: 2,
    'senior-ic': 3,
    lead: 4,
    manager: 5,
    'director-plus': 6,
    unknown: 0,
  }
  return map[level]
}

function inferJobSeniority(job: MatchableJob): SeniorityLevel {
  const text = textForJob(job)
  if (/\b(vp|vice president|head of|director)\b/.test(text)) return 'director-plus'
  if (/\b(manager|leadership|people manager|recruiting manager)\b/.test(text)) return 'manager'
  if (/\b(lead|principal|staff)\b/.test(text)) return 'lead'
  if (/\b(senior|sr\.?|ii|iii)\b/.test(text)) return 'senior-ic'
  if (/\b(coordinator|associate|junior|entry)\b/.test(text)) return 'entry'
  return 'mid'
}

function workModeFits(job: MatchableJob, preferences: CareerPreferences): boolean {
  const preferred = preferences.workMode || 'any'
  if (preferred === 'any') return true
  const text = `${job.remoteType || ''} ${job.location || ''} ${job.description || ''}`.toLowerCase()
  if (preferred === 'remote') return text.includes('remote')
  if (preferred === 'hybrid') return text.includes('hybrid') || text.includes('remote')
  if (preferred === 'onsite') return !text.includes('remote') || text.includes('onsite') || text.includes('on-site')
  return true
}

function locationFits(job: MatchableJob, preferences: CareerPreferences): boolean {
  const pref = (preferences.location || '').trim().toLowerCase()
  if (!pref) return true
  const jobText = `${job.location || ''} ${job.remoteType || ''}`.toLowerCase()
  if (jobText.includes('remote')) return true
  return jobText.includes(pref) || pref.split(/[,\.\s]+/).some(part => part.length > 2 && jobText.includes(part))
}

function salaryPresent(job: MatchableJob): boolean {
  const salary = (job.salaryRange || '').toLowerCase()
  return Boolean(salary && !salary.includes('not listed') && !salary.includes('not provided'))
}

function bandForScore(score: number, familyAligned: boolean, adjacentAligned: boolean): FitScoreBand {
  if (score >= 68 && familyAligned) return 'Strong Fit'
  if (score >= 50) return 'Good Fit'
  if (score >= 30 || adjacentAligned) return 'Adjacent Fit'
  return 'Stretch'
}

function capClearedBand(profile: ResumeProfile, jobFamily: RecruitingRoleFamily, band: FitScoreBand): FitScoreBand {
  if (jobFamily !== 'govcon-recruiter') return band
  if (profile.clearance.status === 'unverified-breadcrumb' || profile.industries.includes('federal')) return band === 'Strong Fit' ? 'Good Fit' : band
  return band === 'Strong Fit' || band === 'Good Fit' ? 'Adjacent Fit' : band
}

function buildBreakdown(profile: ResumeProfile, preferences: CareerPreferences, job: MatchableJob, jobFamily: RecruitingRoleFamily): MatchScoreBreakdown {
  const jobText = textForJob(job)
  const jobEntry = recruitingRoleTaxonomy[jobFamily]
  const exactFamily = profile.roleFamilies.includes(jobFamily) || preferences.desiredRoleType === jobFamily
  const adjacentFamily = profile.roleFamilies.some(family => getAdjacentFamilies(family).includes(jobFamily))

  const matchedTools = profile.tools.filter(tool => jobText.includes(tool.toLowerCase()))
  const matchedIndustries = profile.industries.filter(industry => jobText.includes(industry.toLowerCase()))
  const matchedSpecialties = profile.specialties.filter(specialty => jobText.includes(specialty.toLowerCase().replace(' / ', ' ')))
  const requiredSignals = unique([...jobEntry.skillSignals, ...jobEntry.toolSignals, ...jobEntry.industrySignals])
  const profileSignalText = `${profile.currentTitle} ${profile.pastTitles.join(' ')} ${profile.tools.join(' ')} ${profile.industries.join(' ')} ${profile.specialties.join(' ')}`.toLowerCase()
  const signalOverlap = requiredSignals.filter(signal => profileSignalText.includes(signal.toLowerCase()))

  const jobSeniority = inferJobSeniority(job)
  const userRank = seniorityRank(profile.seniority)
  const jobRank = seniorityRank(jobSeniority)
  const seniority = userRank === 0 ? 2 : userRank >= jobRank ? 8 : Math.max(0, 5 - (jobRank - userRank) * 2)

  const roleFamily = exactFamily ? 32 : adjacentFamily ? 18 : signalOverlap.length ? Math.min(14, signalOverlap.length * 2) : 0
  const tools = Math.min(18, matchedTools.length * 6)
  const industry = Math.min(13, matchedIndustries.length * 5)
  const specialty = Math.min(14, matchedSpecialties.length * 5 + signalOverlap.length * 2)
  const preference = (workModeFits(job, preferences) ? 4 : 0) + (locationFits(job, preferences) ? 3 : 0)
  const salary = salaryPresent(job) ? 3 : 0
  const clearance = jobFamily === 'govcon-recruiter'
    ? profile.clearance.status === 'unverified-breadcrumb' || profile.industries.includes('federal') ? 8 : -10
    : 0

  return { roleFamily, tools, industry, specialty, seniority, preference, salary, clearance }
}

function totalScore(breakdown: MatchScoreBreakdown): number {
  return Math.max(0, Math.min(100, Math.round(Object.values(breakdown).reduce((sum, value) => sum + value, 0))))
}

function topMatchedTools(profile: ResumeProfile, job: MatchableJob): string[] {
  const text = textForJob(job)
  return profile.tools.filter(tool => text.includes(tool.toLowerCase())).slice(0, 5)
}

function topMatchedIndustries(profile: ResumeProfile, job: MatchableJob): string[] {
  const text = textForJob(job)
  return profile.industries.filter(industry => text.includes(industry.toLowerCase())).slice(0, 4)
}

function missingSignals(profile: ResumeProfile, job: MatchableJob, jobFamily: RecruitingRoleFamily): string[] {
  const profileText = `${profile.currentTitle} ${profile.pastTitles.join(' ')} ${profile.tools.join(' ')} ${profile.industries.join(' ')} ${profile.specialties.join(' ')}`.toLowerCase()
  const jobText = textForJob(job)
  const entry = recruitingRoleTaxonomy[jobFamily]
  const needed = unique([...entry.toolSignals, ...entry.skillSignals, ...entry.industrySignals])
  return needed
    .filter(signal => jobText.includes(signal.toLowerCase()) && !profileText.includes(signal.toLowerCase()))
    .slice(0, 6)
}

function buildExplanation(profile: ResumeProfile, preferences: CareerPreferences, job: MatchableJob, jobFamily: RecruitingRoleFamily, score: number, breakdown: MatchScoreBreakdown): JobMatchResult['explanation'] {
  const tools = topMatchedTools(profile, job)
  const industries = topMatchedIndustries(profile, job)
  const gaps = missingSignals(profile, job, jobFamily)
  const fitReasons: string[] = []
  const potentialGaps: string[] = []
  const foundInResume: string[] = []
  const suggestedPositioning: string[] = []
  const contributingSignals: string[] = []
  const cautionNotes: string[] = []

  fitReasons.push(`Your parsed profile maps closest to ${getRoleFamilyLabel(profile.primaryFamily)}, and this role maps to ${getRoleFamilyLabel(jobFamily)}.`)
  contributingSignals.push(`Profile family: ${getRoleFamilyLabel(profile.primaryFamily)}`)
  contributingSignals.push(`Job family: ${getRoleFamilyLabel(jobFamily)}`)

  if (profile.yearsExperience !== null) {
    fitReasons.push(`Your resume indicates ${profile.yearsExperienceLabel.toLowerCase()}, which supports the ${profile.seniority} seniority read.`)
    foundInResume.push(`Seniority signal: ${profile.yearsExperienceLabel}`)
  }

  if (tools.length) {
    fitReasons.push(`Tool overlap found: ${tools.join(', ')}.`)
    foundInResume.push(`Tools to emphasize: ${tools.join(', ')}`)
    contributingSignals.push(`Matched tools: ${tools.join(', ')}`)
  }

  if (industries.length) {
    fitReasons.push(`Domain overlap found in the resume and role: ${industries.join(', ')}.`)
    foundInResume.push(`Industry signals: ${industries.join(', ')}`)
    contributingSignals.push(`Matched industries: ${industries.join(', ')}`)
  }

  if (workModeFits(job, preferences) && preferences.workMode && preferences.workMode !== 'any') {
    fitReasons.push(`The work setup appears compatible with your ${preferences.workMode} preference.`)
  }

  if (gaps.length) {
    potentialGaps.push(`The job includes signals not clearly found in the parsed resume: ${gaps.join(', ')}.`)
  }

  if (jobFamily === 'govcon-recruiter' && profile.clearance.status !== 'unverified-breadcrumb') {
    potentialGaps.push('This appears to be a federal or cleared recruiting lane, but no clearance or GovCon terms were found in the resume text.')
    cautionNotes.push('Do not imply active clearance. Treat clearance language as a gap unless the candidate can verify it outside the tool.')
  }

  if (breakdown.seniority < 5) {
    potentialGaps.push('Seniority alignment may need review. The job may signal a higher level than the parsed resume supports.')
  }

  if (!salaryPresent(job) && (preferences.salaryMin || preferences.salaryMax)) {
    potentialGaps.push('Salary is not listed, so compensation fit cannot be confirmed from this posting.')
  }

  if (!potentialGaps.length) {
    potentialGaps.push('No major hard gaps were detected from available job metadata, but the posting snippet may be incomplete.')
  }

  foundInResume.push(`Current title signal: ${profile.currentTitle}`)
  if (profile.specialties.length) foundInResume.push(`Specialty signals: ${profile.specialties.slice(0, 4).join(', ')}`)

  const familyAngle = recruitingRoleTaxonomy[jobFamily].resumeAngle
  suggestedPositioning.push(`If true, tailor the resume toward this lane: ${familyAngle}`)
  if (gaps.length) suggestedPositioning.push(`If you have real experience with ${gaps.slice(0, 3).join(', ')}, add it explicitly. Do not add these if they are not true.`)
  if (score < 50) suggestedPositioning.push('Consider using this as an adjacent or stretch role rather than the main application lane.')

  cautionNotes.push('Match reasons are generated from parsed resume text and public job metadata. They are not a hiring decision or guarantee.')
  if (profile.clearance.status === 'unverified-breadcrumb') cautionNotes.push(profile.clearance.note)

  return {
    fitReasons: unique(fitReasons).slice(0, 6),
    potentialGaps: unique(potentialGaps).slice(0, 6),
    resumeAngle: {
      foundInResume: unique(foundInResume).slice(0, 6),
      suggestedPositioning: unique(suggestedPositioning).slice(0, 4),
    },
    contributingSignals: unique(contributingSignals).slice(0, 8),
    cautionNotes: unique(cautionNotes).slice(0, 4),
  }
}

export function scoreJobMatch(profile: ResumeProfile, preferences: CareerPreferences, job: MatchableJob): JobMatchResult | null {
  if (!job.title || !job.company || !job.applyUrl) return null
  const jobFamily = inferJobRoleFamily(job)
  const breakdown = buildBreakdown(profile, preferences, job, jobFamily)
  const rawScore = totalScore(breakdown)
  const familyAligned = profile.roleFamilies.includes(jobFamily) || preferences.desiredRoleType === jobFamily
  const adjacentAligned = profile.roleFamilies.some(family => getAdjacentFamilies(family).includes(jobFamily))

  if (rawScore < 12 && !familyAligned && !adjacentAligned) return null

  const band = capClearedBand(profile, jobFamily, bandForScore(rawScore, familyAligned, adjacentAligned))
  return {
    job,
    score: rawScore,
    fitBand: band,
    jobFamily,
    scoreBreakdown: breakdown,
    explanation: buildExplanation(profile, preferences, job, jobFamily, rawScore, breakdown),
  }
}

export function dedupeMatchableJobs(jobs: MatchableJob[]): MatchableJob[] {
  const seen = new Set<string>()
  return jobs.filter(job => {
    const urlKey = (job.applyUrl || job.sourceUrl || '').toLowerCase().replace(/\?.*$/, '')
    const titleKey = `${job.company}-${job.title}-${job.location}`.toLowerCase().replace(/\s+/g, ' ').trim()
    const key = urlKey || titleKey
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function rankJobMatches(profile: ResumeProfile, preferences: CareerPreferences, jobs: MatchableJob[], limit = 25): JobMatchResult[] {
  const matches = dedupeMatchableJobs(jobs)
    .map(job => scoreJobMatch(profile, preferences, job))
    .filter((match): match is JobMatchResult => Boolean(match))
    .sort((a, b) => b.score - a.score)

  return matches.slice(0, limit)
}

function queryFamilies(profile: ResumeProfile, preferences: CareerPreferences, rescueTier: 0 | 1 | 2): RecruitingRoleFamily[] {
  const desired = preferences.desiredRoleType && preferences.desiredRoleType !== 'any' ? preferences.desiredRoleType : null
  const base = unique<RecruitingRoleFamily>([
    ...(desired ? [desired] : []),
    profile.primaryFamily,
    ...profile.roleFamilies,
  ])

  const tierOne = unique<RecruitingRoleFamily>([
    ...base,
    ...base.flatMap(getAdjacentFamilies),
    'sourcer',
    'technical-sourcer',
    'recruiter',
    'talent-intelligence',
    'recruiting-ops',
  ])

  const tierTwo = unique<RecruitingRoleFamily>([
    ...tierOne,
    'remote-recruiter',
    'rpo-recruiter',
    'govcon-recruiter',
    'healthcare-recruiter',
    'ai-recruiter',
  ])

  if (rescueTier === 0) return base
  if (rescueTier === 1) return tierOne
  return tierTwo
}

export function buildCareerMatchQueries(profile: ResumeProfile, preferences: CareerPreferences, rescueTier: 0 | 1 | 2 = 0): string[] {
  const families = queryFamilies(profile, preferences, rescueTier)
  const querySet: string[] = []

  for (const family of families) {
    const entry = recruitingRoleTaxonomy[family]
    querySet.push(...entry.searchTerms)
    querySet.push(...ROLE_QUERY_EXPANSIONS[family])
  }

  if (profile.seniority === 'senior-ic' || profile.seniority === 'lead' || profile.seniority === 'manager') {
    querySet.push('senior recruiter', 'senior sourcer', 'lead sourcer', 'sourcing manager')
  }

  if (profile.industries.includes('federal') || profile.clearance.status === 'unverified-breadcrumb' || preferences.clearedFederalInterest) {
    querySet.push('federal recruiter', 'cleared recruiter', 'cleared sourcer', 'govcon recruiter')
  }
  if (profile.industries.includes('healthcare') || /healthcare|clinical|nurse/i.test(preferences.industryFocus || '')) {
    querySet.push('healthcare recruiter', 'clinical recruiter', 'nurse recruiter')
  }
  if (profile.industries.includes('data') || /ai|machine learning|ml|data/i.test(preferences.industryFocus || '')) {
    querySet.push('ai recruiter', 'machine learning recruiter', 'data recruiter', 'ai sourcer')
  }
  if (/rpo|agency|staffing|contract/i.test(`${preferences.industryFocus || ''} ${profile.specialties.join(' ')}`)) {
    querySet.push('rpo recruiter', 'contract recruiter', 'staffing recruiter', 'agency recruiter')
  }

  // Tool-qualified broad queries help the existing jobs endpoint find descriptions that use tool language.
  for (const tool of profile.tools.slice(0, 4)) {
    querySet.push(`${tool} recruiter`, `${tool} sourcer`)
  }

  // Keep the query count bounded so the API stays fast and cheap.
  return unique(querySet.map(query => query.toLowerCase())).slice(0, rescueTier === 0 ? 10 : rescueTier === 1 ? 22 : 38)
}

export function suggestAdjacentRoles(profile: ResumeProfile, preferences: CareerPreferences, limit = 6): AdjacentRole[] {
  const primary = preferences.desiredRoleType && preferences.desiredRoleType !== 'any'
    ? preferences.desiredRoleType
    : profile.primaryFamily

  const candidates = unique<RecruitingRoleFamily>([
    ...getAdjacentFamilies(primary),
    ...profile.roleFamilies.flatMap(getAdjacentFamilies),
    'talent-intelligence',
    'recruiting-ops',
    'rpo-recruiter',
    'remote-recruiter',
  ])
    .filter(family => family !== primary)
    .filter(family => !profile.roleFamilies.includes(family) || family === 'talent-intelligence' || family === 'recruiting-ops')

  return candidates.slice(0, limit).map(family => {
    const entry = recruitingRoleTaxonomy[family]
    const overlap = unique([
      ...profile.tools.filter(tool => entry.toolSignals.some(signal => signal.toLowerCase() === tool.toLowerCase() || signal.toLowerCase().includes(tool.toLowerCase()))),
      ...profile.industries.filter(industry => entry.industrySignals.includes(industry)),
      ...profile.specialties.filter(specialty => entry.skillSignals.some(signal => specialty.toLowerCase().includes(signal))),
    ])

    const whyItFits = overlap.length
      ? [`Your resume already has bridge signals for this lane: ${overlap.slice(0, 4).join(', ')}.`]
      : [`This is a common adjacent move from ${getRoleFamilyLabel(profile.primaryFamily)} when the resume shows transferable recruiting systems, research, or stakeholder experience.`]

    return {
      family,
      label: entry.label,
      fitBand: 'Adjacent Fit',
      whyItFits,
      bridgeNote: entry.resumeAngle,
      searchTerms: entry.searchTerms,
    }
  })
}

export function buildJobSearchQuery(profile: ResumeProfile, preferences: CareerPreferences): string {
  return buildCareerMatchQueries(profile, preferences, 0).slice(0, 4).join(' ')
}

function groupForMatch(match: JobMatchResult, profile: ResumeProfile): MatchGroupId {
  if (match.score >= 68 && (match.jobFamily === profile.primaryFamily || profile.roleFamilies.includes(match.jobFamily))) return 'best-fits'
  if (match.jobFamily === 'sourcer' || match.jobFamily === 'technical-sourcer' || match.jobFamily === 'ai-recruiter') return 'sourcing'
  if (match.jobFamily === 'recruiter' || match.jobFamily === 'remote-recruiter' || /talent acquisition|ta partner|full.?cycle/i.test(match.job.title)) return 'recruiting'
  if (match.jobFamily === 'recruiting-ops' || match.jobFamily === 'talent-intelligence') return 'ops-intelligence'
  if (match.jobFamily === 'govcon-recruiter') return 'federal-cleared'
  if (match.jobFamily === 'rpo-recruiter' || /contract|rpo|agency|staffing|embedded/i.test(textForJob(match.job))) return 'rpo-contract-agency'
  return 'domain-shift-stretch'
}

const GROUP_META: Record<MatchGroupId, { label: string; description: string }> = {
  'best-fits': {
    label: 'Best Fits',
    description: 'Direct title, seniority, and signal matches for your current recruiting lane.',
  },
  sourcing: {
    label: 'Sourcing Roles',
    description: 'Talent sourcer, technical sourcer, engineering sourcer, AI sourcer, and sourcing-heavy roles.',
  },
  recruiting: {
    label: 'Recruiting Roles',
    description: 'Full-cycle recruiter, TA partner, corporate recruiter, and remote recruiter roles you may fit.',
  },
  'ops-intelligence': {
    label: 'Ops & Intelligence',
    description: 'Recruiting operations, talent intelligence, market mapping, enablement, and systems roles.',
  },
  'federal-cleared': {
    label: 'Federal / Cleared',
    description: 'GovCon, defense, federal, public sector, and cleared recruiting lanes. Clearance remains unverified.',
  },
  'rpo-contract-agency': {
    label: 'RPO / Contract / Agency',
    description: 'Embedded, RPO, staffing, agency, contract, and fractional recruiting roles.',
  },
  'domain-shift-stretch': {
    label: 'Domain Shift / Stretch',
    description: 'Roles with transferable recruiting signals but weaker direct alignment or higher stretch.',
  },
}

export function groupJobMatches(matches: JobMatchResult[], profile: ResumeProfile): MatchGroup[] {
  const grouped = new Map<MatchGroupId, JobMatchResult[]>()
  for (const match of matches) {
    const group = groupForMatch(match, profile)
    grouped.set(group, [...(grouped.get(group) || []), match])
  }
  const order: MatchGroupId[] = ['best-fits', 'sourcing', 'recruiting', 'ops-intelligence', 'federal-cleared', 'rpo-contract-agency', 'domain-shift-stretch']
  return order
    .map(id => ({ id, ...GROUP_META[id], matches: grouped.get(id) || [] }))
    .filter(group => group.matches.length > 0)
}

export function buildRoleUniverse(profile: ResumeProfile, preferences: CareerPreferences, matches: JobMatchResult[], queries: string[]): CareerMatchRoleUniverse {
  const familyCounts = new Map<RecruitingRoleFamily, number>()
  for (const match of matches) familyCounts.set(match.jobFamily, (familyCounts.get(match.jobFamily) || 0) + 1)
  const viable = Array.from(familyCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([family]) => getRoleFamilyLabel(family))

  const adjacentLabels = suggestAdjacentRoles(profile, preferences, 6).map(role => role.label)
  const strongestSignals = unique([
    ...profile.specialties.slice(0, 4),
    ...profile.tools.slice(0, 6),
    ...profile.industries.slice(0, 4),
    profile.clearance.status === 'unverified-breadcrumb' ? 'Federal / clearance breadcrumbs' : '',
  ])

  return {
    strongestLane: getRoleFamilyLabel(profile.primaryFamily),
    alsoViable: unique([...viable.filter(label => label !== getRoleFamilyLabel(profile.primaryFamily)), ...adjacentLabels]).slice(0, 6),
    stretchLanes: unique(['Sourcing Manager', 'TA Program Manager', 'Recruiting Enablement', 'Talent Intelligence'].filter(label => !viable.includes(label))).slice(0, 4),
    strongestSignals: strongestSignals.slice(0, 10),
    queryLanes: queries.slice(0, 18),
  }
}
