import type {
  AdjacentRole,
  CareerPreferences,
  FitScoreBand,
  JobMatchResult,
  MatchScoreBreakdown,
  MatchableJob,
  RecruitingRoleFamily,
  ResumeProfile,
  SeniorityLevel,
} from './types'
import { getAdjacentFamilies, getRoleFamilyLabel, recruitingRoleTaxonomy, roleFamilyOrder } from './role-taxonomy'

function textForJob(job: MatchableJob): string {
  return [job.title, job.company, job.location, job.remoteType, job.employmentType, job.salaryRange, job.description, job.category, ...(job.tags || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function unique<T extends string>(items: T[]): T[] {
  return Array.from(new Set(items.filter(Boolean)))
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
    // Title signals should beat broad terms like "sourcer" or "recruiter".
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
  return jobText.includes(pref) || pref.split(/[,.\s]+/).some(part => part.length > 2 && jobText.includes(part))
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
    fitReasons: fitReasons.slice(0, 6),
    potentialGaps: potentialGaps.slice(0, 6),
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

export function rankJobMatches(profile: ResumeProfile, preferences: CareerPreferences, jobs: MatchableJob[], limit = 5): JobMatchResult[] {
  const matches = jobs
    .map(job => scoreJobMatch(profile, preferences, job))
    .filter((match): match is JobMatchResult => Boolean(match))
    .sort((a, b) => b.score - a.score)

  const seen = new Set<string>()
  const deduped = matches.filter(match => {
    const key = `${match.job.company}-${match.job.title}-${match.job.location}`.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return deduped.slice(0, limit)
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
  const family = preferences.desiredRoleType && preferences.desiredRoleType !== 'any'
    ? preferences.desiredRoleType
    : profile.primaryFamily
  const terms = recruitingRoleTaxonomy[family].searchTerms.slice(0, 3)
  const specialty = profile.industries.includes('federal') ? 'federal' : profile.industries.includes('healthcare') ? 'healthcare' : ''
  return unique([...terms, specialty ? `${specialty} recruiter` : '']).join(' ')
}
